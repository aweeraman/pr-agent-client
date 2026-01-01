import { Conversation, Agent, Workspace } from "@openhands/typescript-client";
import { formatEvent, formatStatus, waitForCompletion } from "./utils";

async function main() {
  const workingDir = process.argv[2];
  if (!workingDir) {
    console.error("Usage: bun make-pr.ts <workspace-dir>");
    process.exit(1);
  }

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
    workingDir,
    apiKey,
  });

  const conversation = new Conversation(agent, workspace, {
    callback: (event) => {
      const formatted = formatEvent(event);
      if (formatted) console.log(formatted);
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

  await conversation.startWebSocketClient();

  await waitForCompletion(conversation, {
    onStatusChange: (status) => console.log(`\n[STATUS] ${formatStatus(status)}\n`),
  });

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
  await conversation.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
