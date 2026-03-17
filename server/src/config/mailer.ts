import nodemailer from 'nodemailer';
import { env } from './env';

// Singleton SMTP transporter — created once, reused for every email call.
// In development: connect to the Mailhog container (no auth needed, all
// outbound mail is caught and displayed at http://localhost:8025).
// In every other environment: use AWS SES over STARTTLS on port 587.
export const mailer = nodemailer.createTransport(
  env.NODE_ENV === 'development'
    ? {
        host: 'mailhog',
        port: 1025,
        secure: false,
      }
    : {
        host: `email-smtp.${env.SES_REGION}.amazonaws.com`,
        port: 587,
        secure: false,
        auth: {
          user: env.SES_SMTP_USER,
          pass: env.SES_SMTP_PASS,
        },
      }
);
