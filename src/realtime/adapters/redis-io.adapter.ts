import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import { REDIS_CLIENT } from '../../infra/redis/redis.constants';

type SocketIOServer = Server;

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    app: INestApplicationContext,
    private readonly redisClient: Redis,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    // Create separate pub/sub clients with lazyConnect (required by redis-adapter)
    const pubClient = this.redisClient.duplicate({ lazyConnect: true });
    const subClient = this.redisClient.duplicate({ lazyConnect: true });

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): SocketIOServer {
    const server = super.createIOServer(port, options) as SocketIOServer;

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }

  static async create(app: INestApplicationContext): Promise<RedisIoAdapter> {
    const redisClient = app.get<Redis>(REDIS_CLIENT);
    const adapter = new RedisIoAdapter(app, redisClient);
    await adapter.connectToRedis();
    return adapter;
  }
}
