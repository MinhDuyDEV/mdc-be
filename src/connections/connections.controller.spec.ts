import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import {
  ConnectionsController,
  ConnectionsUsersController,
} from './connections.controller';
import type { ConnectionsService } from './connections.service';

interface MockService {
  sendRequest: jest.Mock;
  acceptRequest: jest.Mock;
  declineRequest: jest.Mock;
  removeConnection: jest.Mock;
  follow: jest.Mock;
  unfollow: jest.Mock;
  blockUser: jest.Mock;
  unblockUser: jest.Mock;
  listConnections: jest.Mock;
  listPendingRequests: jest.Mock;
}

describe('ConnectionsController', () => {
  let controller: ConnectionsController;
  let service: MockService;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
  };

  beforeEach(() => {
    service = {
      sendRequest: jest.fn().mockResolvedValue({ id: 'conn-1' }),
      acceptRequest: jest.fn().mockResolvedValue({ id: 'conn-1' }),
      declineRequest: jest.fn().mockResolvedValue({ id: 'conn-1' }),
      removeConnection: jest.fn().mockResolvedValue(undefined),
      follow: jest.fn().mockResolvedValue({ id: 'follow-1' }),
      unfollow: jest.fn().mockResolvedValue(undefined),
      blockUser: jest.fn().mockResolvedValue({ id: 'block-1' }),
      unblockUser: jest.fn().mockResolvedValue(undefined),
      listConnections: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      listPendingRequests: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    };
    controller = new ConnectionsController(
      service as unknown as ConnectionsService,
    );
  });

  it('sendRequest delegates to service', async () => {
    const dto = { toUserId: 'user-2' };
    await controller.sendRequest(mockUser, dto);
    expect(service.sendRequest).toHaveBeenCalledWith('user-1', dto);
  });

  it('acceptRequest delegates to service', async () => {
    await controller.acceptRequest(mockUser, 'conn-123');
    expect(service.acceptRequest).toHaveBeenCalledWith('user-1', 'conn-123');
  });

  it('declineRequest delegates to service', async () => {
    await controller.declineRequest(mockUser, 'conn-123');
    expect(service.declineRequest).toHaveBeenCalledWith('user-1', 'conn-123');
  });

  it('removeConnection delegates to service', async () => {
    await controller.removeConnection(mockUser, 'conn-123');
    expect(service.removeConnection).toHaveBeenCalledWith('user-1', 'conn-123');
  });

  it('listConnections delegates to service', async () => {
    const query = { limit: 20 };
    await controller.listConnections(mockUser, query);
    expect(service.listConnections).toHaveBeenCalledWith('user-1', query);
  });

  it('listPendingRequests delegates to service', async () => {
    const query = { limit: 20 };
    await controller.listPendingRequests(mockUser, query);
    expect(service.listPendingRequests).toHaveBeenCalledWith('user-1', query);
  });
});

describe('ConnectionsUsersController', () => {
  let controller: ConnectionsUsersController;
  let service: MockService;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
  };

  beforeEach(() => {
    service = {
      sendRequest: jest.fn(),
      acceptRequest: jest.fn(),
      declineRequest: jest.fn(),
      removeConnection: jest.fn(),
      follow: jest.fn().mockResolvedValue({ id: 'follow-1' }),
      unfollow: jest.fn().mockResolvedValue(undefined),
      blockUser: jest.fn().mockResolvedValue({ id: 'block-1' }),
      unblockUser: jest.fn().mockResolvedValue(undefined),
      listConnections: jest.fn(),
      listPendingRequests: jest.fn(),
    };
    controller = new ConnectionsUsersController(
      service as unknown as ConnectionsService,
    );
  });

  it('follow delegates to service', async () => {
    await controller.follow(mockUser, 'user-2');
    expect(service.follow).toHaveBeenCalledWith('user-1', 'user-2');
  });

  it('unfollow delegates to service', async () => {
    await controller.unfollow(mockUser, 'user-2');
    expect(service.unfollow).toHaveBeenCalledWith('user-1', 'user-2');
  });

  it('blockUser delegates to service', async () => {
    await controller.blockUser(mockUser, 'user-2');
    expect(service.blockUser).toHaveBeenCalledWith('user-1', 'user-2');
  });

  it('unblockUser delegates to service', async () => {
    await controller.unblockUser(mockUser, 'user-2');
    expect(service.unblockUser).toHaveBeenCalledWith('user-1', 'user-2');
  });
});
