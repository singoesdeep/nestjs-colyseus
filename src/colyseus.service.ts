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

@Injectable()
export class ColyseusService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ColyseusService.name);
  private instance?: ColyseusServer;
  private ownedHttpServer?: HttpServer;
  private started = false;
  private stopping?: Promise<void>;

  get isStarted(): boolean { return this.started; }
  get isStopping(): boolean { return !!this.stopping; }
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
    if (this.started) return;
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
      this.instance = new ColyseusCoreServer({ gracefullyShutdown: false, ...serverOptions, transport } as any) as ColyseusServer;
      for (const [name, definition] of Object.entries(this.registry.entries())) {
        const server: any = this.instance;
        if (typeof server.define !== 'function') throw new ColyseusConfigurationError('Installed Colyseus core does not support room registration');
        const roomConstructor = this.moduleRef
          ? createNestRoomConstructor(definition.room, this.moduleRef)
          : definition.room;
        const handler = server.define(name, roomConstructor, definition.defaultOptions);
        if (definition.filterBy) handler.filterBy(definition.filterBy);
        if (definition.sortBy) handler.sortBy(definition.sortBy);
        if (definition.realtimeListing || definition.enableRealtimeListing) handler.enableRealtimeListing();
      }

      if (mode === 'standalone' && this.options.port !== undefined) {
        await this.instance.listen(this.options.port, this.options.host);
      }
      this.registry.freeze();
      this.started = true;
      this.logger.log(`Colyseus server started (${mode}) with ${this.registry.size} room(s)`);
    } catch (cause) {
      try {
        await this.cleanupInstance();
      } catch (cleanupError) {
        this.logger.error('Colyseus startup rollback failed', cleanupError);
      }
      this.registry.restore(previousRooms);
      throw cause instanceof ColyseusStartupError ? cause : new ColyseusStartupError('Colyseus server startup failed', { cause });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  async stop(): Promise<void> {
    if (!this.started || this.stopping) {
      if (this.stopping) await this.stopping;
      return;
    }
    this.stopping = (async () => {
      try {
        await this.cleanupInstance();
      } catch (error) {
        throw error instanceof ColyseusShutdownError ? error : new ColyseusShutdownError('Colyseus server shutdown failed', { cause: error });
      } finally {
        this.started = false;
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
    const server: any = this.instance;
    try {
      if (server?.gracefullyShutdown) await server.gracefullyShutdown(false);
      else if (server?.shutdown) await server.shutdown();
    } finally {
      if (this.ownedHttpServer?.listening) {
        await new Promise<void>((resolve, reject) => this.ownedHttpServer!.close(error => error ? reject(error) : resolve()));
      }
      this.instance = undefined;
      this.ownedHttpServer = undefined;
    }
  }
}
