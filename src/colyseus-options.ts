import type { Room, Server, ServerOptions, Transport } from '@colyseus/core';
import type { Server as HttpServer } from 'node:http';

export type ColyseusMode = 'embedded' | 'standalone';

export type ColyseusRoomConstructor<TRoom extends Room = Room> = new (...args: any[]) => TRoom;
export type ColyseusSortOptions = Record<string, 1 | -1>;

/** Explicit room registration options. A constructor alone remains supported. */
export interface ColyseusRoomDefinition<TRoom extends Room = Room> {
  room: ColyseusRoomConstructor<TRoom>;
  defaultOptions?: Record<string, unknown>;
  filterBy?: string[];
  sortBy?: ColyseusSortOptions;
  /** Enable Colyseus realtime room listing for this room type. */
  realtimeListing?: boolean;
  /** Alias for realtimeListing, matching Colyseus' handler method name. */
  enableRealtimeListing?: boolean;
}

export type ColyseusRoomRegistration =
  | ColyseusRoomConstructor
  | ColyseusRoomDefinition;

export type ColyseusRoomRegistrations = Record<string, ColyseusRoomRegistration> | ColyseusRoomRegistration[];

export interface ColyseusModuleOptions extends Omit<ServerOptions, 'transport'> {
  rooms?: Record<string, ColyseusRoomRegistration>;
  mode?: ColyseusMode;
  port?: number;
  host?: string;
  httpServer?: HttpServer;
  transport?: Transport;
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
