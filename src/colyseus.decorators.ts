import type { ColyseusRoomDefinition, ColyseusRoomConstructor } from './colyseus-options';

export const COLYSEUS_ROOM_METADATA = Symbol('COLYSEUS_ROOM_METADATA');
export const COLYSEUS_MESSAGE_METADATA = Symbol('COLYSEUS_MESSAGE_METADATA');

export interface ColyseusRoomMetadata extends Omit<ColyseusRoomDefinition, 'room'> {
  name: string;
}

export interface ColyseusMessageMetadata {
  type: string | number;
  method: string | symbol;
}

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
