import { ColyseusRoomRegistry } from '../src/room-registry';
import { Room } from '@colyseus/core';

describe('ColyseusRoomRegistry', () => {
  it('rejects duplicate and late room registrations', () => {
    const registry = new ColyseusRoomRegistry();
    const room = class TestRoom extends Room {};

    registry.add('lobby', room);
    expect(() => registry.add('lobby', room)).toThrow('Duplicate Colyseus room');

    registry.freeze();
    expect(() => registry.add('battle', room)).toThrow('registration is closed');
  });

  it('registers a batch of rooms', () => {
    const registry = new ColyseusRoomRegistry();
    registry.addAll({ lobby: class Lobby extends Room {}, battle: class Battle extends Room {} });
    expect(registry.size).toBe(2);
  });

  it('normalizes room constructors and preserves matchmaking options', () => {
    class BattleRoom extends Room {}
    const registry = new ColyseusRoomRegistry();
    registry.add('battle', {
      room: BattleRoom,
      defaultOptions: { map: 'arena' },
      filterBy: ['region'],
      sortBy: { clients: 1 },
      realtimeListing: true,
    });

    expect(registry.entries().battle).toEqual({
      room: BattleRoom,
      defaultOptions: { map: 'arena' },
      filterBy: ['region'],
      sortBy: { clients: 1 },
      realtimeListing: true,
    });
  });
});
