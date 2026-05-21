import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { RecommendationsController } from './recommendations.controller';
import type { RecommendationsService } from './recommendations.service';

describe('RecommendationsController', () => {
  let controller: RecommendationsController;
  let service: {
    getPeopleRecommendations: jest.Mock;
    getJobRecommendations: jest.Mock;
    getCompanyRecommendations: jest.Mock;
  };

  const mockUser: AuthenticatedUser = {
    id: 'u1',
    email: 'test@example.com',
  };
  const emptyResponse = {
    data: [],
    meta: { hasMore: false, limit: 20 },
  };

  beforeEach(() => {
    service = {
      getPeopleRecommendations: jest.fn(),
      getJobRecommendations: jest.fn(),
      getCompanyRecommendations: jest.fn(),
    };

    controller = new RecommendationsController(
      service as unknown as RecommendationsService,
    );
  });

  it('delegates getPeople to service', async () => {
    service.getPeopleRecommendations.mockResolvedValue(emptyResponse);

    const result = await controller.getPeople(mockUser, {
      cursor: undefined,
      limit: 20,
    });

    expect(service.getPeopleRecommendations).toHaveBeenCalledWith(
      'u1',
      undefined,
      20,
    );
    expect(result).toEqual(emptyResponse);
  });

  it('delegates getPeople with cursor', async () => {
    service.getPeopleRecommendations.mockResolvedValue(emptyResponse);

    await controller.getPeople(mockUser, { cursor: 'abc123', limit: 10 });

    expect(service.getPeopleRecommendations).toHaveBeenCalledWith(
      'u1',
      'abc123',
      10,
    );
  });

  it('delegates getJobs to service', async () => {
    service.getJobRecommendations.mockResolvedValue(emptyResponse);

    const result = await controller.getJobs(mockUser, {
      cursor: undefined,
      limit: 20,
    });

    expect(service.getJobRecommendations).toHaveBeenCalledWith(
      'u1',
      undefined,
      20,
    );
    expect(result).toEqual(emptyResponse);
  });

  it('delegates getJobs with cursor', async () => {
    service.getJobRecommendations.mockResolvedValue(emptyResponse);

    await controller.getJobs(mockUser, { cursor: 'abc456', limit: 10 });

    expect(service.getJobRecommendations).toHaveBeenCalledWith(
      'u1',
      'abc456',
      10,
    );
  });

  it('delegates getCompanies to service', async () => {
    service.getCompanyRecommendations.mockResolvedValue(emptyResponse);

    const result = await controller.getCompanies(mockUser, {
      cursor: undefined,
      limit: 20,
    });

    expect(service.getCompanyRecommendations).toHaveBeenCalledWith(
      'u1',
      undefined,
      20,
    );
    expect(result).toEqual(emptyResponse);
  });

  it('delegates getCompanies with cursor', async () => {
    service.getCompanyRecommendations.mockResolvedValue(emptyResponse);

    await controller.getCompanies(mockUser, { cursor: 'abc789', limit: 10 });

    expect(service.getCompanyRecommendations).toHaveBeenCalledWith(
      'u1',
      'abc789',
      10,
    );
  });
});
