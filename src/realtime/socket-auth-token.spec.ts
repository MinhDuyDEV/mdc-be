import type { Socket } from 'socket.io';
import { extractSocketAuthToken } from './socket-auth-token';

function socketWithHandshake(handshake: Partial<Socket['handshake']>): Socket {
  return {
    handshake: {
      auth: {},
      headers: {},
      query: {},
      ...handshake,
    },
  } as unknown as Socket;
}

describe('extractSocketAuthToken', () => {
  it('returns the Socket.IO auth token', () => {
    const socket = socketWithHandshake({
      auth: { token: 'auth-token' },
      headers: { authorization: 'Bearer header-token' },
    });

    expect(extractSocketAuthToken(socket)).toBe('auth-token');
  });

  it('returns a Bearer token from the authorization header', () => {
    const socket = socketWithHandshake({
      headers: { authorization: 'Bearer header-token' },
    });

    expect(extractSocketAuthToken(socket)).toBe('header-token');
  });

  it('does not accept query-string tokens', () => {
    const socket = socketWithHandshake({
      query: { token: 'query-token' },
    });

    expect(extractSocketAuthToken(socket)).toBeUndefined();
  });

  it('ignores non-Bearer authorization headers', () => {
    const socket = socketWithHandshake({
      headers: { authorization: 'Basic token' },
      query: { token: 'query-token' },
    });

    expect(extractSocketAuthToken(socket)).toBeUndefined();
  });
});
