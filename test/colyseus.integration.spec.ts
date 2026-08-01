import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { matchMaker, Room } from '@colyseus/core';
import { Client } from 'colyseus.js';
import { ColyseusModule, ColyseusService, OnRoomMessage } from '../src';
import { TestRoom } from './fixtures/test-room';

describe('ColyseusModule', () => {
  it('boots in embedded mode and closes with Nest', async () => {
    @Module({
      imports: [ColyseusModule.forRoot({ rooms: { test: TestRoom } })],
    })
    class AppModule {}

    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    await app.close();
  });

  it('registers a constructor and creates a real room', async () => {
    @Module({
      imports: [ColyseusModule.forRoot({ rooms: { created: TestRoom } })],
    })
    class AppModule {}

    const app = await NestFactory.create(AppModule, { logger: false });
    try {
      await app.init();
      const room = await matchMaker.createRoom('created', {});
      expect(room.name).toBe('created');
    } finally {
      await app.close();
    }
  });

  it('applies descriptor options to the registered handler', async () => {
    class ConfiguredRoom extends Room {
      static options?: Record<string, unknown>;
      onCreate(options: Record<string, unknown>) {
        ConfiguredRoom.options = options;
      }
    }

    @Module({
      imports: [
        ColyseusModule.forRoot({
          rooms: {
            configured: {
              room: ConfiguredRoom,
              defaultOptions: { map: 'arena' },
              filterBy: ['region'],
              sortBy: { clients: 1 },
              realtimeListing: true,
            },
          },
        }),
      ],
    })
    class AppModule {}

    const app = await NestFactory.create(AppModule, { logger: false });
    try {
      await app.init();
      const handler = matchMaker.getHandler('configured');
      expect(handler.filterOptions).toEqual(['region']);
      expect(handler.sortOptions).toEqual({ clients: 1 });
      expect(handler.listenerCount('create')).toBeGreaterThan(0);

      await matchMaker.createRoom('configured', { region: 'eu' });
      expect(ConfiguredRoom.options).toMatchObject({ map: 'arena', region: 'eu' });
    } finally {
      await app.close();
    }
  });

  it('accepts a real client, exchanges a message, and cleans up in standalone mode', async () => {
    class EchoRoom extends Room {
      @OnRoomMessage('echo')
      onEcho(client: { send: (type: string, message: string) => void }, message: string) { client.send('echo', message); }
    }

    @Module({
      imports: [
        ColyseusModule.forRoot({
          mode: 'standalone',
          host: '127.0.0.1',
          port: 0,
          rooms: { echo: EchoRoom },
        }),
      ],
    })
    class AppModule {}

    const app = await NestFactory.create(AppModule, { logger: false });
    let room: Awaited<ReturnType<Client['joinOrCreate']>> | undefined;
    try {
      await app.init();
      const server = app.get(ColyseusService).server;
      const address = (server.transport.server as import('node:http').Server).address();
      if (!address || typeof address === 'string') throw new Error('Standalone server did not expose a listening address');

      const client = new Client(`ws://127.0.0.1:${address.port}`);
      room = await client.joinOrCreate('echo');
      const received = new Promise<string>((resolve) => room!.onMessage('echo', resolve));
      room.send('echo', 'hello');
      await expect(received).resolves.toBe('hello');
    } finally {
      await room?.leave();
      await app.close();
    }
  }, 15_000);
});
