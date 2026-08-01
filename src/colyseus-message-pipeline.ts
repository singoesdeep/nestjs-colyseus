import { ForbiddenException, HttpException, HttpStatus, Logger, type ArgumentMetadata, type PipeTransform, type Type } from '@nestjs/common';
import { defer, isObservable, lastValueFrom, of } from 'rxjs';
import { ColyseusExecutionContext } from './colyseus-execution-context';
import type { RoomExceptionFilter, RoomFilterToken, RoomGuardToken, RoomInterceptorToken, RoomParameterMetadata, RoomPipeToken } from './colyseus.decorators';

export interface ColyseusMessagePipelineMetadata {
  guards?: RoomGuardToken[];
  pipes?: RoomPipeToken[];
  interceptors?: RoomInterceptorToken[];
  parameters?: RoomParameterMetadata[];
  payloadMetatype?: Type<unknown>;
  filters?: RoomFilterToken[];
}

type Enhancer<T> = T | Type<T> | string | symbol;
type EnhancerResolver = (token: unknown) => Promise<unknown>;
const logger = new Logger('ColyseusRoom');

async function resolveEnhancer<T>(resolver: EnhancerResolver | undefined, enhancer: Enhancer<T>): Promise<T> {
  if (typeof enhancer !== 'function' && typeof enhancer !== 'string' && typeof enhancer !== 'symbol') return enhancer;
  if (!resolver) throw new Error('Class-based room enhancers require a Nest ModuleRef resolver');
  return resolver(enhancer) as Promise<T>;
}

async function applyPipe(pipe: PipeTransform, value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
  const result = pipe.transform(value, metadata);
  return isObservable(result) ? lastValueFrom(result) : await result;
}

export async function executeColyseusMessage(
  room: any,
  method: Function,
  messageType: string | number,
  args: [unknown, unknown],
  metadata: ColyseusMessagePipelineMetadata = {},
  resolver?: EnhancerResolver,
): Promise<unknown> {
  const context = new ColyseusExecutionContext(args, method, room.__colyseusRoomConstructor ?? room.constructor, messageType, room);
  for (const token of metadata.guards ?? []) {
    const guard = await resolveEnhancer(resolver, token);
    if (!(await guard.canActivate(context))) throw new ForbiddenException();
  }

  let payload = args[1];
  for (const token of metadata.pipes ?? []) {
    payload = await applyPipe(await resolveEnhancer<PipeTransform>(resolver, token), payload, {
      type: 'custom',
      data: 'payload',
      metatype: metadata.payloadMetatype,
    });
  }
  context.setData(payload);
  const parameters = metadata.parameters ?? [];
  const values = parameters.length
    ? new Array(Math.max(...parameters.map(parameter => parameter.index)) + 1)
    : [args[0], payload];
  for (const parameter of parameters) {
    let value = parameter.kind === 'client' ? args[0] : parameter.kind === 'payload' ? payload : parameter.kind === 'room' ? room : parameter.kind === 'messageType' ? messageType : context;
    for (const token of parameter.pipes ?? []) {
      value = await applyPipe(await resolveEnhancer<PipeTransform>(resolver, token), value, {
        type: 'custom',
        data: parameter.kind,
        metatype: parameter.metatype,
      });
    }
    values[parameter.index] = value;
  }

  const invoke = () => method.apply(room, values);
  let next = { handle: () => defer(() => { const value = invoke(); return isObservable(value) ? value : of(value); }) };
  for (const token of [...(metadata.interceptors ?? [])].reverse()) {
    const interceptor = await resolveEnhancer(resolver, token);
    const previous = next;
    next = { handle: () => defer(async () => { const result = await interceptor.intercept(context, previous); return isObservable(result) ? lastValueFrom(result) : result; }) };
  }
  return lastValueFrom(next.handle());
}

export async function handleColyseusException(exception: unknown, context: ColyseusExecutionContext, client: any, filters: RoomFilterToken[] = [], resolver?: EnhancerResolver, errorType: string | number = 'error'): Promise<void> {
  for (const token of [...filters].reverse()) {
    try {
      const filter = (typeof token === 'function' || typeof token === 'string' || typeof token === 'symbol')
        ? await resolveEnhancer<RoomExceptionFilter>(resolver, token)
        : token;
      const handled = await filter.catch(exception, context);
      if (client?.send && handled !== undefined) client.send(errorType, handled);
      return;
    } catch (filterError) { logger.error('Room exception filter failed', filterError instanceof Error ? filterError.stack : undefined); }
  }
  logger.error('Unhandled Colyseus room exception', exception instanceof Error ? exception.stack : String(exception));
  const status = exception instanceof HttpException ? exception.getStatus() : 500;
  const code = status < 500 ? (HttpStatus[status] ?? 'CLIENT_ERROR') : 'INTERNAL_SERVER_ERROR';
  const message = code === 'INTERNAL_SERVER_ERROR'
    ? 'Internal server error'
    : code.toLowerCase().replaceAll('_', ' ').replace(/^./, character => character.toUpperCase());
  const payload = { code, message };
  if (client?.send) client.send(errorType, payload);
}
