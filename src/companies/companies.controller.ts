import { Controller } from "@nestjs/common";
import type { CompaniesService } from "./companies.service";

@Controller("companies")
export class CompaniesController {
	constructor(private readonly companiesService: CompaniesService) {}

	// Controller methods will be implemented in Task 5
}
