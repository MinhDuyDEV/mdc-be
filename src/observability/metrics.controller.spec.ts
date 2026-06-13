import { Test, type TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: { getMetrics: jest.Mock };

  beforeEach(async () => {
    metricsService = {
      getMetrics: jest.fn().mockResolvedValue('mocked prometheus output'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: MetricsService, useValue: metricsService }],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
  });

  it('returns Prometheus text output from the metrics service', async () => {
    const result = await controller.getMetrics();
    expect(metricsService.getMetrics).toHaveBeenCalledTimes(1);
    expect(result).toBe('mocked prometheus output');
  });
});
