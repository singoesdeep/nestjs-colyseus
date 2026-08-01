import 'reflect-metadata';
import { jest } from '@jest/globals';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { RedisPresence } from '@colyseus/redis-presence';
import { RedisDriver } from '@colyseus/redis-driver';
import { ColyseusModule } from '../src';
import { TestRoom } from './fixtures/test-room';

const redisUrl = process.env.REDIS_URL;

(redisUrl ? describe : describe.skip)('Redis integration', () => {
  jest.setTimeout(30_000);

  it('boots and shuts down with Redis presence and driver', async () => {
    @Module({
      imports: [
        ColyseusModule.forRoot({
          mode: 'standalone',
          port: 0,
          publicAddress: '127.0.0.1:0',
          presence: new RedisPresence(redisUrl),
          driver: new RedisDriver(redisUrl),
          rooms: { test: TestRoom },
        }),
      ],
    })
    class AppModule {}

    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    await app.close();
  });
});
