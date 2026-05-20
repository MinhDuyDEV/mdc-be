import {
  ApplyMode,
  EmploymentType,
  JobStatus,
  WorkplaceType,
} from '@prisma/client';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { JobsController } from './jobs.controller';
import type { JobsService } from './jobs.service';

const fakeUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
};

describe('JobsController', () => {
  let controller: JobsController;
  let service: jest.Mocked<JobsService>;

  beforeEach(() => {
    service = {
      createJob: jest.fn(),
      updateJob: jest.fn(),
      getJob: jest.fn(),
      listJobs: jest.fn(),
      publishJob: jest.fn(),
      closeJob: jest.fn(),
      deleteJob: jest.fn(),
      saveJob: jest.fn(),
      unsaveJob: jest.fn(),
      listSavedJobs: jest.fn(),
      recordExternalApplyClick: jest.fn(),
    } as unknown as jest.Mocked<JobsService>;

    controller = new JobsController(service);
  });

  it('createJob delegates to service.createJob with user.id', async () => {
    const dto = {
      companyId: 'c1',
      title: 'Engineer',
      description: 'Desc',
      applyMode: ApplyMode.INTERNAL,
      employmentType: EmploymentType.FULL_TIME,
      workplaceType: WorkplaceType.REMOTE,
    };
    service.createJob.mockResolvedValue({ id: 'job-1' } as never);

    const result = await controller.createJob(fakeUser, dto);
    expect(service.createJob).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual({ id: 'job-1' });
  });

  it('listJobs forwards anonymous (undefined) user to service', async () => {
    service.listJobs.mockResolvedValue({
      data: [],
      meta: { hasMore: false },
    } as never);

    await controller.listJobs(undefined, {
      limit: 20,
      status: JobStatus.PUBLISHED,
    });

    expect(service.listJobs).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 }),
      undefined,
    );
  });

  it('getJob returns service result for /jobs/:id', async () => {
    service.getJob.mockResolvedValue({ id: 'job-1' } as never);
    const result = await controller.getJob(fakeUser, 'job-1');
    expect(service.getJob).toHaveBeenCalledWith('job-1', 'user-1');
    expect(result).toEqual({ id: 'job-1' });
  });

  it('publishJob delegates to service.publishJob', async () => {
    service.publishJob.mockResolvedValue({ id: 'job-1' } as never);
    await controller.publishJob(fakeUser, 'job-1');
    expect(service.publishJob).toHaveBeenCalledWith('user-1', 'job-1');
  });

  it('saveJob delegates to service.saveJob', async () => {
    service.saveJob.mockResolvedValue({ id: 'saved-1' } as never);
    await controller.saveJob(fakeUser, 'job-1');
    expect(service.saveJob).toHaveBeenCalledWith('user-1', 'job-1');
  });

  it('externalApplyClick delegates with optional anonymous user', async () => {
    await controller.externalApplyClick(undefined, 'job-1');
    expect(service.recordExternalApplyClick).toHaveBeenCalledWith(
      'job-1',
      undefined,
    );
  });

  it('listSavedJobs requires authenticated user and forwards query', async () => {
    service.listSavedJobs.mockResolvedValue({
      data: [],
      meta: { hasMore: false },
    } as never);
    await controller.listSavedJobs(fakeUser, { limit: 20 });
    expect(service.listSavedJobs).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ limit: 20 }),
    );
  });
});
