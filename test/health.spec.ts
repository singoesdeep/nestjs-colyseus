import { ColyseusHealthService } from '../src/colyseus-health.service';

describe('ColyseusHealthService', () => {
  it('reports readiness and metrics without exposing internals', async () => {
    const service = new ColyseusHealthService(
      { isStarted: true, isStopping: false, mode: 'embedded' } as any,
      { size: 2 } as any,
    );
    const health = await service.check();
    expect(health).toMatchObject({ status: 'ok', ready: true, mode: 'embedded', registeredRooms: 2 });
    expect(typeof health.checkedAt).toBe('string');
    expect(await service.metrics()).toMatchObject({ registeredRooms: 2 });
  });

  it('marks a stopping server as draining', async () => {
    const service = new ColyseusHealthService(
      { isStarted: true, isStopping: true, mode: 'standalone' } as any,
      { size: 0 } as any,
    );
    await expect(service.check()).resolves.toMatchObject({ status: 'draining', ready: false, draining: true });
  });
});
