import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('dist/esm', { recursive: true });
writeFileSync(
  'dist/esm/index.mjs',
  `import pkg from '../index.js';

export const ColyseusModule = pkg.ColyseusModule;
export const ColyseusService = pkg.ColyseusService;
export const ColyseusHealthService = pkg.ColyseusHealthService;
export const ColyseusRoomRegistry = pkg.ColyseusRoomRegistry;
export const ConfigurableModuleClass = pkg.ConfigurableModuleClass;
export const MODULE_OPTIONS_TOKEN = pkg.MODULE_OPTIONS_TOKEN;
export const COLYSEUS_OPTIONS = pkg.COLYSEUS_OPTIONS;
export const COLYSEUS_SERVER = pkg.COLYSEUS_SERVER;
export const ColyseusConfigurationError = pkg.ColyseusConfigurationError;
export const DuplicateRoomError = pkg.DuplicateRoomError;
export const RoomRegistrationClosedError = pkg.RoomRegistrationClosedError;
export const ColyseusStartupError = pkg.ColyseusStartupError;
export const ColyseusShutdownError = pkg.ColyseusShutdownError;
export default pkg;
`,
);
