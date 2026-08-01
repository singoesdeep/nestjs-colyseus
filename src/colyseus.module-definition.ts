import { ConfigurableModuleBuilder } from '@nestjs/common';
import type { ColyseusModuleOptions } from './colyseus-options';

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<ColyseusModuleOptions>()
  .setClassMethodName('forRoot')
  .setFactoryMethodName('createColyseusOptions')
  .build();

