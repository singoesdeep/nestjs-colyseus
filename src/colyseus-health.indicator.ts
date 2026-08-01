import { Injectable } from '@nestjs/common';
import { ColyseusHealthService, ColyseusHealthSnapshot } from './colyseus-health.service';

export type TerminusIndicatorStatus = 'up' | 'down';

export interface ColyseusTerminusIndicator {
  status: TerminusIndicatorStatus;
  data: ColyseusHealthSnapshot;
}

/**
 * Terminus-compatible indicator without a hard dependency on @nestjs/terminus.
 * Use it directly in HealthCheckService.check(() => indicator.isHealthy('colyseus')).
 */
@Injectable()
export class ColyseusHealthIndicator {
  constructor(private readonly health: ColyseusHealthService) {}

  async isHealthy(key = 'colyseus'): Promise<Record<string, ColyseusTerminusIndicator>> {
    const snapshot = await this.health.check();
    const status: TerminusIndicatorStatus = snapshot.status === 'ok' ? 'up' : 'down';
    return { [key]: { status, data: snapshot } };
  }
}
