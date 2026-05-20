import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { RecruitingController } from './recruiting.controller';
import type { RecruitingService } from './recruiting.service';

const recruiter: AuthenticatedUser = {
  id: 'rec-1',
  email: 'rec@example.com',
};

describe('RecruitingController', () => {
  let controller: RecruitingController;
  let service: jest.Mocked<RecruitingService>;

  beforeEach(() => {
    service = {
      saveCandidate: jest.fn(),
      unsaveCandidate: jest.fn(),
      listSavedCandidates: jest.fn(),
      createTalentPool: jest.fn(),
      listTalentPools: jest.fn(),
      updateTalentPool: jest.fn(),
      deleteTalentPool: jest.fn(),
      addCandidateToPool: jest.fn(),
      removeCandidateFromPool: jest.fn(),
    } as unknown as jest.Mocked<RecruitingService>;

    controller = new RecruitingController(service);
  });

  it('saveCandidate delegates to service', async () => {
    service.saveCandidate.mockResolvedValue({ id: 'saved-1' } as never);
    await controller.saveCandidate(recruiter, 'c-1', {
      candidateUserId: 'cand-1',
    });
    expect(service.saveCandidate).toHaveBeenCalledWith('rec-1', 'c-1', {
      candidateUserId: 'cand-1',
    });
  });

  it('listSavedCandidates forwards query', async () => {
    service.listSavedCandidates.mockResolvedValue({
      data: [],
      meta: { hasMore: false },
    } as never);
    await controller.listSavedCandidates(recruiter, 'c-1', {
      limit: 20,
    });
    expect(service.listSavedCandidates).toHaveBeenCalledWith(
      'rec-1',
      'c-1',
      expect.objectContaining({ limit: 20 }),
    );
  });

  it('unsaveCandidate delegates', async () => {
    await controller.unsaveCandidate(recruiter, 'c-1', 'cand-1');
    expect(service.unsaveCandidate).toHaveBeenCalledWith(
      'rec-1',
      'c-1',
      'cand-1',
    );
  });

  it('createTalentPool delegates', async () => {
    service.createTalentPool.mockResolvedValue({ id: 'pool-1' } as never);
    await controller.createTalentPool(recruiter, 'c-1', {
      name: 'Engineering',
    });
    expect(service.createTalentPool).toHaveBeenCalledWith('rec-1', 'c-1', {
      name: 'Engineering',
    });
  });

  it('listTalentPools delegates', async () => {
    service.listTalentPools.mockResolvedValue([] as never);
    await controller.listTalentPools(recruiter, 'c-1');
    expect(service.listTalentPools).toHaveBeenCalledWith('rec-1', 'c-1');
  });

  it('updateTalentPool delegates', async () => {
    service.updateTalentPool.mockResolvedValue({ id: 'pool-1' } as never);
    await controller.updateTalentPool(recruiter, 'c-1', 'pool-1', {
      name: 'New name',
    });
    expect(service.updateTalentPool).toHaveBeenCalledWith(
      'rec-1',
      'c-1',
      'pool-1',
      {
        name: 'New name',
      },
    );
  });

  it('deleteTalentPool delegates', async () => {
    await controller.deleteTalentPool(recruiter, 'c-1', 'pool-1');
    expect(service.deleteTalentPool).toHaveBeenCalledWith(
      'rec-1',
      'c-1',
      'pool-1',
    );
  });

  it('addCandidateToPool delegates', async () => {
    service.addCandidateToPool.mockResolvedValue({ id: 'tpc-1' } as never);
    await controller.addCandidateToPool(recruiter, 'c-1', 'pool-1', {
      candidateUserId: 'cand-1',
    });
    expect(service.addCandidateToPool).toHaveBeenCalledWith(
      'rec-1',
      'c-1',
      'pool-1',
      {
        candidateUserId: 'cand-1',
      },
    );
  });

  it('removeCandidateFromPool delegates', async () => {
    await controller.removeCandidateFromPool(
      recruiter,
      'c-1',
      'pool-1',
      'cand-1',
    );
    expect(service.removeCandidateFromPool).toHaveBeenCalledWith(
      'rec-1',
      'c-1',
      'pool-1',
      'cand-1',
    );
  });
});
