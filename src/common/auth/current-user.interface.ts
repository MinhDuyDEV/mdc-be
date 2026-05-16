export interface AuthenticatedUser {
  id: string;
  email?: string;
  roles?: readonly string[];
}
