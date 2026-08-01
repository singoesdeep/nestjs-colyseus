import { Type } from '@nestjs/common';
import { ContextId, ContextIdFactory, ModuleRef } from '@nestjs/core';
import { Room } from '@colyseus/core';
import { getColyseusMessageMetadata } from './colyseus.decorators';

/**
 * Opt-in bridge for resolving Nest providers from a Colyseus room instance.
 * Colyseus creates rooms itself, so constructor injection is intentionally not
 * attempted. Resolve providers from onCreate()/handlers instead.
 */
export abstract class NestRoom<
  State extends object = any,
  Metadata = any,
  UserData = any,
  AuthData = any,
> extends Room<State, Metadata, UserData, AuthData> {
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
  attachNestContext(moduleRef: ModuleRef): void {
    this.nestModuleRef = moduleRef;
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

    constructor(...args: any[]) {
      super(...args);
      if (nestRoom) this.attachNestContext(moduleRef);
    }

    async onCreate(...args: any[]): Promise<void> {
      if (!this.colyseusHandlersBound) {
        this.colyseusHandlersBound = true;
        for (const { type, method } of messageMetadata) {
          const handler = (this as any)[method];
          if (typeof handler !== 'function') throw new Error(`Colyseus message handler is not a method: ${String(method)}`);
          this.onMessage(type as any, handler.bind(this));
        }
      }
      await super.onCreate?.(...args);
    }

    async onDispose(...args: any[]): Promise<void> {
      try {
        await super.onDispose?.(...args);
      } finally {
        if (nestRoom) this.releaseNestContext();
      }
    }
  } as unknown as new (...args: any[]) => TRoom;
}
