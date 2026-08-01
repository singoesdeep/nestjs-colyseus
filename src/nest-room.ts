import { Type } from '@nestjs/common';
import { ContextId, ContextIdFactory, ModuleRef } from '@nestjs/core';
import { Room, type RoomOptions } from '@colyseus/core';
import { getColyseusMessageMetadata, getRoomGuardMetadata, getRoomPipeMetadata, getRoomInterceptorMetadata, getRoomParameterMetadata, getRoomFilterMetadata } from './colyseus.decorators';
import { executeColyseusMessage, handleColyseusException } from './colyseus-message-pipeline';
import { ColyseusExecutionContext } from './colyseus-execution-context';

/**
 * Opt-in bridge for resolving Nest providers from a Colyseus room instance.
 * Colyseus creates rooms itself, so constructor injection is intentionally not
 * attempted. Resolve providers from onCreate()/handlers instead.
 */
export abstract class NestRoom<T extends RoomOptions = RoomOptions> extends Room<T> {
  private nestModuleRef?: ModuleRef;
  private nestContextId?: ContextId;
  private readonly nestResolved = new Map<unknown, Promise<unknown>>();

  /** Resolve a Nest provider in this room's isolated context. */
  protected resolve<TInput = any, TResult = TInput>(token: Type<TInput> | Function | string | symbol): Promise<TResult> {
    if (!this.nestModuleRef) throw new Error('NestRoom is not attached to a Nest application');
    this.nestContextId ??= ContextIdFactory.create();
    let resolved = this.nestResolved.get(token) as Promise<TResult> | undefined;
    if (!resolved) {
      resolved = this.nestModuleRef.resolve<TInput, TResult>(token, this.nestContextId, { strict: false });
      this.nestResolved.set(token, resolved);
    }
    return resolved;
  }

  /** Release this room's context reference after disposal. */
  protected releaseNestContext(): void {
    this.nestContextId = undefined;
    this.nestModuleRef = undefined;
    this.nestResolved.clear();
  }

  /** @internal */
  attachNestContext(moduleRef: ModuleRef, contextId?: ContextId): void {
    this.nestModuleRef = moduleRef;
    this.nestContextId = contextId;
  }
}

export function isNestRoomConstructor(room: Function): boolean {
  return room.prototype instanceof NestRoom;
}

/** @internal Wrap a NestRoom constructor with the application ModuleRef. */
export function createNestRoomConstructor<TRoom extends Room>(
  room: new (...args: any[]) => TRoom,
  moduleRef: ModuleRef,
): new (...args: any[]) => TRoom {
  const nestRoom = isNestRoomConstructor(room);
  const messageMetadata = getColyseusMessageMetadata(room);
  if (!nestRoom && messageMetadata.length === 0) return room;
  return class NestAttachedRoom extends (room as any) {
    private colyseusHandlersBound = false;
    private runtimeContextId?: ContextId;
    private runtimeResolved = new Map<unknown, Promise<unknown>>();

    constructor(...args: any[]) {
      super(...args);
      (this as any).__colyseusRoomConstructor = room;
      this.runtimeContextId = ContextIdFactory.create();
      if (nestRoom) this.attachNestContext(moduleRef, this.runtimeContextId);
    }

    async onCreate(...args: any[]): Promise<void> {
      if (!this.colyseusHandlersBound) {
        this.colyseusHandlersBound = true;
        for (const { type, method } of messageMetadata) {
          const handler = (this as any)[method];
          if (typeof handler !== 'function') throw new Error(`Colyseus message handler is not a method: ${String(method)}`);
          const pipeline = {
            guards: getRoomGuardMetadata(room, method),
            pipes: getRoomPipeMetadata(room, method),
            interceptors: getRoomInterceptorMetadata(room, method),
            parameters: getRoomParameterMetadata(room, method),
            filters: getRoomFilterMetadata(room, method),
          };
          const payloadParameter = pipeline.parameters.find(parameter => parameter.kind === 'payload');
          const parameterTypes: Type<unknown>[] = Reflect.getMetadata('design:paramtypes', room.prototype, method) ?? [];
          const payloadMetatype = payloadParameter?.metatype ?? parameterTypes[1];
          const hasPipeline = pipeline.guards.length || pipeline.pipes.length || pipeline.interceptors.length || pipeline.parameters.length || pipeline.filters.length;
          const resolver = async (token: unknown) => {
            if (typeof token !== 'function' && typeof token !== 'string' && typeof token !== 'symbol') return token;
            let value = this.runtimeResolved.get(token);
            if (!value) {
              try { value = Promise.resolve(moduleRef.get(token as any, { strict: false })); }
              catch { value = moduleRef.resolve(token as any, this.runtimeContextId, { strict: false }); }
              this.runtimeResolved.set(token, value);
            }
            return value;
          };
          const exceptionContext = (client: unknown, payload: unknown) => new ColyseusExecutionContext([client, payload], handler, room, type, this);
          this.onMessage(type as any, hasPipeline
            ? (client: unknown, payload: unknown) => executeColyseusMessage(
              this,
              handler,
              type,
              [client, payload],
              { ...pipeline, payloadMetatype },
              resolver,
            ).catch(error => handleColyseusException(error, new ColyseusExecutionContext([client, payload], handler, room, type, this), client, pipeline.filters, resolver))
            : (client: unknown, payload: unknown) => Promise.resolve(handler.call(this, client, payload)).catch(error => handleColyseusException(error, exceptionContext(client, payload), client, pipeline.filters, resolver)));
        }
      }
      await super.onCreate?.(...args);
    }

    async onDispose(...args: any[]): Promise<void> {
      try {
        await super.onDispose?.(...args);
      } finally {
        if (nestRoom) this.releaseNestContext();
        this.runtimeContextId = undefined;
        this.runtimeResolved.clear();
      }
    }
  } as unknown as new (...args: any[]) => TRoom;
}
