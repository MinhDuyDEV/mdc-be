import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import type { AppConfig } from '../config';
import type { MailerTransporter } from './mailer.constants';
import { MAILER_TRANSPORTER } from './mailer.constants';

export const mailerTransporterProvider = {
  provide: MAILER_TRANSPORTER,
  inject: [ConfigService],
  useFactory: (
    configService: ConfigService<AppConfig, true>,
  ): MailerTransporter => {
    const nodeEnv = configService.get('nodeEnv', { infer: true });
    const smtpHost = configService.get('smtpHost', { infer: true });

    if (nodeEnv === 'development' && smtpHost === '') {
      return createTransport({ streamTransport: true, newline: 'unix' });
    }

    return createTransport({
      host: smtpHost,
      port: configService.get('smtpPort', { infer: true }),
      secure: configService.get('smtpSecure', { infer: true }),
      auth: {
        user: configService.get('smtpUser', { infer: true }),
        pass: configService.get('smtpPass', { infer: true }),
      },
      tls: {
        rejectUnauthorized: nodeEnv === 'production',
      },
    });
  },
};
