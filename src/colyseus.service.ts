import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { HttpAdapterHost, ModuleRef } from '@nestjs/core';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as ColyseusCoreServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { MODULE_OPTIONS_TOKEN } from './colyseus.module-definition';
import type { ColyseusModuleOptions, ColyseusServer } from './colyseus-options';
import { ColyseusRoomRegistry } from './room-registry';
import { ColyseusConfigurationError, ColyseusShutdownError, ColyseusStartupError } from './colyseus.errors';
import { createNestRoomConstructor } from './nest-room';

export type ColyseusServerState = 'idle' | 'starting' | 'ready' | 'draining' | 'stopping' | 'stopped' | 'failed';

@Injectable()
export class ColyseusService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ColyseusService.name);
  private instance?: ColyseusServer;
  private ownedHttpServer?: HttpServer;
  private stateValue: ColyseusServerState = 'idle';
  private startPromise?: Promise<void>;
  private stopping?: Promise<void>;

  get state(): ColyseusServerState { return this.stateValue; }
  get isStarted(): boolean { return this.stateValue === 'ready'; }
  get isStopping(): boolean { return this.stateValue === 'draining' || this.stateValue === 'stopping'; }
  get mode(): string | undefined { return this.options.mode ?? 'embedded'; }

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private readonly options: ColyseusModuleOptions,
    private readonly registry: ColyseusRoomRegistry,
    private readonly adapterHost: HttpAdapterHost,
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {}

  get server(): ColyseusServer {
    if (!this.instance) throw new Error('Colyseus server has not started');
    return this.instance;
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.start();
  }

  async start(): Promise<void> {
    if (this.stateValue === 'ready') return;
    if (this.stateValue === 'starting' && this.startPromise) return this.startPromise;
    if (this.stateValue === 'stopped') {
      throw new ColyseusStartupError('A stopped Colyseus server cannot be restarted; create a new Nest application instance');
    }
    if (this.isStopping) throw new ColyseusStartupError('Cannot start while Colyseus server is stopping');
    this.stateValue = 'starting';
    this.startPromise = this.startInternal();
    try { await this.startPromise; } finally { this.startPromise = undefined; }
  }

  private async startInternal(): Promise<void> {
    const previousRooms = this.registry.entries();
    let mode = this.options.mode ?? 'embedded';
    try {
      if (mode !== 'embedded' && mode !== 'standalone') {
        throw new ColyseusConfigurationError(`Unsupported Colyseus mode: ${mode}`);
      }
      if (mode === 'standalone' && this.options.port === undefined && !this.options.httpServer && !this.options.transport) {
        throw new ColyseusConfigurationError('Standalone mode requires port, httpServer, or transport');
      }

      this.registry.addAll(this.options.rooms);
      let httpServer = this.options.httpServer;
      if (mode === 'embedded') {
        httpServer ??= this.adapterHost.httpAdapter?.getHttpServer?.();
        if (!httpServer) throw new ColyseusConfigurationError('Embedded Colyseus mode requires a Nest HTTP server');
      } else if (!httpServer) {
        httpServer = createServer();
        this.ownedHttpServer = httpServer;
      }

      const transport = this.options.transport ?? new WebSocketTransport({ server: httpServer });
      const { mode: _mode, port: _port, host: _host, httpServer: _http, transport: _transport, rooms: _rooms, ...serverOptions } = this.options;
      this.instance = new ColyseusCoreServer({ gracefullyShutdown: false, ...serverOptions, transport });
      for (const [name, definition] of Object.entries(this.registry.entries())) {
        const roomConstructor = this.moduleRef
          ? createNestRoomConstructor(definition.room, this.moduleRef)
          : definition.room;
        const handler = this.instance.define(name, roomConstructor, definition.defaultOptions);
        if (definition.filterBy?.length) handler.filterBy(definition.filterBy);
        if (definition.sortBy) handler.sortBy(definition.sortBy);
        if (definition.realtimeListing || definition.enableRealtimeListing) handler.enableRealtimeListing();
      }

      if (mode === 'standalone' && this.options.port !== undefined) {
        await this.instance.listen(this.options.port, this.options.host);
      }
      this.registry.freeze();
      this.stateValue = 'ready';
      this.logger.log(`Colyseus server started (${mode}) with ${this.registry.size} room(s)`);
    } catch (cause) {
      try {
        await this.cleanupInstance();
      } catch (cleanupError) {
        this.logger.error('Colyseus startup rollback failed', cleanupError);
      }
      this.registry.restore(previousRooms);
      this.stateValue = 'failed';
      throw cause instanceof ColyseusStartupError ? cause : new ColyseusStartupError('Colyseus server startup failed', { cause });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  async stop(): Promise<void> {
    if (this.stateValue === 'starting' && this.startPromise) await this.startPromise.catch(() => undefined);
    if (this.stateValue === 'idle' || this.stateValue === 'stopped' || this.stateValue === 'failed' || this.stopping) {
      if (this.stopping) await this.stopping;
      return;
    }
    if (this.stateValue === 'ready') this.stateValue = 'draining';
    this.stateValue = 'stopping';
    this.stopping = (async () => {
      try {
        await this.cleanupInstance();
      } catch (error) {
        this.stateValue = 'failed';
        throw error instanceof ColyseusShutdownError ? error : new ColyseusShutdownError('Colyseus server shutdown failed', { cause: error });
      } finally {
        if (this.stateValue !== 'failed') this.stateValue = 'stopped';
        this.instance = undefined;
        this.ownedHttpServer = undefined;
        this.stopping = undefined;
      }
    })();
    await this.stopping;
  }

  async drain(): Promise<void> {
    await this.stop();
  }

  private async cleanupInstance(): Promise<void> {
    try {
      await this.instance?.gracefullyShutdown(false);
    } finally {
      if (this.ownedHttpServer?.listening) {
        await new Promise<void>((resolve, reject) => this.ownedHttpServer!.close(error => error ? reject(error) : resolve()));
      }
      this.instance = undefined;
      this.ownedHttpServer = undefined;
    }
  }
}
