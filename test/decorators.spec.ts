import 'reflect-metadata';
import { Room } from '@colyseus/core';
import { ColyseusRoom, OnRoomMessage, getColyseusMessageMetadata } from '../src/colyseus.decorators';
import { ColyseusRoomRegistry } from '../src/room-registry';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ColyseusModule } from '../src/colyseus.module';

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

});
