import { ColyseusHealthIndicator } from '../src/colyseus-health.indicator';

describe('ColyseusHealthIndicator', () => {
  it('returns the Terminus indicator shape', async () => {
    const indicator = new ColyseusHealthIndicator({
      check: async () => ({ status: 'ok', ready: true }),
    } as any);

    await expect(indicator.isHealthy('game')).resolves.toMatchObject({
      game: { status: 'up', data: { status: 'ok', ready: true } },
    });
  });

  it('marks non-ready states down', async () => {
    const indicator = new ColyseusHealthIndicator({
      check: async () => ({ status: 'degraded', ready: false }),
    } as any);

    await expect(indicator.isHealthy()).resolves.toMatchObject({
      colyseus: { status: 'down', data: { status: 'degraded' } },
    });
  });
});
