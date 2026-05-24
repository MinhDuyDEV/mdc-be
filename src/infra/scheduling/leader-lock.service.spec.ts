import type { RedisClient } from '../redis';
import { LeaderLockService } from './leader-lock.service';

describe('LeaderLockService', () => {
  function createService() {
    const redis = {
      set: jest.fn(),
      eval: jest.fn().mockResolvedValue(1),
    } as unknown as RedisClient;

    return { redis, service: new LeaderLockService(redis) };
  }

  it('runs work and releases lock when acquired', async () => {
    const { redis, service } = createService();
    const work = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(redis, 'set').mockResolvedValue('OK');

    await expect(service.runIfLeader('cleanup', 50000, work)).resolves.toBe(
      true,
    );

    expect(redis.set).toHaveBeenCalledWith(
      'mdc:leader-lock:cleanup',
      expect.stringContaining(':'),
      'PX',
      50000,
      'NX',
    );
    expect(work).toHaveBeenCalledTimes(1);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("GET", KEYS[1])'),
      1,
      'mdc:leader-lock:cleanup',
      expect.stringContaining(':'),
    );
  });

  it('skips work when another worker holds the lock', async () => {
    const { redis, service } = createService();
    const work = jest.fn();
    jest.spyOn(redis, 'set').mockResolvedValue(null);

    await expect(service.runIfLeader('cleanup', 50000, work)).resolves.toBe(
      false,
    );

    expect(work).not.toHaveBeenCalled();
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('releases lock when work fails', async () => {
    const { redis, service } = createService();
    const work = jest.fn().mockRejectedValue(new Error('boom'));
    jest.spyOn(redis, 'set').mockResolvedValue('OK');

    await expect(service.runIfLeader('cleanup', 50000, work)).rejects.toThrow(
      'boom',
    );

    expect(redis.eval).toHaveBeenCalled();
  });
});
