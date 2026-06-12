import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { RecommendationsController } from './recommendations.controller';
import type { RecommendationsService } from './recommendations.service';

describe('RecommendationsController', () => {
  let controller: RecommendationsController;
  let service: {
    getPeopleRecommendations: jest.Mock;
    getJobRecommendations: jest.Mock;
    getCompanyRecommendations: jest.Mock;
    submitFeedback: jest.Mock;
    dismissRecommendation: jest.Mock;
  };

  const mockUser: AuthenticatedUser = {
    id: 'u1',
    email: 'test@example.com',
  };
  const emptyResponse = {
    data: [],
    meta: { hasNextPage: false, limit: 20 },
  };

  beforeEach(() => {
    service = {
      getPeopleRecommendations: jest.fn(),
      getJobRecommendations: jest.fn(),
      getCompanyRecommendations: jest.fn(),
      submitFeedback: jest.fn(),
      dismissRecommendation: jest.fn(),
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

  it('delegates submitFeedback to service', async () => {
    service.submitFeedback.mockResolvedValue(undefined);

    const dto = {
      entityType: 'job' as const,
      entityId: 'job-1',
      feedback: 'helpful' as const,
    };
    const result = await controller.submitFeedback(mockUser, dto);

    expect(service.submitFeedback).toHaveBeenCalledWith('u1', dto);
    expect(result).toEqual({ message: 'Feedback recorded' });
  });

  it('delegates dismiss to service', async () => {
    service.dismissRecommendation.mockResolvedValue(undefined);

    const dto = { entityType: 'person' as const, entityId: 'user-2' };
    const result = await controller.dismiss(mockUser, dto);

    expect(service.dismissRecommendation).toHaveBeenCalledWith('u1', dto);
    expect(result).toEqual({ message: 'Recommendation dismissed' });
  });
});
