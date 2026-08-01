# Changelog

## 1.0.0

- Dropped Colyseus 0.16 and migrated the runtime, room generics, SDK tests, Redis adapters, and peer dependencies to Colyseus 0.17.
- Added `@UseRoomFilters()` at class and method level.
- Added Nest DI resolution for singleton and scoped room exception filters.
- Added safe game-protocol error payloads and server-side error logging.
- Added stable Nest exception mapping, including `ForbiddenException` to `FORBIDDEN`.
- Added real WebSocket and package consumer coverage on Node.js 20 and 22.

## 0.3.0

- Added Nest-compatible room guards, pipes, and interceptors.
- Added `ColyseusExecutionContext` with WebSocket and room accessors.
- Added client, payload, room, message-type, and context parameter decorators.
- Added class, method, and parameter-level enhancer metadata with Nest DI resolution.
- Added DTO metatype forwarding for validation and transformation pipes.
- Added real-client coverage for the complete message pipeline.

## 0.2.1

- Fixed duplicate `forRoot()` detection on NestJS 10.

## 0.2.0

- Added `@ColyseusRoom()` and `@OnRoomMessage()` decorators.
- Added array-based decorated room registration through `forFeature()`.
- Added explicit server lifecycle states and state-aware health snapshots.
- Added duplicate root registration protection per Nest container.
- Added a real standalone WebSocket client integration test.
- Updated Jest configuration to the current `ts-jest` transform format.

## 0.1.1

- Added real CommonJS and ESM package consumer checks.
- Added typed room descriptors with matchmaking options.
- Added standalone listener validation and startup rollback.
- Added degraded health status and a Terminus-compatible indicator.
- Added the opt-in `NestRoom` provider-resolution bridge.
- Added Redis integration coverage and NestJS compatibility CI.

## 0.1.0

- Initial production-focused NestJS/Colyseus integration.
