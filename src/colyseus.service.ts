import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as ColyseusCoreServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { MODULE_OPTIONS_TOKEN } from './colyseus.module-definition';
import type { ColyseusModuleOptions, ColyseusServer } from './colyseus-options';
import { ColyseusRoomRegistry } from './room-registry';
import { ColyseusConfigurationError, ColyseusShutdownError } from './colyseus.errors';

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
  ) {}

  get server(): ColyseusServer {
    if (!this.instance) throw new Error('Colyseus server has not started');
    return this.instance;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.started) return;
    const mode = this.options.mode ?? 'embedded';
    if (mode !== 'embedded' && mode !== 'standalone') throw new ColyseusConfigurationError(`Unsupported Colyseus mode: ${mode}`);
    this.registry.addAll(this.options.rooms);
    this.registry.freeze();

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
      if (typeof server.define !== 'function') throw new Error('Installed Colyseus core does not support room registration');
      server.define(name, definition as any);
    }

    if (mode === 'standalone' && this.options.port !== undefined) {
      await this.instance.listen(this.options.port, this.options.host);
    }
    this.started = true;
    this.logger.log(`Colyseus server started (${mode}) with ${this.registry.size} room(s)`);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.started || this.stopping) return this.stopping;
    this.stopping = (async () => {
      try {
        const server: any = this.instance;
        if (server?.gracefullyShutdown) await server.gracefullyShutdown(false);
        else if (server?.shutdown) await server.shutdown();
        if (this.ownedHttpServer?.listening) await new Promise<void>((resolve) => this.ownedHttpServer!.close(() => resolve()));
      } catch (error) {
        throw error instanceof ColyseusShutdownError ? error : new ColyseusShutdownError('Colyseus server shutdown failed', { cause: error });
      } finally {
        this.started = false;
        this.instance = undefined;
        this.ownedHttpServer = undefined;
        this.stopping = undefined;
      }
    })();
    return this.stopping;
  }
}
