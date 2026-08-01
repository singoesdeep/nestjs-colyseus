import { ColyseusRoomRegistry } from '../src/room-registry';

describe('ColyseusRoomRegistry', () => {
  it('rejects duplicate and late room registrations', () => {
    const registry = new ColyseusRoomRegistry();
    const room = class Room {};

    registry.add('lobby', room);
    expect(() => registry.add('lobby', room)).toThrow('Duplicate Colyseus room');

    registry.freeze();
    expect(() => registry.add('battle', room)).toThrow('registration is closed');
  });

  it('registers a batch of rooms', () => {
    const registry = new ColyseusRoomRegistry();
    registry.addAll({ lobby: class Lobby {}, battle: class Battle {} });
    expect(registry.size).toBe(2);
  });
});
