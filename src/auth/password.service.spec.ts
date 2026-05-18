import { Test, type TestingModule } from "@nestjs/testing";
import { PasswordService } from "./password.service";

describe("PasswordService", () => {
	let service: PasswordService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [PasswordService],
		}).compile();

		service = module.get<PasswordService>(PasswordService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	describe("hash", () => {
		it("should hash a password", async () => {
			const password = "test1234";
			const hash = await service.hash(password);

			expect(hash).toBeDefined();
			expect(hash).not.toBe(password);
			expect(hash.length).toBe(60); // bcrypt hash length
			expect(hash.startsWith("$2b$12$")).toBe(true);
		});
	});

	describe("compare", () => {
		it("should return true for matching password", async () => {
			const password = "test1234";
			const hash = await service.hash(password);
			const isMatch = await service.compare(password, hash);

			expect(isMatch).toBe(true);
		});

		it("should return false for non-matching password", async () => {
			const password = "test1234";
			const hash = await service.hash(password);
			const isMatch = await service.compare("wrong", hash);

			expect(isMatch).toBe(false);
		});
	});

	describe("getRounds", () => {
		it("should extract cost factor from hash", () => {
			const hash = "$2b$12$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJ";
			const rounds = service.getRounds(hash);

			expect(rounds).toBe(12);
		});
	});
});
