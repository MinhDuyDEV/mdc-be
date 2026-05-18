import type { AuthenticatedUser } from '../common/auth/current-user.interface';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
