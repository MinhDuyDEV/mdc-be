import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import * as Handlebars from 'handlebars';
import { join } from 'path';
import type { AppConfig } from '../infra/config/app-config';
import { PrismaService } from '../infra/prisma/prisma.service';

export interface SendEmailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly templateCache = new Map<
    string,
    HandlebarsTemplateDelegate
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async send(options: SendEmailOptions): Promise<{ message: string }> {
    // Marketing consent check: skip job-alert if user has unsubscribed
    if (options.template === 'job-alert') {
      const user = await this.prisma.user.findUnique({
        where: { email: options.to },
        select: { id: true },
      });
      if (user) {
        const consent = await this.prisma.emailConsent.findUnique({
          where: { userId: user.id },
        });
        if (!consent?.marketingConsent || consent.unsubscribedAt) {
          this.logger.log(
            `Email skipped (unsubscribed): ${options.template} → ${options.to}`,
          );
          return { message: 'Email skipped: user has unsubscribed' };
        }
      }
    }

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
    // Check cache first
    let compiled = this.templateCache.get(templateName);

    if (!compiled) {
      // Load template from file
      const templatePath = join(__dirname, 'templates', `${templateName}.hbs`);

      try {
        const templateSource = readFileSync(templatePath, 'utf-8');
        compiled = Handlebars.compile(templateSource);
        this.templateCache.set(templateName, compiled);
      } catch (error) {
        this.logger.error(`Failed to load template ${templateName}`, error);
        // Fallback to empty template
        compiled = Handlebars.compile('');
      }
    }

    return compiled(context);
  }
}
