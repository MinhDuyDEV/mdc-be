export function createRedisMock() {
  return {
    status: 'ready',
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    setex: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue([]),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(-1),
    exists: jest.fn().mockResolvedValue(0),
    hget: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(1),
    hdel: jest.fn().mockResolvedValue(0),
    hgetall: jest.fn().mockResolvedValue({}),
    hmset: jest.fn().mockResolvedValue('OK'),
    zadd: jest.fn().mockResolvedValue(1),
    zrange: jest.fn().mockResolvedValue([]),
    zrem: jest.fn().mockResolvedValue(0),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(0),
    smembers: jest.fn().mockResolvedValue([]),
    publish: jest.fn().mockResolvedValue(0),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
  };
}

export function createOutboxEventMock() {
  return {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    findMany: jest.fn().mockResolvedValue([]),
  };
}

export function createAdminPermissions(...permissions: string[]) {
  return permissions.map((permission) => ({ permission }));
}
