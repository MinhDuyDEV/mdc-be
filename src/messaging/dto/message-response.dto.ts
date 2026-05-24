export class MessageResponseDto {
  id!: string;
  conversationId!: string;
  senderId!: string;
  content!: string;
  type!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
