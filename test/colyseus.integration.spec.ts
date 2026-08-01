import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { matchMaker, Room } from '@colyseus/core';
import { ColyseusModule } from '../src';
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
});
