import type { Socket } from 'socket.io';

interface SocketHandshakeAuth {
  token?: unknown;
}

interface SocketHandshakeHeaders {
  authorization?: unknown;
}

export function extractSocketAuthToken(socket: Socket): string | undefined {
  const auth = socket.handshake.auth as SocketHandshakeAuth | undefined;
  const authToken = auth?.token;
  if (typeof authToken === 'string') {
    return authToken;
  }

  const headers = socket.handshake.headers as
    | SocketHandshakeHeaders
    | undefined;
  const authorization = headers?.authorization;
  const headerValue = Array.isArray(authorization)
    ? authorization.find((value): value is string => typeof value === 'string')
    : authorization;
  if (typeof headerValue !== 'string') {
    return undefined;
  }

  const [type, token] = headerValue?.split(' ') ?? [];

  return type === 'Bearer' && token ? token : undefined;
}
