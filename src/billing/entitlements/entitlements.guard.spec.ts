import { type ExecutionContext, ForbiddenException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { EntitlementsGuard } from "./entitlements.guard";
import type { EntitlementsService } from "./entitlements.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildContext(
	params: Record<string, string | undefined>,
): ExecutionContext {
	const handler = jest.fn();
	const cls = jest.fn();

	return {
		getHandler: () => handler,
		getClass: () => cls,
		switchToHttp: () => ({
			getRequest: () => ({ params }),
		}),
	} as unknown as ExecutionContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EntitlementsGuard", () => {
	let guard: EntitlementsGuard;
	let reflector: jest.Mocked<Reflector>;
	let entitlementsService: jest.Mocked<EntitlementsService>;

	beforeEach(async () => {
		reflector = {
			getAllAndOverride: jest.fn(),
		} as unknown as jest.Mocked<Reflector>;

		entitlementsService = {
			checkLimit: jest.fn(),
		} as unknown as jest.Mocked<EntitlementsService>;

		// Construct directly — no need for a full NestJS testing module.
		guard = new EntitlementsGuard(reflector, entitlementsService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// -------------------------------------------------------------------------
	// Case 1: No @RequireEntitlement() metadata — guard is a no-op
	// -------------------------------------------------------------------------
	it("returns true when @RequireEntitlement() metadata is absent", async () => {
		reflector.getAllAndOverride.mockReturnValue(undefined);

		const ctx = buildContext({ companyId: "company-1" });
		const result = await guard.canActivate(ctx);

		expect(result).toBe(true);
		expect(entitlementsService.checkLimit).not.toHaveBeenCalled();
	});

	// -------------------------------------------------------------------------
	// Case 2: Metadata present + credits available → allow
	// -------------------------------------------------------------------------
	it("returns true when credits are available", async () => {
		reflector.getAllAndOverride.mockReturnValue("job_posts");
		entitlementsService.checkLimit.mockResolvedValue(true);

		const ctx = buildContext({ companyId: "company-1" });
		const result = await guard.canActivate(ctx);

		expect(result).toBe(true);
		expect(entitlementsService.checkLimit).toHaveBeenCalledWith(
			"company-1",
			"job_posts",
		);
	});

	// -------------------------------------------------------------------------
	// Case 3: Metadata present + credits exhausted → 403
	// -------------------------------------------------------------------------
	it("throws ForbiddenException(ENTITLEMENT_EXCEEDED) when credits exhausted", async () => {
		reflector.getAllAndOverride.mockReturnValue("job_posts");
		entitlementsService.checkLimit.mockResolvedValue(false);

		const ctx = buildContext({ companyId: "company-1" });

		await expect(guard.canActivate(ctx)).rejects.toThrow(
			new ForbiddenException("ENTITLEMENT_EXCEEDED"),
		);
	});

	// -------------------------------------------------------------------------
	// Case 4: Metadata present + no companyId in params → 403
	// -------------------------------------------------------------------------
	it("throws ForbiddenException(COMPANY_ID_REQUIRED) when no companyId in params", async () => {
		reflector.getAllAndOverride.mockReturnValue("job_posts");

		const ctx = buildContext({});

		await expect(guard.canActivate(ctx)).rejects.toThrow(
			new ForbiddenException("COMPANY_ID_REQUIRED"),
		);
		expect(entitlementsService.checkLimit).not.toHaveBeenCalled();
	});

	// -------------------------------------------------------------------------
	// Case 5: Resolves companyId from params.companyId
	// -------------------------------------------------------------------------
	it("resolves companyId from params.companyId", async () => {
		reflector.getAllAndOverride.mockReturnValue("job_posts");
		entitlementsService.checkLimit.mockResolvedValue(true);

		const ctx = buildContext({ companyId: "company-42" });
		await guard.canActivate(ctx);

		expect(entitlementsService.checkLimit).toHaveBeenCalledWith(
			"company-42",
			"job_posts",
		);
	});

	// -------------------------------------------------------------------------
	// Case 6: Resolves companyId from params.id (fallback)
	// -------------------------------------------------------------------------
	it("resolves companyId from params.id when companyId is absent", async () => {
		reflector.getAllAndOverride.mockReturnValue("job_posts");
		entitlementsService.checkLimit.mockResolvedValue(true);

		const ctx = buildContext({ id: "company-99" });
		await guard.canActivate(ctx);

		expect(entitlementsService.checkLimit).toHaveBeenCalledWith(
			"company-99",
			"job_posts",
		);
	});
});
