export class ColyseusConfigurationError extends Error {
  readonly code: string = 'COLYSEUS_CONFIGURATION_ERROR';
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ColyseusConfigurationError';
  }
}

export class DuplicateRoomError extends ColyseusConfigurationError {
  readonly code: string = 'COLYSEUS_DUPLICATE_ROOM';
  constructor(name: string) { super(`Duplicate Colyseus room: ${name}`); this.name = 'DuplicateRoomError'; }
}

export class RoomRegistrationClosedError extends ColyseusConfigurationError {
  readonly code: string = 'COLYSEUS_ROOM_REGISTRATION_CLOSED';
  constructor() { super('Colyseus room registration is closed'); this.name = 'RoomRegistrationClosedError'; }
}

export class ColyseusStartupError extends Error {
  readonly code = 'COLYSEUS_STARTUP_ERROR';
  constructor(message: string, options?: ErrorOptions) { super(message, options); this.name = 'ColyseusStartupError'; }
}

export class ColyseusShutdownError extends Error {
  readonly code = 'COLYSEUS_SHUTDOWN_ERROR';
  constructor(message: string, options?: ErrorOptions) { super(message, options); this.name = 'ColyseusShutdownError'; }
}
