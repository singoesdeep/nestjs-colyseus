import { ForbiddenException, type CanActivate } from '@nestjs/common';
import { executeColyseusMessage } from '../src/colyseus-message-pipeline';

describe('Colyseus message pipeline', () => {
  it('rejects a denied guard before invoking the handler', async () => {
    const handler = jest.fn();
    const guard: CanActivate = { canActivate: () => false };

    await expect(executeColyseusMessage(
      {},
      handler,
      'secure',
      [{ sessionId: 'client' }, { value: 1 }],
      { guards: [guard] },
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(handler).not.toHaveBeenCalled();
  });
});
