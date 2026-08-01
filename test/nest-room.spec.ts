import { Room } from '@colyseus/core';
import { NestRoom, createNestRoomConstructor } from '../src/nest-room';

class Service {}

class TestRoom extends NestRoom {
  async getService(): Promise<Service> {
    return this.resolve(Service);
  }
}

class PlainRoom extends Room {}

describe('NestRoom bridge', () => {
  it('resolves providers through an isolated Nest context', async () => {
    const service = new Service();
    const moduleRef = {
      resolve: jest.fn().mockResolvedValue(service),
    } as any;
    const RoomConstructor = createNestRoomConstructor(TestRoom, moduleRef);
    const room = new RoomConstructor() as TestRoom;

    await expect(room.getService()).resolves.toBe(service);
    await expect(room.getService()).resolves.toBe(service);
    expect(moduleRef.resolve).toHaveBeenCalledTimes(1);
  });

  it('leaves regular Colyseus rooms untouched', () => {
    const moduleRef = { resolve: jest.fn() } as any;
    expect(createNestRoomConstructor(PlainRoom, moduleRef)).toBe(PlainRoom);
  });
});
