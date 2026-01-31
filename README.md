# Ninja Noodles - Pixel Ramen Stall

A cozy pixel art ramen stall PWA that visualizes Claude Code events in real-time. Watch your ninja chef prep ingredients, cook ramen, and serve customers as your AI works.

> **Credits**: This project is inspired by and pays tribute to the original [PixelHQ](https://www.reddit.com/r/ClaudeCode/comments/1qrbsfa/i_built_a_pixel_office_that_animates_in_realtime/) by the amazing creator who built "a pixel office that animates in real-time based on Claude Code activity". All credit for the original concept goes to them!

## Features

- **Cozy Japanese ramen stall theme** with authentic atmosphere
- **Real-time visualization** of Claude Code activity
- **Customizable sign name** - brand it as your own
- **Portrait-first layout** (180x320) - optimized for mobile
- **Multi-layer parallax background** with night sky, mountains, and city skyline
- **No accounts, no cloud** - LAN only, data stays local

### Scene Elements

- Night sky with twinkling stars and subtle moon
- Distant mountain silhouettes and city skyline with pagoda roofs
- Flickering window lights in distant buildings
- Hanging red lanterns with warm glow effects
- Wooden sign with customizable company name
- Swaying noren (curtain) entrance
- Vertical "RAMEN" banner
- Work stations: menu scroll, cooking pot, prep board, serving counter
- Props: stacked bowls, chopsticks jar, soy sauce, napkins, tickets

### Ninja Chef Character

- Moves between work stations based on Claude's activity
- Smooth walking animation with headband tails flowing
- Mode-specific animations and effects
- Thought bubbles, sweat drops, celebration poses

## Quick Start

```bash
# Install dependencies
pnpm install

# Start the server
pnpm dev

# Or with custom sign name
pnpm dev -- --name "Queue"
```

Then scan the QR code with your phone or open the URL shown.

## Animation States

| Claude Code Event | Station | Animation |
|-------------------|---------|-----------|
| `Write` / `Edit` | Prep Board | Knife chopping ingredients |
| `Bash` | Cooking Pot | Intense flames, bubbling broth, steam |
| `Read` / `Grep` | Menu Scroll | Scanning menu items, thought bubble |
| Task complete | Counter | Serving completed bowl with steam |
| Error | Prep Area | Spilled bowl, smoke, sweat drops |
| Idle | Center | Chef rests |

### Fire & Cooking Effects (Running Mode)

- 6 animated flame layers with yellow tips
- Fire glow on ground below pot
- Vigorous bubbling with broth splashes
- Warm orange glow effect on entire scene
- Extra steam rising from pot

### Error Effects

- Smoke rising from dying flames
- Multiple sweat drops on character
- Panic lines around head
- Spilled bowl with broth puddle
- Scattered noodles on ground
- Dropped chopsticks
- Red warning tint on scene

## Configure Claude Code Hooks

To make the stall animate while Claude Code works, add hooks to `~/.claude/settings.json`:

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

## CLI Commands

```bash
# Start server
pixelhq

# Start with custom sign name
pixelhq --name "ACME"

# Configure settings
pixelhq config --name "ACME"
pixelhq config --show

# Test animations
pixelhq emit typing    # Prep station
pixelhq emit running   # Cooking with fire
pixelhq emit thinking  # Menu reading
pixelhq emit celebrate # Serve bowl
pixelhq emit error     # Spilled mess
pixelhq emit idle      # Rest
```

## Keyboard Shortcuts (Development)

When running the PWA dev server, press keys 1-6 to test modes:
- **1** = idle
- **2** = typing (prep)
- **3** = running (cook with fire)
- **4** = thinking (menu)
- **5** = celebrate (serve)
- **6** = error (spill)

## Architecture

```
pixel-claude/
├── packages/
│   ├── cli/          # Node.js CLI server
│   │   ├── HTTP (port 8787) - serves embedded PWA
│   │   ├── WebSocket (port 8765) - streams events
│   │   └── Hook endpoint - receives Claude events
│   └── pwa/          # Vite PWA (for development)
```

## Development

```bash
# Run both CLI and PWA dev servers
pnpm dev

# Run CLI only
pnpm cli

# Run PWA dev server only (hot reload)
pnpm pwa
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
