import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../infra/prisma/prisma.service';
import type { AppConfig } from '../infra/config/app-config';
import * as Handlebars from 'handlebars';

export interface SendEmailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async send(options: SendEmailOptions): Promise<{ message: string }> {
    await this.prisma.emailDelivery.create({
      data: {
        to: options.to,
        subject: options.subject,
        template: options.template,
        context:
          options.context as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Email queued: ${options.template} → ${options.to}`);

    return { message: 'Email queued for delivery' };
  }

  renderTemplate(
    templateName: string,
    context: Record<string, unknown>,
  ): string {
    const templates: Record<string, string> = {
      'email-verification': `<h1>Verify Your Email</h1><p>Click <a href="{{link}}">here</a> to verify.</p>`,
      'password-reset': `<h1>Reset Your Password</h1><p>Click <a href="{{link}}">here</a> to reset.</p>`,
    };

    const template = templates[templateName] || '';
    const compiled = Handlebars.compile(template);
    return compiled(context);
  }
}
