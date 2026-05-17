import { Inject, Injectable } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config';
import type { MailerTransporter } from './mailer.constants';
import { MAILER_TRANSPORTER } from './mailer.constants';

@Injectable()
export class MailerService {
  constructor(
    @Inject(MAILER_TRANSPORTER) private readonly transporter: MailerTransporter,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async verifyConnection(): Promise<void> {
    if (typeof this.transporter.verify === 'function') {
      await this.transporter.verify();
    }
  }

  async sendMail(mail: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get('emailFrom', { infer: true }),
      ...mail,
    });
  }
}
