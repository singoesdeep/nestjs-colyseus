import 'reflect-metadata';
import { Room } from '@colyseus/core';
import { ColyseusRoom, OnRoomMessage, getColyseusMessageMetadata, getRoomEnhancerMetadata, getRoomParameterMetadata, RoomClient, RoomPayload, UseRoomGuards, UseRoomInterceptors, UseRoomPipes } from '../src/colyseus.decorators';
import { ColyseusRoomRegistry } from '../src/room-registry';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ColyseusModule } from '../src/colyseus.module';
import type { CanActivate, ExecutionContext, CallHandler, NestInterceptor, PipeTransform, ArgumentMetadata } from '@nestjs/common';
import type { Observable } from 'rxjs';

describe('Colyseus decorators', () => {
  it('registers room metadata and resolves array feature registrations', () => {
    @ColyseusRoom({ name: 'battle', defaultOptions: { map: 'arena' } })
    class BattleRoom extends Room {}
    const registry = new ColyseusRoomRegistry();
    registry.addAll([BattleRoom]);
    expect(registry.entries().battle.defaultOptions).toEqual({ map: 'arena' });
  });

  it('rejects duplicate message types', () => {
    expect(() => {
      class ChatRoom extends Room {
        @OnRoomMessage('chat') first() {}
        @OnRoomMessage('chat') second() {}
      }
      getColyseusMessageMetadata(ChatRoom);
    }).toThrow('Duplicate Colyseus room message handler');
  });

  it('rejects duplicate forRoot registrations per Nest container', async () => {
    @Module({ imports: [ColyseusModule.forRoot({}), ColyseusModule.forRoot({})] })
    class DuplicateRootModule {}
    await expect(NestFactory.create(DuplicateRootModule, { logger: false, abortOnError: false }))
      .rejects.toThrow('already been registered');
  });

  it('merges class and method enhancer metadata in order', () => {
    class Guard implements CanActivate { canActivate(_context: ExecutionContext) { return true; } }
    class Pipe implements PipeTransform { transform(value: unknown, _metadata: ArgumentMetadata) { return value; } }
    class Interceptor implements NestInterceptor { intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> { return next.handle(); } }
    @UseRoomGuards(Guard)
    @UseRoomPipes(Pipe)
    class EnhancedRoom extends Room {
      @UseRoomInterceptors(Interceptor)
      onMessage(@RoomClient() _client: unknown, @RoomPayload() _payload: unknown) {}
    }
    expect(getRoomEnhancerMetadata(EnhancedRoom, 'onMessage')).toEqual({
      guards: [Guard], pipes: [Pipe], interceptors: [Interceptor],
    });
    expect(getRoomParameterMetadata(EnhancedRoom, 'onMessage')).toEqual([
      { index: 0, kind: 'client', metatype: Object },
      { index: 1, kind: 'payload', metatype: Object },
    ]);
  });

});
