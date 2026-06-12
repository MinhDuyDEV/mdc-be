import { Test, type TestingModule } from '@nestjs/testing';
import { AuthGuard } from '../auth/auth.guard';
import { ExperimentsController } from './experiments.controller';
import { ExperimentsService } from './experiments.service';

describe('ExperimentsController', () => {
  let controller: ExperimentsController;
  let service: jest.Mocked<ExperimentsService>;

  beforeEach(async () => {
    service = {
      trackEvent: jest.fn(),
    } as unknown as jest.Mocked<ExperimentsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExperimentsController],
      providers: [{ provide: ExperimentsService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ExperimentsController>(ExperimentsController);
  });

  it('POST /track calls service.trackEvent with DTO and user', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const dto = { experimentId: 'exp-homepage-v2', variant: 'treatment-a' };

    const result = await controller.track(dto, mockUser);

    expect(service.trackEvent).toHaveBeenCalledWith({
      experimentId: 'exp-homepage-v2',
      userId: 'user-123',
      variant: 'treatment-a',
    });
    expect(result).toEqual({ success: true });
  });
});
