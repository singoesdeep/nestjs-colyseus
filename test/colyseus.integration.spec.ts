import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ColyseusModule } from '../src';
import { TestRoom } from './fixtures/test-room';

describe('ColyseusModule', () => {
  it('boots in embedded mode and closes with Nest', async () => {
    @Module({
      imports: [ColyseusModule.forRoot({ rooms: { test: TestRoom } })],
    })
    class AppModule {}

    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    await app.close();
  });
});
