import type { ColyseusRoomDefinition, ColyseusRoomConstructor } from './colyseus-options';
import type { CanActivate, NestInterceptor, PipeTransform, Type } from '@nestjs/common';

export const COLYSEUS_ROOM_METADATA = Symbol('COLYSEUS_ROOM_METADATA');
export const COLYSEUS_MESSAGE_METADATA = Symbol('COLYSEUS_MESSAGE_METADATA');
export const COLYSEUS_GUARDS_METADATA = Symbol('COLYSEUS_GUARDS_METADATA');
export const COLYSEUS_PIPES_METADATA = Symbol('COLYSEUS_PIPES_METADATA');
export const COLYSEUS_INTERCEPTORS_METADATA = Symbol('COLYSEUS_INTERCEPTORS_METADATA');
export const COLYSEUS_PARAMETERS_METADATA = Symbol('COLYSEUS_PARAMETERS_METADATA');

export type RoomGuardToken = Type<CanActivate> | CanActivate | string | symbol;
export type RoomPipeToken = Type<PipeTransform> | PipeTransform | string | symbol;
export type RoomInterceptorToken = Type<NestInterceptor> | NestInterceptor | string | symbol;
type RoomEnhancerToken = RoomGuardToken | RoomPipeToken | RoomInterceptorToken;
export type RoomParameterKind = 'client' | 'payload' | 'room' | 'messageType' | 'context';
export interface RoomParameterMetadata {
  index: number;
  kind: RoomParameterKind;
  pipes?: RoomPipeToken[];
  metatype?: Type<unknown>;
}

export interface ColyseusRoomMetadata extends Omit<ColyseusRoomDefinition, 'room'> {
  name: string;
}

export interface ColyseusMessageMetadata {
  type: string | number;
  method: string | symbol;
}

function appendMetadata(target: object, key: symbol, values: RoomEnhancerToken[]): void {
  const existing: RoomEnhancerToken[] = Reflect.getOwnMetadata(key, target) ?? [];
  Reflect.defineMetadata(key, [...existing, ...values], target);
}

function enhancerDecorator(key: symbol, tokens: RoomEnhancerToken[]): ClassDecorator & MethodDecorator {
  return ((target: object | Function, propertyKey?: string | symbol) => {
    if (propertyKey === undefined) appendMetadata(target, key, tokens);
    else {
      const existing: RoomEnhancerToken[] = Reflect.getOwnMetadata(key, target, propertyKey) ?? [];
      Reflect.defineMetadata(key, [...existing, ...tokens], target, propertyKey);
    }
  }) as ClassDecorator & MethodDecorator;
}

export const UseRoomGuards = (...tokens: RoomGuardToken[]) => enhancerDecorator(COLYSEUS_GUARDS_METADATA, tokens);
export const UseRoomPipes = (...tokens: RoomPipeToken[]) => enhancerDecorator(COLYSEUS_PIPES_METADATA, tokens);
export const UseRoomInterceptors = (...tokens: RoomInterceptorToken[]) => enhancerDecorator(COLYSEUS_INTERCEPTORS_METADATA, tokens);

function parameterDecorator(kind: RoomParameterKind, pipes: RoomPipeToken[] = []): ParameterDecorator {
  return (target, propertyKey, index) => {
    const method = propertyKey ?? 'constructor';
    const existing: RoomParameterMetadata[] = Reflect.getOwnMetadata(COLYSEUS_PARAMETERS_METADATA, target, method) ?? [];
    Reflect.defineMetadata(COLYSEUS_PARAMETERS_METADATA, [...existing, { index, kind, ...(pipes.length ? { pipes } : {}) }], target, method);
  };
}

export const RoomClient = () => parameterDecorator('client');
export const RoomPayload = (...pipes: RoomPipeToken[]) => parameterDecorator('payload', pipes);
export const RoomInstance = () => parameterDecorator('room');
export const RoomMessageType = () => parameterDecorator('messageType');
export const RoomContext = () => parameterDecorator('context');

export function ColyseusRoom(options: ColyseusRoomMetadata): ClassDecorator {
  return target => Reflect.defineMetadata(COLYSEUS_ROOM_METADATA, options, target);
}

export function OnRoomMessage(type: string | number): MethodDecorator {
  return (target, propertyKey) => {
    const existing: ColyseusMessageMetadata[] = Reflect.getMetadata(COLYSEUS_MESSAGE_METADATA, target.constructor) ?? [];
    if (existing.some(item => item.type === type)) {
      throw new Error(`Duplicate Colyseus room message handler: ${type}`);
    }
    Reflect.defineMetadata(COLYSEUS_MESSAGE_METADATA, [...existing, { type, method: propertyKey }], target.constructor);
  };
}

export function getColyseusRoomMetadata(room: ColyseusRoomConstructor): ColyseusRoomMetadata | undefined {
  return Reflect.getMetadata(COLYSEUS_ROOM_METADATA, room);
}

export function getColyseusMessageMetadata(room: ColyseusRoomConstructor): ColyseusMessageMetadata[] {
  const methods = Reflect.getMetadata(COLYSEUS_MESSAGE_METADATA, room) ?? [];
  const seen = new Set<string | number>();
  for (const method of methods) {
    if (seen.has(method.type)) throw new Error(`Duplicate Colyseus room message handler: ${method.type}`);
    seen.add(method.type);
  }
  return methods;
}

export function getRoomEnhancerMetadata(
  room: ColyseusRoomConstructor,
  method?: string | symbol,
): { guards: RoomGuardToken[]; pipes: RoomPipeToken[]; interceptors: RoomInterceptorToken[] } {
  const target = room.prototype;
  const read = (key: symbol) => [
    ...(Reflect.getMetadata(key, room) ?? []),
    ...(method === undefined ? [] : Reflect.getMetadata(key, target, method) ?? []),
  ];
  return { guards: read(COLYSEUS_GUARDS_METADATA), pipes: read(COLYSEUS_PIPES_METADATA), interceptors: read(COLYSEUS_INTERCEPTORS_METADATA) };
}

export const getRoomGuardMetadata = (room: ColyseusRoomConstructor, method?: string | symbol): RoomGuardToken[] => getRoomEnhancerMetadata(room, method).guards;
export const getRoomPipeMetadata = (room: ColyseusRoomConstructor, method?: string | symbol): RoomPipeToken[] => getRoomEnhancerMetadata(room, method).pipes;
export const getRoomInterceptorMetadata = (room: ColyseusRoomConstructor, method?: string | symbol): RoomInterceptorToken[] => getRoomEnhancerMetadata(room, method).interceptors;

export function getRoomParameterMetadata(room: ColyseusRoomConstructor, method: string | symbol): RoomParameterMetadata[] {
  const types: Type<unknown>[] = Reflect.getMetadata('design:paramtypes', room.prototype, method) ?? [];
  return [...(Reflect.getMetadata(COLYSEUS_PARAMETERS_METADATA, room.prototype, method) ?? [])]
    .map(parameter => ({ ...parameter, metatype: types[parameter.index] }))
    .sort((a, b) => a.index - b.index);
}
