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
    expect(service.state).toBe('failed');
  });

  it('exposes a stable initial state and compatibility flags', () => {
    const service = new ColyseusService(
      { mode: 'standalone', port: 2567 },
      new ColyseusRoomRegistry(),
      {} as any,
    );
    expect(service.state).toBe('idle');
    expect(service.isStarted).toBe(false);
    expect(service.isStopping).toBe(false);
  });

  it('rejects restart after the server has stopped', async () => {
    const service = new ColyseusService(
      { mode: 'standalone', port: 2567 },
      new ColyseusRoomRegistry(),
      {} as any,
    );
    (service as any).stateValue = 'stopped';
    await expect(service.start()).rejects.toThrow('cannot be restarted');
  });
});
