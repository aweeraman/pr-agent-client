// Helper to format event output
export function formatEvent(event: any): string | null {
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
      return null;
    default:
      return null;
  }
}

const STATUS_MAP: Record<string, string> = {
  idle: "Idle - Waiting for input",
  running: "Running - Agent is working...",
  paused: "Paused - Execution paused",
  waiting_for_confirmation: "Awaiting Confirmation",
  finished: "Finished - Task completed",
  error: "Error - Task failed",
  stuck: "Stuck - Agent needs help",
};

export function formatStatus(status: string): string {
  return STATUS_MAP[status] || status;
}

export interface WaitOptions {
  timeoutMs?: number;
  maxConsecutiveErrors?: number;
  pollIntervalMs?: number;
  onStatusChange?: (status: string) => void;
}

export async function waitForCompletion(
  conversation: { state: { getAgentStatus: () => Promise<string> } },
  options: WaitOptions = {}
): Promise<string> {
  const {
    timeoutMs = 10 * 60 * 1000,
    maxConsecutiveErrors = 5,
    pollIntervalMs = 2000,
    onStatusChange,
  } = options;

  const startTime = Date.now();
  let consecutiveErrors = 0;
  let lastStatus = "";

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Timeout: conversation did not complete within ${timeoutMs / 1000}s`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    try {
      const status = await conversation.state.getAgentStatus();
      consecutiveErrors = 0;

      if (status !== lastStatus) {
        onStatusChange?.(status);
        lastStatus = status;
      }

      if (status !== "running") {
        return status;
      }
    } catch (err) {
      consecutiveErrors++;
      if (consecutiveErrors >= maxConsecutiveErrors) {
        throw new Error(`Aborting: ${maxConsecutiveErrors} consecutive status check failures`);
      }
    }
  }
}
