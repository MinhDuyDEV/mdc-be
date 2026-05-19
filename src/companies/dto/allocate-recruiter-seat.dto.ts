import { IsUUID } from "class-validator";

export class AllocateRecruiterSeatDto {
	@IsUUID()
	userId!: string;
}
