# Standalone game server

Use standalone mode when the Colyseus listener should be separate from Nest's
HTTP listener. The module owns the listener and closes it with the Nest app.

```ts
import { Module } from '@nestjs/common';
import { ColyseusModule } from 'nestjs-colyseus';
import { BattleRoom } from './battle.room';

@Module({
  imports: [
    ColyseusModule.forRoot({
      mode: 'standalone',
      host: process.env.HOST ?? '0.0.0.0',
      port: Number(process.env.COLYSEUS_PORT ?? 2567),
      publicAddress: process.env.PUBLIC_ADDRESS,
      rooms: { battle: BattleRoom },
    }),
  ],
})
export class AppModule {}
```

Call `app.enableShutdownHooks()` in `main.ts`. Put a reverse proxy or load
balancer in front of the public WebSocket address and use a stable address per
process when running more than one server.
