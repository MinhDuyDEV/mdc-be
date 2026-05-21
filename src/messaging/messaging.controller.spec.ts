import { MessagingController } from './messaging.controller';

describe('MessagingController', () => {
  let controller: MessagingController;
  let service: any;

  beforeEach(() => {
    service = {
      createConversation: jest.fn(),
      createRecruitingConversation: jest.fn(),
      listConversations: jest.fn(),
      getConversation: jest.fn(),
      sendMessage: jest.fn(),
      getMessages: jest.fn(),
      markRead: jest.fn(),
    };
    controller = new MessagingController(service);
  });

  it('POST /conversations calls service.createConversation', async () => {
    const user = { id: 'user-1', email: 'test@example.com' };
    const dto = { participantIds: ['user-2'] };
    service.createConversation.mockResolvedValue({ id: 'conv-1' });

    const result = await controller.createConversation(user, dto);

    expect(service.createConversation).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual({ id: 'conv-1' });
  });

  it('POST /conversations/recruiting calls service.createRecruitingConversation', async () => {
    const user = { id: 'recruiter-1', email: 'recruiter@example.com' };
    const dto = { candidateUserId: 'candidate-1' };
    service.createRecruitingConversation.mockResolvedValue({ id: 'conv-2' });

    const result = await controller.createRecruitingConversation(user, dto);

    expect(service.createRecruitingConversation).toHaveBeenCalledWith(
      'recruiter-1',
      dto,
    );
    expect(result).toEqual({ id: 'conv-2' });
  });

  it('GET /conversations calls service.listConversations', async () => {
    const user = { id: 'user-1' };
    const query = { limit: 20 };
    service.listConversations.mockResolvedValue({
      data: [],
      meta: { hasNextPage: false, limit: 20 },
    });

    const result = await controller.listConversations(user, query);

    expect(service.listConversations).toHaveBeenCalledWith('user-1', query);
    expect(result.data).toEqual([]);
  });

  it('GET /conversations/:id calls service.getConversation', async () => {
    const user = { id: 'user-1' };
    service.getConversation.mockResolvedValue({ id: 'conv-1' });

    const result = await controller.getConversation(user, 'conv-1');

    expect(service.getConversation).toHaveBeenCalledWith('user-1', 'conv-1');
    expect(result).toEqual({ id: 'conv-1' });
  });

  it('POST /conversations/:id/messages calls service.sendMessage', async () => {
    const user = { id: 'user-1', email: 'test@example.com' };
    const dto = { content: 'Hello' };
    service.sendMessage.mockResolvedValue({ id: 'msg-1' });

    const result = await controller.sendMessage(user, 'conv-1', dto);

    expect(service.sendMessage).toHaveBeenCalledWith('user-1', 'conv-1', dto);
    expect(result).toEqual({ id: 'msg-1' });
  });

  it('GET /conversations/:id/messages calls service.getMessages', async () => {
    const user = { id: 'user-1' };
    const query = { limit: 20 };
    service.getMessages.mockResolvedValue({
      data: [],
      meta: { hasNextPage: false, limit: 20 },
    });

    const result = await controller.getMessages(user, 'conv-1', query);

    expect(service.getMessages).toHaveBeenCalledWith('user-1', 'conv-1', query);
    expect(result.data).toEqual([]);
  });

  it('PATCH /conversations/:id/read calls service.markRead', async () => {
    const user = { id: 'user-1' };
    service.markRead.mockResolvedValue({ ok: true });

    const result = await controller.markRead(user, 'conv-1');

    expect(service.markRead).toHaveBeenCalledWith('user-1', 'conv-1');
    expect(result).toEqual({ ok: true });
  });
});
