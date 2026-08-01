import type { Server } from '@colyseus/core';
import type { Server as HttpServer } from 'node:http';

export type ColyseusMode = 'embedded' | 'standalone';

export interface ColyseusModuleOptions {
  rooms?: Record<string, unknown>;
  mode?: ColyseusMode;
  port?: number;
  host?: string;
  httpServer?: HttpServer;
  transport?: unknown;
  /** Additional options passed to Colyseus defineServer. */
  [key: string]: unknown;
}

export interface ColyseusModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  providers?: any[];
  useFactory?: (...args: any[]) => ColyseusModuleOptions | Promise<ColyseusModuleOptions>;
  useClass?: new (...args: any[]) => ColyseusOptionsFactory;
  useExisting?: new (...args: any[]) => ColyseusOptionsFactory;
}

export interface ColyseusOptionsFactory {
  createColyseusOptions(): ColyseusModuleOptions | Promise<ColyseusModuleOptions>;
}

export type ColyseusServer = Server;

