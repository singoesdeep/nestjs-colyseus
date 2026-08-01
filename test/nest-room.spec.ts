import { Room } from '@colyseus/core';
import { NestRoom, createNestRoomConstructor } from '../src/nest-room';
import { OnRoomMessage } from '../src/colyseus.decorators';

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

  it('wraps plain Colyseus rooms when message decorators are present', () => {
    class DecoratedPlainRoom extends Room {
      @OnRoomMessage('ping') onPing() {}
    }
    const moduleRef = { resolve: jest.fn() } as any;
    expect(createNestRoomConstructor(DecoratedPlainRoom, moduleRef)).not.toBe(DecoratedPlainRoom);
  });

  it('binds decorated message handlers on room creation', async () => {
    class MessageRoom extends NestRoom {
      received?: unknown[];
      @OnRoomMessage('chat') onChat(client: unknown, payload: unknown) { this.received = [client, payload]; }
    }
    const RoomConstructor = createNestRoomConstructor(MessageRoom, {} as any);
    const room = new RoomConstructor() as MessageRoom;
    const handlers = new Map<string | number, (client: unknown, payload: unknown) => void>();
    (room as any).onMessage = (type: string | number, handler: (client: unknown, payload: unknown) => void) => handlers.set(type, handler);
    await (room as any).onCreate();
    handlers.get('chat')?.('client', { text: 'hello' });
    expect(room.received).toEqual(['client', { text: 'hello' }]);
  });
});
