import { ColyseusService } from '../src/colyseus.service';
import { ColyseusRoomRegistry } from '../src/room-registry';

describe('ColyseusService lifecycle validation', () => {
  it('rejects a standalone server with no listener configuration', async () => {
    const service = new ColyseusService(
      { mode: 'standalone' },
      new ColyseusRoomRegistry(),
      {} as any,
    );

    await expect(service.start()).rejects.toMatchObject({
      name: 'ColyseusStartupError',
      code: 'COLYSEUS_STARTUP_ERROR',
    });
    expect(service.isStarted).toBe(false);
  });
});
