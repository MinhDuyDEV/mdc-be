import { IsUUID } from "class-validator";

export class MessageReadDto {
	@IsUUID()
	messageId: string;

	@IsUUID()
	conversationId: string;
}
