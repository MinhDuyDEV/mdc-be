import { Test, type TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EmailVerificationService } from "./email-verification.service";
import { PasswordResetService } from "./password-reset.service";
import { TokenService } from "./token.service";

describe("AuthController", () => {
	let controller: AuthController;
	let authService: AuthService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [
				{
					provide: AuthService,
					useValue: {
						register: jest.fn(),
						login: jest.fn(),
					},
				},
				{
					provide: TokenService,
					useValue: {
						validateAndRotateRefreshToken: jest.fn(),
						revokeRefreshToken: jest.fn(),
					},
				},
				{
					provide: EmailVerificationService,
					useValue: {
						generateToken: jest.fn(),
						verifyToken: jest.fn(),
					},
				},
				{
					provide: PasswordResetService,
					useValue: {
						requestReset: jest.fn(),
						confirmReset: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get<AuthController>(AuthController);
		authService = module.get<AuthService>(AuthService);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});

	describe("register", () => {
		it("should call authService.register with dto", async () => {
			const dto = { email: "test@example.com", password: "password123" };
			const expected = { id: "user-123", email: dto.email };
			jest.spyOn(authService, "register").mockResolvedValue(expected as any);

			const result = await controller.register(dto);
			expect(result).toEqual(expected);
			expect(authService.register).toHaveBeenCalledWith(dto);
		});
	});

	describe("password reset", () => {
		it("should have requestPasswordReset endpoint", () => {
			expect(controller.requestPasswordReset).toBeDefined();
		});

		it("should have confirmPasswordReset endpoint", () => {
			expect(controller.confirmPasswordReset).toBeDefined();
		});
	});
});
