import { Injectable } from '@nestjs/common';
import { matchMaker } from '@colyseus/core';
import { ColyseusService } from './colyseus.service';
import { ColyseusRoomRegistry } from './room-registry';

export type ColyseusHealthStatus = 'ok' | 'degraded' | 'not_ready' | 'draining';
export interface ColyseusHealthSnapshot {
  state: ColyseusService['state'];
  status: ColyseusHealthStatus;
  ready: boolean;
  started: boolean;
  draining: boolean;
  mode?: string;
  registeredRooms: number;
  roomCount: number;
  ccu: number;
  statsAvailable: boolean;
  error?: { code: 'COLYSEUS_STATS_UNAVAILABLE' };
  checkedAt: string;
}

export interface ColyseusMetricsSnapshot {
  roomCount: number;
  ccu: number;
  registeredRooms: number;
  statsAvailable: boolean;
  capturedAt: string;
}

@Injectable()
export class ColyseusHealthService {
  constructor(private readonly colyseus: ColyseusService, private readonly registry: ColyseusRoomRegistry) {}

  isReady(): boolean { return this.colyseus.isStarted && !this.colyseus.isStopping; }

  async check(): Promise<ColyseusHealthSnapshot> {
    const stats = this.readStats();
    const started = this.colyseus.isStarted;
    const draining = this.colyseus.isStopping;
    const state = this.colyseus.state;
    return {
      status: draining ? 'draining' : !started ? 'not_ready' : stats.available ? 'ok' : 'degraded',
      state,
      ready: started && !draining && stats.available,
      started,
      draining,
      mode: this.colyseus.mode,
      registeredRooms: this.registry.size,
      roomCount: stats.roomCount,
      ccu: stats.ccu,
      statsAvailable: stats.available,
      ...(stats.available ? {} : { error: { code: 'COLYSEUS_STATS_UNAVAILABLE' as const } }),
      checkedAt: new Date().toISOString(),
    };
  }

  async metrics(): Promise<ColyseusMetricsSnapshot> {
    return this.snapshot();
  }

  async snapshot(): Promise<ColyseusMetricsSnapshot> {
    const stats = this.readStats();
    return { roomCount: stats.roomCount, ccu: stats.ccu, statsAvailable: stats.available, registeredRooms: this.registry.size, capturedAt: new Date().toISOString() };
  }

  private readStats(): { roomCount: number; ccu: number; available: boolean } {
    try {
      const local = matchMaker.stats.local;
      return { roomCount: local.roomCount, ccu: local.ccu, available: true };
    } catch {
      return { roomCount: 0, ccu: 0, available: false };
    }
  }
}
