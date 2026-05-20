import { ApplicationStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import type { MediaService } from '../media/media.service';
import { ApplicationsController } from './applications.controller';
import type { ApplicationsService } from './applications.service';

const candidate: AuthenticatedUser = {
  id: 'candidate-1',
  email: 'candidate@example.com',
};

describe('ApplicationsController', () => {
  let controller: ApplicationsController;
  let service: jest.Mocked<ApplicationsService>;
  let media: jest.Mocked<MediaService>;

  beforeEach(() => {
    service = {
      submitApplication: jest.fn(),
      listMyApplications: jest.fn(),
      listEmployerApplications: jest.fn(),
      getApplication: jest.fn(),
      updateStatus: jest.fn(),
      withdraw: jest.fn(),
      addNote: jest.fn(),
      listNotes: jest.fn(),
      getResumeAccess: jest.fn(),
    } as unknown as jest.Mocked<ApplicationsService>;

    media = {
      getDownloadUrl: jest.fn(),
    } as unknown as jest.Mocked<MediaService>;

    controller = new ApplicationsController(service, media);
  });

  it('submit delegates to service.submitApplication', async () => {
    service.submitApplication.mockResolvedValue({ id: 'app-1' } as never);
    const dto = { coverLetter: 'hi' };

    const result = await controller.submit(candidate, 'job-1', dto);

    expect(service.submitApplication).toHaveBeenCalledWith(
      'candidate-1',
      'job-1',
      dto,
    );
    expect(result).toEqual({ id: 'app-1' });
  });

  it('listMine forwards user.id and pagination query', async () => {
    service.listMyApplications.mockResolvedValue({
      data: [],
      meta: { hasMore: false },
    } as never);

    await controller.listMine(candidate, { limit: 20 });

    expect(service.listMyApplications).toHaveBeenCalledWith(
      'candidate-1',
      expect.objectContaining({ limit: 20 }),
    );
  });

  it('listForJob delegates to listEmployerApplications', async () => {
    service.listEmployerApplications.mockResolvedValue({
      data: [],
      meta: { hasMore: false },
    } as never);

    await controller.listForJob(candidate, 'job-1', { limit: 10 });

    expect(service.listEmployerApplications).toHaveBeenCalledWith(
      'candidate-1',
      'job-1',
      expect.objectContaining({ limit: 10 }),
    );
  });

  it('updateStatus delegates with new status payload', async () => {
    service.updateStatus.mockResolvedValue({ id: 'app-1' } as never);

    await controller.updateStatus(candidate, 'app-1', {
      newStatus: ApplicationStatus.REVIEWED,
    });

    expect(service.updateStatus).toHaveBeenCalledWith('candidate-1', 'app-1', {
      newStatus: ApplicationStatus.REVIEWED,
    });
  });

  it('withdraw delegates', async () => {
    service.withdraw.mockResolvedValue({ id: 'app-1' } as never);
    await controller.withdraw(candidate, 'app-1');
    expect(service.withdraw).toHaveBeenCalledWith('candidate-1', 'app-1');
  });

  it('addNote delegates', async () => {
    service.addNote.mockResolvedValue({ id: 'note-1' } as never);
    await controller.addNote(candidate, 'app-1', { content: 'Strong fit' });
    expect(service.addNote).toHaveBeenCalledWith('candidate-1', 'app-1', {
      content: 'Strong fit',
    });
  });

  it('listNotes delegates', async () => {
    service.listNotes.mockResolvedValue([] as never);
    await controller.listNotes(candidate, 'app-1');
    expect(service.listNotes).toHaveBeenCalledWith('candidate-1', 'app-1');
  });

  it('getResumeUrl resolves access then asks MediaService for URL using owner context', async () => {
    service.getResumeAccess.mockResolvedValue({
      applicationId: 'app-1',
      mediaAssetId: 'media-1',
      ownerUserId: 'candidate-1',
    });
    media.getDownloadUrl.mockResolvedValue({
      mediaId: 'media-1',
      downloadUrl: 'https://s3.example/presigned',
      expiresIn: 300,
      filename: 'resume.pdf',
      contentType: 'application/pdf',
    });

    const result = await controller.getResumeUrl(candidate, 'app-1');

    expect(service.getResumeAccess).toHaveBeenCalledWith(
      'candidate-1',
      'app-1',
    );
    // Owner-context call: id should be the candidate's id (resume owner)
    expect(media.getDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'candidate-1' }),
      'media-1',
    );
    expect(result).toEqual(
      expect.objectContaining({
        applicationId: 'app-1',
        mediaAssetId: 'media-1',
        downloadUrl: 'https://s3.example/presigned',
      }),
    );
  });
});
