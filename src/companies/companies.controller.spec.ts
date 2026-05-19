import { Test, type TestingModule } from "@nestjs/testing";
import { CompaniesController } from "./companies.controller";
import { CompaniesService } from "./companies.service";

describe("CompaniesController", () => {
	let controller: CompaniesController;
	let mockService: any;

	beforeEach(async () => {
		mockService = {
			createCompany: jest.fn(),
			getCompanyBySlug: jest.fn(),
			updateCompany: jest.fn(),
			followCompany: jest.fn(),
			unfollowCompany: jest.fn(),
			inviteMember: jest.fn(),
			acceptInvitation: jest.fn(),
			allocateRecruiterSeat: jest.fn(),
			deallocateRecruiterSeat: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [CompaniesController],
			providers: [{ provide: CompaniesService, useValue: mockService }],
		}).compile();

		controller = module.get<CompaniesController>(CompaniesController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});

	describe("POST /companies", () => {
		it("should create company", async () => {
			const user = { id: "user-123" };
			const dto = { name: "Acme Corp", industry: "TECHNOLOGY" };
			const created = { id: "company-123", slug: "acme-corp", ...dto };

			mockService.createCompany.mockResolvedValue(created);

			const result = await controller.createCompany(user as any, dto as any);

			expect(mockService.createCompany).toHaveBeenCalledWith("user-123", dto);
			expect(result).toEqual(created);
		});
	});

	describe("GET /companies/:slug", () => {
		it("should return company by slug", async () => {
			const company = { id: "company-123", slug: "acme-corp" };
			mockService.getCompanyBySlug.mockResolvedValue(company);

			const result = await controller.getCompanyBySlug("acme-corp");

			expect(mockService.getCompanyBySlug).toHaveBeenCalledWith("acme-corp");
			expect(result).toEqual(company);
		});
	});
});
