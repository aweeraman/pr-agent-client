#!/bin/bash
# Apply patches to node_modules after install
# See RCA.md for details on the fix

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="node_modules/@openhands/typescript-client/dist/conversation/remote-state.js"

if [ -f "$TARGET" ]; then
  cp "$SCRIPT_DIR/remote-state.js" "$TARGET"
  echo "Patched: $TARGET"
else
  echo "Warning: $TARGET not found, skipping patch"
fi
