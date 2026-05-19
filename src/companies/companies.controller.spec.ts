import { CompanyRole } from '@prisma/client';
import { CompaniesController } from './companies.controller';

describe('CompaniesController', () => {
  let controller: CompaniesController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      createCompany: jest.fn(),
      listCompanies: jest.fn(),
      getCompanyById: jest.fn(),
      getCompanyBySlug: jest.fn(),
      updateCompany: jest.fn(),
      followCompany: jest.fn(),
      unfollowCompany: jest.fn(),
      addMember: jest.fn(),
      listMembers: jest.fn(),
      updateMemberRole: jest.fn(),
      removeMember: jest.fn(),
      inviteMember: jest.fn(),
      acceptInvitation: jest.fn(),
      allocateRecruiterSeat: jest.fn(),
      deallocateRecruiterSeat: jest.fn(),
    };
    controller = new CompaniesController(mockService);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('createCompany delegates', async () => {
    const user = { id: 'u1' };
    const dto = { name: 'Acme' } as any;
    mockService.createCompany.mockResolvedValue({ id: 'c1' });
    const result = await controller.createCompany(user, dto);
    expect(mockService.createCompany).toHaveBeenCalledWith('u1', dto);
    expect(result).toEqual({ id: 'c1' });
  });

  it('listCompanies delegates', async () => {
    const query = { limit: 10 } as any;
    await controller.listCompanies(query);
    expect(mockService.listCompanies).toHaveBeenCalledWith(query);
  });

  it('getCompanyById delegates', async () => {
    await controller.getCompanyById('c1');
    expect(mockService.getCompanyById).toHaveBeenCalledWith('c1');
  });

  it('getCompanyBySlug delegates', async () => {
    await controller.getCompanyBySlug('acme');
    expect(mockService.getCompanyBySlug).toHaveBeenCalledWith('acme');
  });

  it('updateCompany delegates', async () => {
    const user = { id: 'u1' };
    const dto = { name: 'New' } as any;
    await controller.updateCompany(user, 'c1', dto);
    expect(mockService.updateCompany).toHaveBeenCalledWith('u1', 'c1', dto);
  });

  it('followCompany delegates', async () => {
    const user = { id: 'u1' };
    await controller.followCompany(user, 'c1');
    expect(mockService.followCompany).toHaveBeenCalledWith('u1', 'c1');
  });

  it('unfollowCompany delegates', async () => {
    const user = { id: 'u1' };
    await controller.unfollowCompany(user, 'c1');
    expect(mockService.unfollowCompany).toHaveBeenCalledWith('u1', 'c1');
  });

  it('addMember delegates', async () => {
    const user = { id: 'u1' };
    const dto = { userId: 'u2', role: CompanyRole.MEMBER };
    await controller.addMember(user, 'c1', dto);
    expect(mockService.addMember).toHaveBeenCalledWith('u1', 'c1', dto);
  });

  it('listMembers delegates', async () => {
    const user = { id: 'u1' };
    const query = { limit: 5 } as any;
    await controller.listMembers(user, 'c1', query);
    expect(mockService.listMembers).toHaveBeenCalledWith('u1', 'c1', query);
  });

  it('updateMemberRole delegates', async () => {
    const user = { id: 'u1' };
    const dto = { role: CompanyRole.ADMIN };
    await controller.updateMemberRole(user, 'c1', 'm1', dto);
    expect(mockService.updateMemberRole).toHaveBeenCalledWith(
      'u1',
      'c1',
      'm1',
      dto,
    );
  });

  it('removeMember delegates', async () => {
    const user = { id: 'u1' };
    await controller.removeMember(user, 'c1', 'm1');
    expect(mockService.removeMember).toHaveBeenCalledWith('u1', 'c1', 'm1');
  });

  it('inviteMember delegates', async () => {
    const user = { id: 'u1' };
    const dto = { email: 'x@y.com', role: 'MEMBER' } as any;
    await controller.inviteMember(user, 'c1', dto);
    expect(mockService.inviteMember).toHaveBeenCalledWith('u1', 'c1', dto);
  });

  it('acceptInvitation passes token', async () => {
    const user = { id: 'u1' };
    await controller.acceptInvitation(user, { token: 'tok' });
    expect(mockService.acceptInvitation).toHaveBeenCalledWith('u1', 'tok');
  });

  it('allocateRecruiterSeat passes target userId', async () => {
    const user = { id: 'u1' };
    await controller.allocateRecruiterSeat(user, 'c1', { userId: 'u2' });
    expect(mockService.allocateRecruiterSeat).toHaveBeenCalledWith(
      'u1',
      'c1',
      'u2',
    );
  });

  it('deallocateRecruiterSeat delegates', async () => {
    const user = { id: 'u1' };
    await controller.deallocateRecruiterSeat(user, 'c1', 's1');
    expect(mockService.deallocateRecruiterSeat).toHaveBeenCalledWith(
      'u1',
      'c1',
      's1',
    );
  });
});
