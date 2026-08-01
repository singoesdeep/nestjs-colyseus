import 'reflect-metadata';
import { Injectable, Module, type ArgumentMetadata, type CallHandler, type ExecutionContext, type NestInterceptor, type PipeTransform } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { matchMaker, Room, type Client as ServerClient } from '@colyseus/core';
import { Client } from 'colyseus.js';
import { tap, type Observable } from 'rxjs';
import {
  ColyseusExecutionContext,
  ColyseusModule,
  ColyseusService,
  OnRoomMessage,
  RoomClient,
  RoomContext,
  RoomInstance,
  RoomMessageType,
  RoomPayload,
  UseRoomGuards,
  UseRoomInterceptors,
  UseRoomPipes,
} from '../src';
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
    const events: string[] = [];

    @Injectable()
    class EchoGuard {
      canActivate(context: ExecutionContext): boolean {
        events.push('guard');
        return context.getType() === 'ws' && context.switchToWs().getPattern() === 'echo';
      }
    }

    @Injectable()
    class GlobalPayloadPipe implements PipeTransform {
      static metadata?: ArgumentMetadata;

      transform(value: string, metadata: ArgumentMetadata): string {
        events.push('global-pipe');
        GlobalPayloadPipe.metadata = metadata;
        return `${value}:global`;
      }
    }

    @Injectable()
    class LocalPayloadPipe implements PipeTransform {
      transform(value: string): string {
        events.push('local-pipe');
        return `${value}:local`;
      }
    }

    @Injectable()
    class EchoInterceptor implements NestInterceptor {
      async intercept(_context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
        events.push('interceptor-before');
        return next.handle().pipe(tap(() => events.push('interceptor-after')));
      }
    }

    @UseRoomGuards(EchoGuard)
    @UseRoomPipes(GlobalPayloadPipe)
    class EchoRoom extends Room {
      static contextVerified = false;

      @OnRoomMessage('echo')
      @UseRoomInterceptors(EchoInterceptor)
      onEcho(
        @RoomClient() client: ServerClient,
        @RoomPayload(LocalPayloadPipe) message: string,
        @RoomMessageType() type: string | number,
        @RoomInstance() room: EchoRoom,
        @RoomContext() context: ColyseusExecutionContext,
      ): void {
        events.push('handler');
        EchoRoom.contextVerified = type === 'echo'
          && room === this
          && context.getRoom() === this
          && context.getData() === 'hello:global';
        client.send('echo', message);
      }
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
      providers: [EchoGuard, GlobalPayloadPipe, LocalPayloadPipe, EchoInterceptor],
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
      await expect(received).resolves.toBe('hello:global:local');
      expect(EchoRoom.contextVerified).toBe(true);
      expect(GlobalPayloadPipe.metadata).toMatchObject({ type: 'custom', data: 'payload', metatype: String });
      expect(events).toEqual([
        'guard',
        'global-pipe',
        'local-pipe',
        'interceptor-before',
        'handler',
        'interceptor-after',
      ]);
    } finally {
      await room?.leave();
      await app.close();
    }
  }, 15_000);
});
