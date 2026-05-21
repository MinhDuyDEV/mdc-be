import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { ServerOptions } from 'socket.io';
import { REDIS_CLIENT } from '../../infra/redis/redis.constants';

// socket.io returns `any` from createIOServer — IoAdapter base type uses `any` too

type SocketIOServer = any;

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    app: INestApplicationContext,
    private readonly redisClient: Redis,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    // Create separate pub/sub clients (required by redis-adapter)
    const pubClient = this.redisClient.duplicate();
    const subClient = this.redisClient.duplicate();

    await Promise.all([
      pubClient.connect ? pubClient.connect() : Promise.resolve(),
      subClient.connect ? subClient.connect() : Promise.resolve(),
    ]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): SocketIOServer {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const server = super.createIOServer(port, options);

    if (this.adapterConstructor) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
