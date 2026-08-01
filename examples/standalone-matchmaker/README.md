# Standalone matchmaker

Run a dedicated Nest process with `isStandaloneMatchMaker: true`. It must use
the same Redis presence/driver and room definitions as every game server.

```ts
ColyseusModule.forRoot({
  mode: 'standalone',
  isStandaloneMatchMaker: true,
  port: Number(process.env.MATCHMAKER_PORT ?? 2567),
  presence: new RedisPresence({ url: process.env.REDIS_URL }),
  driver: new RedisDriver({ url: process.env.REDIS_URL }),
  rooms: { battle: BattleRoom },
});
```

Game-server processes omit `isStandaloneMatchMaker`, set a unique
`publicAddress`, and expose their WebSocket port. Deploy the matchmaker and
game servers independently; Redis is the shared coordination layer.
