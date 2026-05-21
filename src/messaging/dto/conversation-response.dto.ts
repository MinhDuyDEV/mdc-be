export class ConversationParticipantDto {
  id: string;
  userId: string;
  role: string;
  lastReadAt: Date | null;
  joinedAt: Date;
}

export class ConversationResponseDto {
  id: string;
  type: string;
  title: string | null;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  createdAt: Date;
  updatedAt: Date;
  participants: ConversationParticipantDto[];
}
