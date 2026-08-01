import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { ColyseusExecutionContext } from '../src/colyseus-execution-context';
import { handleColyseusException } from '../src/colyseus-message-pipeline';

const context = () => new ColyseusExecutionContext(['client', {}], () => undefined, class Room {}, 'chat', {});

describe('Colyseus room exception filters', () => {
  it('runs method filters before class filters and treats void as handled', async () => {
    const calls: string[] = [];
    const client = { send: jest.fn() };
    await handleColyseusException(new Error('secret'), context(), client, [
      { catch: () => { calls.push('class'); } },
      { catch: () => { calls.push('method'); } },
    ]);
    expect(calls).toEqual(['method']);
    expect(client.send).not.toHaveBeenCalled();
  });

  it('falls back safely when a filter throws', async () => {
    const client = { send: jest.fn() };
    await handleColyseusException(new Error('database password'), context(), client, [{ catch: () => { throw new Error('filter failed'); } }]);
    expect(client.send).toHaveBeenCalledWith('error', { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' });
    expect(JSON.stringify(client.send.mock.calls)).not.toContain('database password');
  });

  it('maps ForbiddenException to a stable safe payload', async () => {
    const client = { send: jest.fn() };
    await handleColyseusException(new ForbiddenException(), context(), client);
    expect(client.send).toHaveBeenCalledWith('error', { code: 'FORBIDDEN', message: 'Forbidden' });
  });

  it('does not expose custom HTTP exception details', async () => {
    const client = { send: jest.fn() };
    await handleColyseusException(new BadRequestException('private validation detail'), context(), client);
    expect(client.send).toHaveBeenCalledWith('error', { code: 'BAD_REQUEST', message: 'Bad request' });
    expect(JSON.stringify(client.send.mock.calls)).not.toContain('private validation detail');
  });

  it('resolves class filters through the supplied room context resolver', async () => {
    class ScopedFilter { catch() { return { code: 'SCOPED' }; } }
    const instance = new ScopedFilter();
    const resolver = jest.fn<(token: unknown) => Promise<unknown>>().mockResolvedValue(instance);
    const client = { send: jest.fn() };
    await handleColyseusException(new Error('x'), context(), client, [ScopedFilter as any], resolver);
    expect(resolver).toHaveBeenCalledWith(ScopedFilter);
    expect(client.send).toHaveBeenCalledWith('error', { code: 'SCOPED' });
  });
});
