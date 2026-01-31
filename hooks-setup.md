# Claude Code Hooks Setup

To make PixelHQ animate in real-time while Claude Code is working, you need to configure hooks.

## Quick Setup

Add this to your Claude Code settings file:

**Global (all projects):** `~/.claude/settings.json`
**Per project:** `.claude/settings.json`

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://127.0.0.1:8787/hook -H 'Content-Type: application/json' -d '{\"type\":\"PreToolUse\",\"tool\":\"$TOOL_NAME\"}' > /dev/null 2>&1 &"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://127.0.0.1:8787/hook -H 'Content-Type: application/json' -d '{\"type\":\"PostToolUse\",\"tool\":\"$TOOL_NAME\"}' > /dev/null 2>&1 &"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://127.0.0.1:8787/hook -H 'Content-Type: application/json' -d '{\"type\":\"Stop\"}' > /dev/null 2>&1 &"
          }
        ]
      }
    ]
  }
}
```

## How it works

| Claude Code Event | PixelHQ Animation |
|-------------------|-------------------|
| `Write` / `Edit` tool | Character types at desk |
| `Bash` tool | Character runs to terminal |
| `Read` / `Grep` / `Glob` | Character thinks |
| Task completes (`Stop`) | Character celebrates |
| Error | Character shows error |

## Testing

1. Start PixelHQ: `cd packages/cli && pnpm dev`
2. Open on your phone: `http://<your-ip>:8787/`
3. Use Claude Code - watch the animations!

## Manual Testing

```bash
cd packages/cli
npx tsx src/index.ts emit typing
npx tsx src/index.ts emit running
npx tsx src/index.ts emit thinking
npx tsx src/index.ts emit celebrate
npx tsx src/index.ts emit error
npx tsx src/index.ts emit idle
```
