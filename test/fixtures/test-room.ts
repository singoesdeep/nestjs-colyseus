import { Room } from '@colyseus/core';
import { Schema, type } from '@colyseus/schema';

export class TestState extends Schema {
  @type('string') message = 'ready';
}

export class TestRoom extends Room<{ state: TestState }> {
  onCreate() {
    this.setState(new TestState());
  }
}
