import { Injectable } from '@nestjs/common';
import { DuplicateRoomError, RoomRegistrationClosedError, ColyseusConfigurationError } from './colyseus.errors';
import type { ColyseusRoomDefinition, ColyseusRoomRegistration } from './colyseus-options';

@Injectable()
export class ColyseusRoomRegistry {
  private readonly rooms = new Map<string, ColyseusRoomDefinition>();
  private frozen = false;

  addAll(rooms: Record<string, ColyseusRoomRegistration> = {}): void {
    for (const [name, definition] of Object.entries(rooms)) this.add(name, definition);
  }

  add(name: string, definition: ColyseusRoomRegistration): void {
    if (this.frozen) throw new RoomRegistrationClosedError();
    if (!name || !definition) throw new ColyseusConfigurationError(`Invalid Colyseus room definition: ${name}`);
    if (this.rooms.has(name)) throw new DuplicateRoomError(name);
    this.rooms.set(name, normalizeRoomDefinition(definition));
  }

  freeze(): void { this.frozen = true; }
  restore(rooms: Record<string, ColyseusRoomRegistration>): void {
    this.rooms.clear();
    for (const [name, definition] of Object.entries(rooms)) this.rooms.set(name, normalizeRoomDefinition(definition));
    this.frozen = false;
  }
  entries(): Record<string, ColyseusRoomDefinition> { return Object.fromEntries(this.rooms); }
  get size(): number { return this.rooms.size; }
}

export function normalizeRoomDefinition(
  registration: ColyseusRoomRegistration,
): ColyseusRoomDefinition {
  if (typeof registration === 'function') return { room: registration };
  if (typeof registration === 'object' && registration !== null && typeof registration.room === 'function') {
    return registration;
  }
  throw new ColyseusConfigurationError('Invalid Colyseus room definition');
}
