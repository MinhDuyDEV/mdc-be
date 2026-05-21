import { Test, type TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { SearchEngineService } from '../infra/search-engine/search-engine.service';
import { SearchFallbackService } from './search-fallback.service';

describe('SearchFallbackService', () => {
  let service: SearchFallbackService;
  let mockCheckClusterHealth: jest.Mock;

  beforeEach(async () => {
    mockCheckClusterHealth = jest.fn();

    const mockSearchEngine = {
      checkClusterHealth: mockCheckClusterHealth,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchFallbackService,
        { provide: SearchEngineService, useValue: mockSearchEngine },
        {
          provide: getLoggerToken(SearchFallbackService.name),
          useValue: {
            setContext: jest.fn(),
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SearchFallbackService>(SearchFallbackService);
  });

  it('should start with circuit CLOSED', () => {
    expect(service.isCircuitOpen()).toBe(false);
    expect(service.getState().state).toBe('CLOSED');
  });

  it('should open circuit after threshold failures', () => {
    for (let i = 0; i < 5; i++) {
      service.recordFailure(new Error('ES unavailable'));
    }
    expect(service.isCircuitOpen()).toBe(true);
    expect(service.getState().state).toBe('OPEN');
  });

  it('should not open circuit before threshold', () => {
    for (let i = 0; i < 4; i++) {
      service.recordFailure(new Error('ES unavailable'));
    }
    expect(service.isCircuitOpen()).toBe(false);
    expect(service.getState().state).toBe('CLOSED');
  });

  it('should transition to HALF_OPEN after cooldown', () => {
    // Open circuit
    for (let i = 0; i < 5; i++) {
      service.recordFailure(new Error('ES unavailable'));
    }
    expect(service.isCircuitOpen()).toBe(true);

    // Advance time past cooldown
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000);
    expect(service.isCircuitOpen()).toBe(false);
    expect(service.getState().state).toBe('HALF_OPEN');
  });

  it('should close circuit on success after HALF_OPEN', () => {
    // Open circuit
    for (let i = 0; i < 5; i++) {
      service.recordFailure(new Error('ES unavailable'));
    }
    // Transition to HALF_OPEN
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000);
    service.isCircuitOpen();
    // Record success
    service.recordSuccess();
    expect(service.getState().state).toBe('CLOSED');
    expect(service.getState().failureCount).toBe(0);
  });

  it('should auto-recover via health check cron', async () => {
    for (let i = 0; i < 5; i++) {
      service.recordFailure(new Error('ES unavailable'));
    }
    mockCheckClusterHealth.mockResolvedValue({ status: 'up' });
    await service.checkClusterHealth();
    expect(service.getState().state).toBe('HALF_OPEN');
  });

  it('should not recover when health check fails', async () => {
    for (let i = 0; i < 5; i++) {
      service.recordFailure(new Error('ES unavailable'));
    }
    mockCheckClusterHealth.mockRejectedValue(new Error('timeout'));
    await service.checkClusterHealth();
    expect(service.getState().state).toBe('OPEN');
  });
});
