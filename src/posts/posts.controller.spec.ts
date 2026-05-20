import { PostsController } from './posts.controller';

describe('PostsController', () => {
  let controller: PostsController;

  let service: any;

  beforeEach(() => {
    service = {
      createPost: jest.fn(),
      getPost: jest.fn(),
      updatePost: jest.fn(),
      deletePost: jest.fn(),
      createComment: jest.fn(),
      updateComment: jest.fn(),
      deleteComment: jest.fn(),
      addReaction: jest.fn(),
      removeReaction: jest.fn(),
      savePost: jest.fn(),
      unsavePost: jest.fn(),
      hidePost: jest.fn(),
      unhidePost: jest.fn(),
    };
    controller = new PostsController(service);
  });

  it('should delegate createPost to service', async () => {
    const user = { id: 'user1' } as any;
    const dto = { content: 'test' } as any;
    await controller.createPost(user, dto);
    expect(service.createPost).toHaveBeenCalledWith('user1', dto);
  });

  it('should delegate getPost to service', async () => {
    const user = { id: 'user1' } as any;
    await controller.getPost(user, 'post1');
    expect(service.getPost).toHaveBeenCalledWith('user1', 'post1');
  });

  it('should delegate updatePost to service', async () => {
    const user = { id: 'user1' } as any;
    const dto = { content: 'updated' } as any;
    await controller.updatePost(user, 'post1', dto);
    expect(service.updatePost).toHaveBeenCalledWith('user1', 'post1', dto);
  });

  it('should delegate deletePost to service', async () => {
    const user = { id: 'user1' } as any;
    await controller.deletePost(user, 'post1');
    expect(service.deletePost).toHaveBeenCalledWith('user1', 'post1');
  });
});
