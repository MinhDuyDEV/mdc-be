import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class CompanyMemberResponseDto {
	@Expose()
	id!: string;

	@Expose()
	userId!: string;

	@Expose()
	role!: string;

	@Expose()
	title!: string | null;

	@Expose()
	status!: string;

	@Expose()
	joinedAt!: Date;
}

@Exclude()
export class CompanyResponseDto {
	@Expose()
	id!: string;

	@Expose()
	name!: string;

	@Expose()
	slug!: string;

	@Expose()
	industry!: string | null;

	@Expose()
	description!: string | null;

	@Expose()
	website!: string | null;

	@Expose()
	verified!: boolean;

	@Expose()
	verifiedAt!: Date | null;

	@Expose()
	followerCount!: number;

	@Expose()
	employeeCount!: string | null;

	@Expose()
	foundedYear!: number | null;

	@Expose()
	headquarters!: string | null;

	@Expose()
	@Type(() => CompanyMemberResponseDto)
	members?: CompanyMemberResponseDto[];

	@Expose()
	createdAt!: Date;

	@Expose()
	updatedAt!: Date;
}
