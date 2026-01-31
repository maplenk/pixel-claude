# Pixel Claude

A pixel art office PWA that visualizes Claude Code events in real-time. Watch your AI agent type at the desk, think at the whiteboard, and celebrate when tasks complete.

> **Credits**: This project is inspired by and pays tribute to the original [PixelHQ](https://www.reddit.com/r/ClaudeCode/comments/1qrbsfa/i_built_a_pixel_office_that_animates_in_realtime/) by the amazing creator who built "a pixel office that animates in real-time based on Claude Code activity". All credit for the original concept goes to them!

## Features

- **Real-time visualization** of Claude Code activity
- **Customizable company name** - brand it as your own
- **Fullscreen landscape mode** - optimized for mobile
- **Multiple workers** in a pixel art office
- **Lounge area** with couch and coffee table
- **No accounts, no cloud** - LAN only, data stays local

## Quick Start

```bash
# Install dependencies
pnpm install

# Start the server
cd packages/cli
pnpm dev

# Or with custom company name
pnpm dev -- --name "MYCOMPANY"
```

Then scan the QR code with your phone or open the URL shown.

## Configure Claude Code Hooks

To make the office animate while Claude Code works, add hooks to `~/.claude/settings.json`:

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

See [hooks-setup.md](./hooks-setup.md) for full configuration.

## Animation States

| Claude Code Event | Animation |
|-------------------|-----------|
| `Write` / `Edit` | Character types at desk, screen shows code |
| `Bash` | Character runs to terminal, screen scrolls |
| `Read` / `Grep` | Character thinks with thought bubble |
| Task complete | Character celebrates with confetti |
| Error | Character shows error indicator |

## CLI Commands

```bash
# Start server
pixelhq

# Start with custom company name
pixelhq --name "ACME"

# Configure settings
pixelhq config --name "ACME"
pixelhq config --show

# Test animations
pixelhq emit typing
pixelhq emit running
pixelhq emit thinking
pixelhq emit celebrate
pixelhq emit error
pixelhq emit idle
```

## Architecture

```
pixel-claude/
├── packages/
│   ├── cli/          # Node.js CLI server
│   │   ├── HTTP (port 8787) - serves PWA
│   │   ├── WebSocket (port 8765) - streams events
│   │   └── Hook endpoint - receives Claude events
│   └── pwa/          # Vite PWA (for development)
```

## Development

```bash
# Run CLI in development
cd packages/cli
pnpm dev

# Run PWA dev server (optional, for hot reload)
cd packages/pwa
pnpm dev
```

## Configuration

Settings are stored in `~/.pixelhq/`:
- `config.json` - company name and other settings
- `token` - persistent pairing token

## Credits

- **Original Concept**: [PixelHQ](https://www.reddit.com/r/ClaudeCode/comments/1qrbsfa/i_built_a_pixel_office_that_animates_in_realtime/) - The brilliant original project that inspired this
- **Built with**: TypeScript, Node.js, HTML5 Canvas, WebSockets

## License

MIT

---

*"Completely useless and I love it."* - Original PixelHQ creator
