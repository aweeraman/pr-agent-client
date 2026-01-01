import { Conversation, Agent, Workspace } from "@openhands/typescript-client";

// Helper to format event output
function formatEvent(event: any): string | null {
  switch (event.kind) {
    case "MessageEvent": {
      const msg = event.llm_message;
      if (!msg) return null;
      const role = msg.role?.toUpperCase() || "MESSAGE";
      const content = msg.content
        ?.map((c: any) => c.text || (c.image_url ? "[image]" : ""))
        .filter(Boolean)
        .join(" ")
        .slice(0, 200);
      if (!content) return null;
      return `[${role}] ${content}${content.length >= 200 ? "..." : ""}`;
    }
    case "ActionEvent": {
      const action = event.action;
      if (!action) return null;
      const actionType = action.type || action.kind || "action";
      // Show relevant details based on action type
      if (action.command) {
        return `[ACTION:${actionType}] $ ${action.command.slice(0, 100)}${action.command.length > 100 ? "..." : ""}`;
      }
      if (action.path) {
        return `[ACTION:${actionType}] ${action.path}`;
      }
      if (action.thought) {
        return `[THOUGHT] ${action.thought.slice(0, 150)}${action.thought.length > 150 ? "..." : ""}`;
      }
      return `[ACTION:${actionType}]`;
    }
    case "ObservationEvent": {
      const toolName = event.tool_name || "tool";
      const obs = event.observation;
      if (typeof obs === "string") {
        const preview = obs.slice(0, 150);
        return `[RESULT:${toolName}] ${preview}${obs.length > 150 ? "..." : ""}`;
      }
      if (obs?.output) {
        const preview = obs.output.slice(0, 150);
        return `[RESULT:${toolName}] ${preview}${obs.output.length > 150 ? "..." : ""}`;
      }
      return `[RESULT:${toolName}] (completed)`;
    }
    case "AgentErrorEvent": {
      const errMsg = event.observation?.error || event.observation?.message || "Unknown error";
      return `[ERROR] ${errMsg}`;
    }
    case "PauseEvent":
      return "[PAUSED] Agent execution paused";
    case "SystemPromptEvent":
      return "[SYSTEM] System prompt initialized";
    case "ConversationStateUpdateEvent":
      // These are internal state updates, skip them
      return null;
    default:
      // Skip unknown/internal events
      return null;
  }
}

// Helper to format status
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    idle: "Idle - Waiting for input",
    running: "Running - Agent is working...",
    paused: "Paused - Execution paused",
    waiting_for_confirmation: "Awaiting Confirmation",
    finished: "Finished - Task completed",
    error: "Error - Task failed",
    stuck: "Stuck - Agent needs help",
  };
  return statusMap[status] || status;
}

async function main() {
  const baseUrl = process.env.OPENHANDS_BASE_URL ?? "http://localhost:8000";
  const apiKey = process.env.OPENHANDS_API_KEY;

  const agent = new Agent({
    llm: {
      model: process.env.LLM_MODEL ?? "openhands/claude-sonnet-4-5-20250929",
      api_key: process.env.LLM_API_KEY ?? "",
    },
    tools: [
      { name: "terminal" },
      { name: "file_editor" },
      { name: "task_tracker" },
    ],
  });

  const workspace = new Workspace({
    host: baseUrl,
    workingDir: "/Users/anuradha/verdentra/openhands/hello",
    apiKey,
  });

  let lastStatus = "";

  const conversation = new Conversation(agent, workspace, {
    callback: (event) => {
      const formatted = formatEvent(event);
      if (formatted) {
        console.log(formatted);
      }
    },
  });

  const initialMessage = `
You are connected to a git workspace whose remote is github.com/aweeraman/hello.

Task:
- Create a branch "feature/update-hello-{uuid}" from main.
- Edit index.js so it logs "Hello from OpenHands!".
- Commit with message "Update greeting".
- Push the branch to GitHub.
- Open a pull request against main with title "Update hello greeting".
- Reply with ONLY the PR URL.
`.trim();

  await conversation.start({ initialMessage });
  console.log("Conversation ID:", conversation.id);

  // Start WebSocket for real-time events
  await conversation.startWebSocketClient();

  // When an initial message is provided, the conversation starts running automatically.
  // We just need to wait for completion via the WebSocket events.
  // Poll the conversation status until it's no longer running.
  let isComplete = false;
  while (!isComplete) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const status = await conversation.state.getAgentStatus();
      // Only log status changes
      if (status !== lastStatus) {
        console.log(`\n[STATUS] ${formatStatus(status)}\n`);
        lastStatus = status;
      }
      if (status !== "running") {
        isComplete = true;
      }
    } catch (err) {
      console.error("[ERROR] Failed to check status:", err);
    }
  }

  // Get final conversation stats
  try {
    const stats = await conversation.conversationStats();
    console.log("\n[SUMMARY]");
    console.log(`  Total events: ${stats.total_events || 0}`);
    console.log(`  Messages: ${stats.message_events || 0}`);
    console.log(`  Actions: ${stats.action_events || 0}`);
    console.log(`  Observations: ${stats.observation_events || 0}`);
  } catch {
    // Stats may not be available
  }

  console.log("\n[COMPLETE] Task finished.");

  // Clean up
  await conversation.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

