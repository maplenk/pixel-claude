import qrcode from 'qrcode-terminal';
import chalk from 'chalk';
import { networkInterfaces } from 'os';

export function getLocalIP(): string {
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    const interfaces = nets[name];
    if (!interfaces) continue;

    for (const net of interfaces) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (net.internal) continue;
      if (net.family !== 'IPv4') continue;

      // Skip Docker, VM, and other virtual interfaces
      const lowerName = name.toLowerCase();
      if (lowerName.includes('docker')) continue;
      if (lowerName.includes('veth')) continue;
      if (lowerName.includes('vmnet')) continue;
      if (lowerName.includes('vbox')) continue;

      return net.address;
    }
  }

  return '127.0.0.1';
}

export function generateToken(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function printQRCode(url: string): void {
  console.log();
  console.log(chalk.bold.cyan('  PixelHQ'));
  console.log(chalk.gray('  ─────────────────────────────────'));
  console.log();

  qrcode.generate(url, { small: true }, (code) => {
    // Indent the QR code
    const lines = code.split('\n');
    for (const line of lines) {
      console.log('  ' + line);
    }
  });

  console.log();
  console.log(chalk.white('  Scan QR code or open:'));
  console.log(chalk.green.bold(`  ${url}`));
  console.log();
  console.log(chalk.gray('  ─────────────────────────────────'));
  console.log(chalk.gray('  Ctrl+C to stop'));
  console.log();
}
