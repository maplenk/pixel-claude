#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { createServers } from './server.js';
import { StateMachine } from './stateMachine.js';
import { getLocalIP, generateToken, printQRCode } from './qrcode.js';
import type { Mode } from './types.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const HTTP_PORT = 8787;
const WS_PORT = 8765;

// Config directory
const CONFIG_DIR = join(homedir(), '.pixelhq');
const TOKEN_FILE = join(CONFIG_DIR, 'token');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface Config {
  companyName: string;
  token?: string;
}

function loadConfig(): Config {
  const defaults: Config = {
    companyName: 'NINJA NOODLES',
  };

  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    if (existsSync(CONFIG_FILE)) {
      const data = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
      return { ...defaults, ...data };
    }
  } catch (err) {
    // Use defaults
  }

  return defaults;
}

function saveConfig(config: Config): void {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (err) {
    // Ignore save errors
  }
}

function getOrCreateToken(): string {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    const existing = readFileSync(TOKEN_FILE, 'utf-8').trim();
    if (existing && existing.length === 6) {
      return existing;
    }
  } catch (err) {
    // File doesn't exist, create new token
  }

  const newToken = generateToken();
  try {
    writeFileSync(TOKEN_FILE, newToken);
  } catch (err) {
    // Couldn't save, use ephemeral token
  }
  return newToken;
}

const program = new Command();

program
  .name('pixelhq')
  .description('PixelHQ - Pixel art office visualization for Claude Code')
  .version('0.1.0');

program
  .command('start', { isDefault: true })
  .description('Start the PixelHQ server')
  .option('-n, --name <name>', 'Company name to display', '')
  .action(async (options) => {
    const config = loadConfig();

    // Update company name if provided
    if (options.name) {
      config.companyName = options.name.toUpperCase();
      saveConfig(config);
    }

    const localIP = getLocalIP();
    const token = getOrCreateToken();
    const pairUrl = `http://${localIP}:${HTTP_PORT}/pair?token=${token}`;

    const stateMachine = new StateMachine();

    const servers = createServers({
      httpPort: HTTP_PORT,
      wsPort: WS_PORT,
      token,
      localIP,
      companyName: config.companyName,
    }, stateMachine);

    servers.start();

    printQRCode(pairUrl);

    console.log(chalk.gray(`  Company: ${config.companyName}`));
    console.log(chalk.gray(`  HTTP: http://${localIP}:${HTTP_PORT}`));
    console.log(chalk.gray(`  WS:   ws://${localIP}:${WS_PORT}`));
    console.log();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n  Shutting down...'));
      stateMachine.destroy();
      process.exit(0);
    });
  });

program
  .command('config')
  .description('Configure PixelHQ settings')
  .option('-n, --name <name>', 'Set company name')
  .option('--show', 'Show current configuration')
  .action(async (options) => {
    const config = loadConfig();

    if (options.show) {
      console.log(chalk.cyan('  PixelHQ Configuration'));
      console.log(chalk.gray('  ─────────────────────'));
      console.log(`  Company Name: ${chalk.white(config.companyName)}`);
      console.log(`  Config File:  ${chalk.gray(CONFIG_FILE)}`);
      return;
    }

    if (options.name) {
      config.companyName = options.name.toUpperCase();
      saveConfig(config);
      console.log(chalk.green(`  Company name set to: ${config.companyName}`));
    } else {
      console.log(chalk.yellow('  No options provided. Use --help for usage.'));
    }
  });

program
  .command('emit <mode>')
  .description('Emit a state change (for testing)')
  .action(async (mode: string) => {
    const validModes: Mode[] = ['idle', 'typing', 'running', 'thinking', 'celebrate', 'error'];

    if (!validModes.includes(mode as Mode)) {
      console.error(chalk.red(`Invalid mode: ${mode}`));
      console.log(chalk.gray(`Valid modes: ${validModes.join(', ')}`));
      process.exit(1);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${HTTP_PORT}/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mode === 'celebrate' ? 'Stop' :
                mode === 'error' ? 'Error' :
                'PreToolUse',
          tool: mode === 'typing' ? 'Write' :
                mode === 'running' ? 'Bash' :
                undefined,
        }),
      });

      if (response.ok) {
        console.log(chalk.green(`Emitted: ${mode}`));
      } else {
        console.error(chalk.red('Failed to emit state'));
      }
    } catch (err) {
      console.error(chalk.red('Is the server running? Start with: pixelhq'));
    }
  });

program.parse();
