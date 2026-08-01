import { DynamicModule, Global, Inject, Injectable, Module, OnModuleInit } from '@nestjs/common';
import { ConfigurableModuleClass } from './colyseus.module-definition';
import { ColyseusService } from './colyseus.service';
import { ColyseusRoomRegistry } from './room-registry';
import type { ColyseusModuleOptions } from './colyseus-options';
import { ColyseusHealthService } from './colyseus-health.service';
import { ColyseusHealthIndicator } from './colyseus-health.indicator';

const FEATURE_OPTIONS = Symbol('COLYSEUS_FEATURE_OPTIONS');

@Injectable()
class ColyseusFeatureRegistrar implements OnModuleInit {
  constructor(
    @Inject(FEATURE_OPTIONS) private readonly options: Pick<ColyseusModuleOptions, 'rooms'>,
    private readonly registry: ColyseusRoomRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.addAll(this.options.rooms);
  }
}

@Global()
@Module({ providers: [ColyseusRoomRegistry, ColyseusService, ColyseusHealthService, ColyseusHealthIndicator], exports: [ColyseusService, ColyseusRoomRegistry, ColyseusHealthService, ColyseusHealthIndicator] })
export class ColyseusModule extends ConfigurableModuleClass {
  static forFeature(options: Pick<ColyseusModuleOptions, 'rooms'>): DynamicModule {
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
