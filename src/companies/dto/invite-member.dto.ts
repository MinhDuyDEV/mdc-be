import { IsEmail, IsString, MaxLength } from "class-validator";

export class InviteMemberDto {
	@IsEmail()
	email!: string;

	@IsString()
	@MaxLength(50)
	role!: string;
}
