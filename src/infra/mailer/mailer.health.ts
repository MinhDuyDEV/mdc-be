import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config';
import type { MailerTransporter } from './mailer.constants';
import { MAILER_TRANSPORTER } from './mailer.constants';

@Injectable()
export class MailerHealthService {
  constructor(
    @Inject(MAILER_TRANSPORTER) private readonly transporter: MailerTransporter,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async ping(): Promise<void> {
    // streamTransport has verify === false, not a function — skip check
    if (typeof this.transporter.verify !== 'function') {
      return;
    }

    const timeoutMs = this.configService.get('healthMailerTimeoutMs', {
      infer: true,
    });

    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.transporter.verify(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Mailer health check timed out')),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }
}
