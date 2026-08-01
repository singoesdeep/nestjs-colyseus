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
  writeFileSync(join(temp, 'consumer.cjs'), "const pkg = require('nestjs-colyseus'); for (const key of ['ColyseusModule', 'ColyseusHealthIndicator', 'NestRoom', 'ColyseusRoom', 'OnRoomMessage', 'UseRoomGuards', 'UseRoomPipes', 'UseRoomInterceptors', 'RoomClient', 'RoomPayload', 'RoomInstance', 'RoomMessageType', 'RoomContext', 'COLYSEUS_ROOM_METADATA', 'COLYSEUS_MESSAGE_METADATA', 'COLYSEUS_GUARDS_METADATA', 'COLYSEUS_PIPES_METADATA', 'COLYSEUS_INTERCEPTORS_METADATA', 'COLYSEUS_PARAMETERS_METADATA', 'getColyseusRoomMetadata', 'getColyseusMessageMetadata', 'getRoomEnhancerMetadata', 'getRoomGuardMetadata', 'getRoomPipeMetadata', 'getRoomInterceptorMetadata', 'getRoomParameterMetadata', 'ColyseusExecutionContext']) if (!pkg[key]) throw new Error('Missing ' + key + ' export');\n");
  execFileSync(process.execPath, ['consumer.cjs'], { cwd: temp, stdio: 'inherit' });
  writeFileSync(join(temp, 'consumer.mjs'), "import { ColyseusModule, ColyseusHealthIndicator, NestRoom, ColyseusRoom, OnRoomMessage, UseRoomGuards, UseRoomPipes, UseRoomInterceptors, RoomClient, RoomPayload, RoomInstance, RoomMessageType, RoomContext, COLYSEUS_ROOM_METADATA, COLYSEUS_MESSAGE_METADATA, COLYSEUS_GUARDS_METADATA, COLYSEUS_PIPES_METADATA, COLYSEUS_INTERCEPTORS_METADATA, COLYSEUS_PARAMETERS_METADATA, getColyseusRoomMetadata, getColyseusMessageMetadata, getRoomEnhancerMetadata, getRoomGuardMetadata, getRoomPipeMetadata, getRoomInterceptorMetadata, getRoomParameterMetadata, ColyseusExecutionContext } from 'nestjs-colyseus'; for (const [key, value] of Object.entries({ ColyseusModule, ColyseusHealthIndicator, NestRoom, ColyseusRoom, OnRoomMessage, UseRoomGuards, UseRoomPipes, UseRoomInterceptors, RoomClient, RoomPayload, RoomInstance, RoomMessageType, RoomContext, COLYSEUS_ROOM_METADATA, COLYSEUS_MESSAGE_METADATA, COLYSEUS_GUARDS_METADATA, COLYSEUS_PIPES_METADATA, COLYSEUS_INTERCEPTORS_METADATA, COLYSEUS_PARAMETERS_METADATA, getColyseusRoomMetadata, getColyseusMessageMetadata, getRoomEnhancerMetadata, getRoomGuardMetadata, getRoomPipeMetadata, getRoomInterceptorMetadata, getRoomParameterMetadata, ColyseusExecutionContext })) if (!value) throw new Error('Missing ' + key + ' export');\n");
  execFileSync(process.execPath, ['consumer.mjs'], { cwd: temp, stdio: 'inherit' });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
