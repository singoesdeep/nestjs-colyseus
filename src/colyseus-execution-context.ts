import type { ExecutionContext, Type } from '@nestjs/common';
import type { HttpArgumentsHost, RpcArgumentsHost, WsArgumentsHost } from '@nestjs/common/interfaces';

/** Nest ExecutionContext adapter for a Colyseus room message invocation. */
export class ColyseusExecutionContext implements ExecutionContext {
  constructor(
    private readonly args: unknown[],
    private readonly handler: Function,
    private readonly target: Type<unknown> | object,
    private readonly messageType: string | number,
    private readonly room: unknown,
    private data: unknown = args[1],
  ) {}

  getClass<T = any>(): Type<T> { return (typeof this.target === 'function' ? this.target : this.target.constructor) as Type<T>; }
  getHandler(): Function { return this.handler; }
  getArgs<T extends Array<unknown> = any[]>(): T { return this.args as T; }
  getArgByIndex<T = any>(index: number): T { return this.args[index] as T; }
  getType<TContext extends string = string>(): TContext { return 'ws' as TContext; }
  switchToRpc(): RpcArgumentsHost { return { getData: <T = any>() => this.data as T, getContext: <T = any>() => this.room as T }; }
  switchToHttp(): HttpArgumentsHost { return { getRequest: <T = any>() => this.args[0] as T, getResponse: <T = any>() => this.room as T, getNext: <T = any>() => undefined as T }; }
  switchToWs(): WsArgumentsHost {
    return {
      getClient: <T = any>() => this.args[0] as T,
      getData: <T = any>() => this.data as T,
      getPattern: <T = any>() => this.messageType as T,
    };
  }

  getRoom<T = any>(): T { return this.room as T; }
  getClient<T = any>(): T { return this.args[0] as T; }
  getMessageType<T extends string | number = string | number>(): T { return this.messageType as T; }
  getData<T = any>(): T { return this.data as T; }
  setData(value: unknown): void { this.data = value; this.args[1] = value; }
}
