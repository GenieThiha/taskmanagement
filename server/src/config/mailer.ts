import nodemailer from 'nodemailer';
import { env } from './env';

// Singleton SMTP transporter — created once, reused for every email call.
// Creating a new transport per request (as previously done) allocates a
// fresh connection pool each time, which is wasteful and slow.
export const mailer = nodemailer.createTransport({
  host: `email-smtp.${env.SES_REGION}.amazonaws.com`,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SES_SMTP_USER,
    pass: process.env.SES_SMTP_PASS,
  },
});
