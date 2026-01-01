# hello-agent-client

OpenHands TypeScript client example that runs an agent task.

## Prerequisites

- [Bun](https://bun.sh) runtime
- OpenHands server running (default: `http://localhost:8000`)

## Setup

```bash
bun install
```

Configure `.env`:

```
OPENHANDS_BASE_URL=http://localhost:8000
OPENHANDS_API_KEY=your-api-key
LLM_MODEL=openhands/claude-sonnet-4-5-20250929
LLM_API_KEY=your-llm-api-key
```

## Run

```bash
bun run make-pr.ts
```

## Patches

The `patches/` directory contains fixes for the `@openhands/typescript-client` SDK. These are applied automatically via `postinstall`. See `RCA.md` for details.
