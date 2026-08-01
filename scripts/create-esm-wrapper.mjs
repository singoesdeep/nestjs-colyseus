import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('dist/esm', { recursive: true });
writeFileSync(
  'dist/esm/index.mjs',
  `import pkg from '../index.js';

export const ColyseusModule = pkg.ColyseusModule;
export const ColyseusService = pkg.ColyseusService;
export const ColyseusHealthService = pkg.ColyseusHealthService;
export const ColyseusHealthIndicator = pkg.ColyseusHealthIndicator;
export const ColyseusRoomRegistry = pkg.ColyseusRoomRegistry;
export const NestRoom = pkg.NestRoom;
export const isNestRoomConstructor = pkg.isNestRoomConstructor;
export const createNestRoomConstructor = pkg.createNestRoomConstructor;
export const ColyseusRoom = pkg.ColyseusRoom;
export const OnRoomMessage = pkg.OnRoomMessage;
export const UseRoomGuards = pkg.UseRoomGuards;
export const UseRoomPipes = pkg.UseRoomPipes;
export const UseRoomInterceptors = pkg.UseRoomInterceptors;
export const RoomClient = pkg.RoomClient;
export const RoomPayload = pkg.RoomPayload;
export const RoomInstance = pkg.RoomInstance;
export const RoomMessageType = pkg.RoomMessageType;
export const RoomContext = pkg.RoomContext;
export const COLYSEUS_ROOM_METADATA = pkg.COLYSEUS_ROOM_METADATA;
export const COLYSEUS_MESSAGE_METADATA = pkg.COLYSEUS_MESSAGE_METADATA;
export const COLYSEUS_GUARDS_METADATA = pkg.COLYSEUS_GUARDS_METADATA;
export const COLYSEUS_PIPES_METADATA = pkg.COLYSEUS_PIPES_METADATA;
export const COLYSEUS_INTERCEPTORS_METADATA = pkg.COLYSEUS_INTERCEPTORS_METADATA;
export const COLYSEUS_PARAMETERS_METADATA = pkg.COLYSEUS_PARAMETERS_METADATA;
export const getColyseusRoomMetadata = pkg.getColyseusRoomMetadata;
export const getColyseusMessageMetadata = pkg.getColyseusMessageMetadata;
export const getRoomEnhancerMetadata = pkg.getRoomEnhancerMetadata;
export const getRoomGuardMetadata = pkg.getRoomGuardMetadata;
export const getRoomPipeMetadata = pkg.getRoomPipeMetadata;
export const getRoomInterceptorMetadata = pkg.getRoomInterceptorMetadata;
export const getRoomParameterMetadata = pkg.getRoomParameterMetadata;
export const ColyseusExecutionContext = pkg.ColyseusExecutionContext;
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
