import { Injectable } from '@nestjs/common';
import { matchMaker } from '@colyseus/core';
import { ColyseusService } from './colyseus.service';
import { ColyseusRoomRegistry } from './room-registry';

export type ColyseusHealthStatus = 'ok' | 'not_ready' | 'draining';
export interface ColyseusHealthSnapshot {
  status: ColyseusHealthStatus;
  ready: boolean;
  started: boolean;
  draining: boolean;
  mode?: string;
  registeredRooms: number;
  roomCount: number;
  ccu: number;
  checkedAt: string;
}

export interface ColyseusMetricsSnapshot {
  roomCount: number;
  ccu: number;
  registeredRooms: number;
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
    return {
      status: draining ? 'draining' : started ? 'ok' : 'not_ready',
      ready: started && !draining,
      started,
      draining,
      mode: this.colyseus.mode,
      registeredRooms: this.registry.size,
      roomCount: stats.roomCount,
      ccu: stats.ccu,
      checkedAt: new Date().toISOString(),
    };
  }

  async metrics(): Promise<ColyseusMetricsSnapshot> {
    const stats = this.readStats();
    return { ...stats, registeredRooms: this.registry.size, capturedAt: new Date().toISOString() };
  }

  private readStats(): { roomCount: number; ccu: number } {
    try { return { roomCount: matchMaker.stats.local.roomCount, ccu: matchMaker.stats.local.ccu }; }
    catch { return { roomCount: 0, ccu: 0 }; }
  }
}
