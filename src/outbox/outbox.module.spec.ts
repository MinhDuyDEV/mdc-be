import { Test } from "@nestjs/testing";
import { OutboxModule } from "./outbox.module";

describe("OutboxModule", () => {
	it("should compile", async () => {
		const module = await Test.createTestingModule({
			imports: [OutboxModule],
		}).compile();

		expect(module).toBeDefined();
	});
});
