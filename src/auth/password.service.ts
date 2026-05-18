import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";

@Injectable()
export class PasswordService {
	private readonly SALT_ROUNDS = 12;

	async hash(password: string): Promise<string> {
		return bcrypt.hash(password, this.SALT_ROUNDS);
	}

	async compare(password: string, hash: string): Promise<boolean> {
		return bcrypt.compare(password, hash);
	}

	getRounds(hash: string): number {
		const parts = hash.split("$");
		return parseInt(parts[2], 10);
	}

	async needsRehash(hash: string): Promise<boolean> {
		const currentRounds = this.getRounds(hash);
		return currentRounds < this.SALT_ROUNDS;
	}
}
