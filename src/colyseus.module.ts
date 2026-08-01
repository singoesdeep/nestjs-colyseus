import { DynamicModule, Global, Inject, Injectable, Module, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigurableModuleClass } from './colyseus.module-definition';
import { ColyseusService } from './colyseus.service';
import { ColyseusRoomRegistry } from './room-registry';
import type { ColyseusModuleAsyncOptions, ColyseusModuleOptions, ColyseusRoomRegistrations } from './colyseus-options';
import { ColyseusHealthService } from './colyseus-health.service';
import { ColyseusHealthIndicator } from './colyseus-health.indicator';

const FEATURE_OPTIONS = Symbol('COLYSEUS_FEATURE_OPTIONS');
const ROOT_CONTAINERS = new WeakSet<object>();

@Injectable()
class ColyseusRootGuard {
  constructor(moduleRef: ModuleRef) {
    const container = (moduleRef as ModuleRef & { container?: object }).container;
    if (container && ROOT_CONTAINERS.has(container)) {
      throw new Error('ColyseusModule.forRoot() has already been registered in this Nest container. Use forFeature() for additional rooms.');
    }
    if (container) ROOT_CONTAINERS.add(container);
  }
}

@Injectable()
class ColyseusFeatureRegistrar implements OnModuleInit {
  constructor(
    @Inject(FEATURE_OPTIONS) private readonly options: { rooms?: ColyseusRoomRegistrations },
    private readonly registry: ColyseusRoomRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.addAll(this.options.rooms ?? {});
  }
}

@Global()
@Module({ providers: [ColyseusRoomRegistry, ColyseusService, ColyseusHealthService, ColyseusHealthIndicator], exports: [ColyseusService, ColyseusRoomRegistry, ColyseusHealthService, ColyseusHealthIndicator] })
export class ColyseusModule extends ConfigurableModuleClass {
  static forRoot(options: ColyseusModuleOptions): DynamicModule {
    const dynamic = super.forRoot(options) as DynamicModule;
    return { ...dynamic, providers: [...(dynamic.providers ?? []), ColyseusRootGuard] };
  }

  static forRootAsync(options: ColyseusModuleAsyncOptions): DynamicModule {
    const dynamic = super.forRootAsync(options) as DynamicModule;
    return { ...dynamic, providers: [...(dynamic.providers ?? []), ColyseusRootGuard] };
  }

  static forFeature(options: { rooms: ColyseusRoomRegistrations }): DynamicModule {
    @Module({})
    class ColyseusFeatureModule {}

    return {
      module: ColyseusFeatureModule,
      providers: [
        { provide: FEATURE_OPTIONS, useValue: options },
        ColyseusFeatureRegistrar,
      ],
    };
  }
}
