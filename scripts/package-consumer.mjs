import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const temp = mkdtempSync(join(tmpdir(), 'nestjs-colyseus-consumer-'));

try {
  const run = (args, options = {}) => execFileSync(npm, args, { shell: true, ...options });
  run(['run', 'build'], { cwd: root, stdio: 'inherit' });
  const output = run(['pack', '--json', '--pack-destination', temp], {
    cwd: root,
    encoding: 'utf8',
  });
  const archive = join(temp, JSON.parse(output)[0].filename);
  writeFileSync(join(temp, 'package.json'), '{"private":true}\n');
  run(['install', '--ignore-scripts', '--no-audit', '--no-fund', archive, '@colyseus/core@^0.16.0', '@colyseus/ws-transport@^0.16.0', '@nestjs/common@^11.0.0', '@nestjs/core@^11.0.0', '@nestjs/platform-express@^11.0.0'], {
    cwd: temp,
    stdio: 'inherit',
  });
  writeFileSync(join(temp, 'consumer.cjs'), "const pkg = require('nestjs-colyseus'); if (!pkg.ColyseusModule) process.exit(1);\n");
  execFileSync(process.execPath, ['consumer.cjs'], { cwd: temp, stdio: 'inherit' });
  writeFileSync(join(temp, 'consumer.mjs'), "import { ColyseusModule } from 'nestjs-colyseus'; if (!ColyseusModule) process.exit(1);\n");
  execFileSync(process.execPath, ['consumer.mjs'], { cwd: temp, stdio: 'inherit' });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
