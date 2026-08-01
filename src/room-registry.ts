import { Injectable } from '@nestjs/common';
import { DuplicateRoomError, RoomRegistrationClosedError, ColyseusConfigurationError } from './colyseus.errors';

@Injectable()
export class ColyseusRoomRegistry {
  private readonly rooms = new Map<string, unknown>();
  private frozen = false;

  addAll(rooms: Record<string, unknown> = {}): void {
    for (const [name, definition] of Object.entries(rooms)) this.add(name, definition);
  }

  add(name: string, definition: unknown): void {
    if (this.frozen) throw new RoomRegistrationClosedError();
    if (!name || !definition) throw new ColyseusConfigurationError(`Invalid Colyseus room definition: ${name}`);
    if (this.rooms.has(name)) throw new DuplicateRoomError(name);
    this.rooms.set(name, definition);
  }

  freeze(): void { this.frozen = true; }
  entries(): Record<string, unknown> { return Object.fromEntries(this.rooms); }
  get size(): number { return this.rooms.size; }
}
