#!/usr/bin/env node
/**
 * PixelHQ Hook Script
 *
 * This script is called by Claude Code hooks. It reads the hook event from stdin
 * and forwards it to the PixelHQ CLI server.
 *
 * Usage:
 * Add to ~/.claude/settings.json:
 * {
 *   "hooks": {
 *     "PreToolUse": [{ "command": "pixelhq-hook" }],
 *     "PostToolUse": [{ "command": "pixelhq-hook" }],
 *     "Stop": [{ "command": "pixelhq-hook" }]
 *   }
 * }
 */

const HOOK_ENDPOINT = 'http://127.0.0.1:8787/hook';

interface HookInput {
  type: string;
  tool?: {
    name: string;
  };
  exitCode?: number;
  error?: string;
}

async function main() {
  // Read stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const input = Buffer.concat(chunks).toString('utf-8');

  if (!input.trim()) {
    process.exit(0);
  }

  try {
    const hookInput: HookInput = JSON.parse(input);

    // Transform to our hook event format
    const event = {
      type: hookInput.type,
      tool: hookInput.tool?.name,
      exitCode: hookInput.exitCode,
      error: hookInput.error,
    };

    // Send to CLI server
    const response = await fetch(HOOK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      // Silent fail - don't want to interrupt Claude Code
      process.exit(0);
    }
  } catch (err) {
    // Silent fail
    process.exit(0);
  }
}

main();
