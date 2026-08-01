# Redis multi-process deployment

Start Redis locally with:

```sh
docker compose -f docker-compose.redis.yml up -d redis
```

Install the Colyseus Redis adapters that match your Colyseus version:

```sh
npm install @colyseus/redis-presence @colyseus/redis-driver
```

Pass the adapters through the module options. This package forwards unknown
options to Colyseus, so no adapter wrapper is needed:

```ts
import { RedisPresence } from '@colyseus/redis-presence';
import { RedisDriver } from '@colyseus/redis-driver';

ColyseusModule.forRoot({
  mode: 'standalone',
  port: Number(process.env.COLYSEUS_PORT ?? 2567),
  publicAddress: process.env.PUBLIC_ADDRESS,
  presence: new RedisPresence({ url: process.env.REDIS_URL }),
  driver: new RedisDriver({ url: process.env.REDIS_URL }),
  rooms: { battle: BattleRoom },
});
```

Every game-server process must register the same room names and use a unique
`publicAddress`. Do not use Node's cluster mode; run independent processes (or
pods) and let Colyseus matchmaking distribute rooms.
