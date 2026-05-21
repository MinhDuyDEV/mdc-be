import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'net';
import { io, type Socket } from 'socket.io-client';

export const getWsClient = (
  app: INestApplication,
  namespace = '',
  token?: string,
): Socket => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const httpServer = app.getHttpServer();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const existing = httpServer.address() as AddressInfo | null;
  if (!existing) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    httpServer.listen(0);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const address = httpServer.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}${namespace}`;
  return io(url, {
    auth: token ? { token } : undefined,
    transports: ['websocket'],
    autoConnect: false,
  });
};

export const waitForEvent = <T>(
  socket: Socket,
  event: string,
  timeoutMs = 2000,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for ${event}`)),
      timeoutMs,
    );
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
};
