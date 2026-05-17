export const MAILER_TRANSPORTER = Symbol('MAILER_TRANSPORTER');
export type MailerTransporter = import('nodemailer').Transporter;
