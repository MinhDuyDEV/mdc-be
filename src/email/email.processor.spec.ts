import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { EmailProcessor } from "./email.processor";
import { PrismaService } from "../infra/prisma/prisma.service";
import { MAILER_TRANSPORTER } from "../infra/mailer/mailer.constants";
import { EmailService } from "./email.service";

describe("EmailProcessor", () => {
  let processor: EmailProcessor;
  let prisma: PrismaService;
  let mailerService: { sendMail: jest.Mock };

  beforeEach(async () => {
    mailerService = { sendMail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        {
          provide: PrismaService,
          useValue: {
            emailDelivery: {
              update: jest.fn(),
            },
          },
        },
        {
          provide: MAILER_TRANSPORTER,
          useValue: mailerService,
        },
        {
          provide: EmailService,
          useValue: {
            renderTemplate: jest.fn().mockReturnValue("<html>Hello</html>"),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config: Record<string, unknown> = {
                emailFrom: "test@example.com",
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    processor = module.get<EmailProcessor>(EmailProcessor);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it("should be defined", () => {
    expect(processor).toBeDefined();
  });

  describe("processEmail", () => {
    it("should call mailerService.sendMail and update status to SENT", async () => {
      const event = {
        id: "ed-1",
        to: "user@example.com",
        subject: "Welcome",
        template: "email-verification",
        context: { name: "Test" },
      };

      mailerService.sendMail.mockResolvedValue({ messageId: "abc-123" });
      jest.spyOn(prisma.emailDelivery, "update").mockResolvedValue({} as any);

      await processor.process(event);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "test@example.com",
          to: event.to,
          subject: event.subject,
        }),
      );
      expect(prisma.emailDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "SENT" }),
        }),
      );
    });
  });
});
