# nestjs-colyseus

Production-focused NestJS integration for Colyseus. The module connects
Colyseus' `Server` API to the NestJS lifecycle and forwards room definitions,
Redis adapters, and other Colyseus options without wrapping game logic.

## Installation

```sh
npm install nestjs-colyseus @colyseus/core @colyseus/ws-transport
```

For multiple processes, also install the Redis adapters matching your Colyseus
version:

```sh
npm install @colyseus/redis-presence @colyseus/redis-driver
```

## 1. Embedded mode

Embedded mode shares NestJS' existing HTTP server. Do not set `port`; NestJS
owns the HTTP and WebSocket listener.

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { ColyseusModule } from 'nestjs-colyseus';
import { LobbyRoom } from './rooms/lobby.room';

@Module({
  imports: [
    ColyseusModule.forRoot({
      rooms: { lobby: LobbyRoom },
    }),
  ],
})
export class AppModule {}
```

A room is a regular Colyseus room class:

```ts
import { Room } from '@colyseus/core';

export class LobbyRoom extends Room {
  onCreate(options: Record<string, unknown>) {
    // Define state, message handlers, onAuth, and room behavior here.
  }
}
```

```ts
// main.ts
const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
await app.listen(process.env.PORT ?? 3000);
```

`enableShutdownHooks()` lets Nest drain rooms and transports on SIGTERM/SIGINT.

## 2. Feature module room registration

Use `forFeature()` when rooms belong to separate Nest feature modules:

```ts
@Module({
  imports: [
    ColyseusModule.forFeature({
      rooms: { battle: BattleRoom },
    }),
  ],
})
export class BattleModule {}
```

Call `forRoot()` once in the application. Import feature modules from the root
module. Duplicate root registrations and duplicate room names fail during
startup.

Room descriptors can provide Colyseus matchmaking options while direct room
constructors remain supported:

```ts
ColyseusModule.forFeature({
  rooms: {
    world: {
      room: WorldRoom,
      defaultOptions: { mapId: 'main-world' },
      filterBy: ['region', 'channel'],
      sortBy: { clients: 1 },
      realtimeListing: true,
    },
  },
});
```

### Nest-style room and message decorators

Decorated rooms can be registered as an array. `@ColyseusRoom()` supplies the
room name and matchmaking options, while `@OnRoomMessage()` binds a method to a
Colyseus message type once when each room is created:

```ts
import { Client, Room } from '@colyseus/core';
import {
  ColyseusModule,
  ColyseusRoom,
  OnRoomMessage,
} from 'nestjs-colyseus';

@ColyseusRoom({
  name: 'world',
  filterBy: ['region'],
  sortBy: { clients: 1 },
  realtimeListing: true,
})
export class WorldRoom extends Room {
  @OnRoomMessage('chat')
  onChat(client: Client, message: { text: string }) {
    client.broadcast('chat', message);
  }
}

@Module({
  imports: [
    ColyseusModule.forFeature({ rooms: [WorldRoom] }),
  ],
})
export class WorldModule {}
```

String and numeric message types are supported. Duplicate handlers for the
same type fail during startup. Regular Colyseus lifecycle methods such as
`onAuth`, `onJoin`, `onLeave`, and `onDispose` remain unchanged; the package
does not replace Colyseus game logic.

### Resolving Nest providers from rooms (opt-in)

Colyseus creates room instances, so constructor injection is not available by
default. Extend `NestRoom` and resolve providers from `onCreate` or handlers;
each room receives its own Nest context:

```ts
import { NestRoom } from 'nestjs-colyseus';
import { CharacterService } from '../character.service';

export class WorldRoom extends NestRoom {
  async onCreate() {
    const characters = await this.resolve(CharacterService);
    // use characters in handlers/onCreate
  }
}
```

Regular `Room` classes continue to work unchanged. The context is released
when Colyseus disposes the room. Keep this bridge opt-in and avoid storing
room-scoped providers globally.

### Nest-native message pipeline

Decorated message handlers can use Nest-style guards, pipes, and interceptors
without replacing Colyseus' room API. Enhancers may be provider classes/tokens
or already-created instances. Class-based enhancers are resolved through Nest;
scoped providers resolved for a room share that room's `ContextId`.

```ts
import { Client } from '@colyseus/core';
import {
  ColyseusExecutionContext,
  NestRoom,
  OnRoomMessage,
  RoomClient,
  RoomContext,
  RoomInstance,
  RoomMessageType,
  RoomPayload,
  UseRoomGuards,
  UseRoomInterceptors,
  UseRoomPipes,
} from 'nestjs-colyseus';

@UseRoomGuards(AuthGuard)
@UseRoomPipes(TrimPayloadPipe)
@UseRoomInterceptors(LoggingInterceptor)
export class ChatRoom extends NestRoom {
  @OnRoomMessage('chat')
  @UseRoomGuards(ChatGuard)
  async onChat(
    @RoomClient() client: Client,
    @RoomPayload(ParseChatPipe) payload: ChatPayload,
    @RoomInstance() room: ChatRoom,
    @RoomMessageType() type: string,
    @RoomContext() context: ColyseusExecutionContext,
  ) {
    const data = context.switchToWs().getData<ChatPayload>();
    const currentRoom = context.getRoom<ChatRoom>();
    client.send(type, { ...data, room: currentRoom === room });
  }
}

