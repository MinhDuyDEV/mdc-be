import type { ConnectionStatus } from '@prisma/client';

export class ConnectionResponseDto {
  id!: string;
  requesterId!: string;
  addresseeId!: string;
  status!: ConnectionStatus;
  createdAt!: Date;
  updatedAt!: Date;

  requester?: {
    id: string;
    email: string;
    profile?: {
      firstName: string | null;
      lastName: string | null;
      headline: string | null;
    };
  };

  addressee?: {
    id: string;
    email: string;
    profile?: {
      firstName: string | null;
      lastName: string | null;
      headline: string | null;
    };
  };
}