@Module({
  imports: [ColyseusModule.forFeature({ rooms: { chat: ChatRoom } })],
  providers: [AuthGuard, ChatGuard, TrimPayloadPipe, ParseChatPipe, LoggingInterceptor],
})
export class ChatModule {}
```

For each message, execution runs in this order: guards → class/method pipes →
parameter pipes (such as the local `ParseChatPipe`) → interceptor chain →
handler. `ColyseusExecutionContext` reports `getType() === 'ws'` and exposes
`switchToWs().getClient()`, `switchToWs().getData()`, `getRoom()`, and
`getData()` for transport-agnostic Nest code.

Nest exceptions are not converted into HTTP responses. A denied guard throws
`ForbiddenException`; handle or translate message errors in a room interceptor
when the client needs a protocol-specific error message.

## 3. Async configuration

Use `forRootAsync()` when options come from `ConfigService`, a secret manager,
or another Nest provider:

```ts
ColyseusModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    rooms: { lobby: LobbyRoom },
    publicAddress: config.getOrThrow('COLYSEUS_PUBLIC_ADDRESS'),
  }),
});
```

`useClass` and `useExisting` follow the standard NestJS dynamic-module contract.

## 4. Standalone Colyseus server

Use `mode: 'standalone'` when Colyseus should listen separately from the NestJS
HTTP API. The module owns and closes this listener.

```ts
ColyseusModule.forRoot({
  mode: 'standalone',
  host: '0.0.0.0',
  port: Number(process.env.COLYSEUS_PORT ?? 2567),
  publicAddress: process.env.PUBLIC_ADDRESS,
  rooms: { battle: BattleRoom },
});
```

Use a unique `publicAddress` for every game-server process. Your load balancer
or WebSocket proxy must support HTTP/1.1 upgrade and long-lived connections.

## 5. Redis multi-process deployment

Redis provides shared presence, room reservation, and matchmaking coordination.
Every game-server process must use the same Redis instance, register the same
room names, and expose a unique `publicAddress`.

```ts
import { RedisPresence } from '@colyseus/redis-presence';
import { RedisDriver } from '@colyseus/redis-driver';

const redis = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

ColyseusModule.forRoot({
  mode: 'standalone',
  port: Number(process.env.COLYSEUS_PORT ?? 2567),
  publicAddress: process.env.PUBLIC_ADDRESS,
  presence: new RedisPresence(redis),
  driver: new RedisDriver(redis),
  rooms: { battle: BattleRoom },
});
```

Start local Redis with:

```sh
docker compose -f docker-compose.redis.yml up -d redis
```

Configure Redis authentication, TLS, persistence, and HA/Cluster settings in
your deployment environment. Run independent processes or pods instead of
Node's `cluster` mode.

## 6. Standalone matchmaker

Run a dedicated Nest process with `isStandaloneMatchMaker: true`. It must use
the same Redis adapters and room definitions as every game server.

```ts
ColyseusModule.forRoot({
  mode: 'standalone',
  isStandaloneMatchMaker: true,
  port: Number(process.env.MATCHMAKER_PORT ?? 2567),
  presence: new RedisPresence(process.env.REDIS_URL),
  driver: new RedisDriver(process.env.REDIS_URL),
  rooms: { battle: BattleRoom },
});
```

Game servers omit `isStandaloneMatchMaker`, set a unique `publicAddress`, and
listen on their own WebSocket port. The matchmaker does not instantiate rooms,
but it still needs room definitions for `onAuth`, `filterBy`, and matchmaking.

See the runnable examples:

- [Standalone server](examples/standalone/README.md)
- [Redis multi-process](examples/redis-multi-process/README.md)
- [Standalone matchmaker](examples/standalone-matchmaker/README.md)
- [Deployment guide](docs/deployment.md)

## 7. Health and metrics

`ColyseusHealthService` is available through NestJS dependency injection:

```ts
@Controller('health')
export class HealthController {
  constructor(private readonly colyseus: ColyseusHealthService) {}

  @Get('colyseus')
  check() {
    return this.colyseus.check();
  }

  @Get('colyseus/metrics')
  metrics() {
    return this.colyseus.snapshot();
  }
}
```

`check()` returns the server state (`idle`, `starting`, `ready`, `draining`,
`stopping`, `stopped`, or `failed`), readiness, registered rooms, active rooms,
and CCU. Map readiness to traffic routing and liveness to process monitoring.
`snapshot()` is the local process metrics snapshot; `metrics()` remains as a
backwards-compatible alias.

### Optional Terminus integration

The package does not require `@nestjs/terminus`, but it exports a compatible
indicator when Terminus is already part of your application:

```ts
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ColyseusHealthIndicator } from 'nestjs-colyseus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly checks: HealthCheckService,
    private readonly colyseus: ColyseusHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.checks.check([
      () => this.colyseus.isHealthy('colyseus'),
    ]);
  }
}
```

`ColyseusHealthIndicator` returns the standard `{ [key]: { status, data } }`
shape and maps `ok` to `up`; not-ready, degraded, and draining states map to
`down`.

## 8. Production shutdown and proxy notes

- Call `app.enableShutdownHooks()`.
- In embedded mode Nest owns the HTTP server; the module does not close it.
- In standalone mode the module closes its own listener.
- Stop readiness and new traffic before terminating a process.
- Configure WebSocket upgrade headers and long read timeouts in the proxy.
- Fail fast on Redis or room-registry errors during startup.

## Compatibility

- Node.js 18.18+
- NestJS 10 or 11
- Colyseus 0.16.x (0.17 compatibility is not declared yet)
- Express and Fastify NestJS HTTP adapters

## Development and release checks

```sh
npm ci
npm run typecheck
npm test
npm run lint
npm run package:consumer
npm run pack:check
```

The package publishes only `dist`, `README.md`, and `LICENSE`. Redis adapters
and other peer dependencies are installed by the consuming application.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and
[CHANGELOG.md](CHANGELOG.md) for project policies and release history.

## License

MIT
