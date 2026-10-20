// Scheduled Reports — sends email through the company mailbox (SMTP).
// Settings live in Vercel → Settings → Environment Variables (never in the code):
//   SMTP_HOST     e.g. smtp.office365.com / smtp.gmail.com / mail.yourcompany.com
//   SMTP_PORT     587 (STARTTLS, default) or 465 (SSL)
//   SMTP_USER     the mailbox, e.g. reports@yourcompany.com
//   SMTP_PASS     its password / app password
//   SMTP_FROM     optional, e.g. "BHS Reports <reports@yourcompany.com>"
//   SMTP_SECURE   optional, "true" for SSL (default: true only on port 465)

import nodemailer from 'nodemailer';

export function mailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function mailFrom(): string | null {
  if (!mailConfigured()) return null;
  return process.env.SMTP_FROM?.trim() || `BHS Reports <${process.env.SMTP_USER}>`;
}

let transporter: any = null;

function getTransporter() {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 587);
  const secureEnv = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: secureEnv ? secureEnv === 'true' : port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return transporter;
}

export async function sendMail(mail: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}): Promise<void> {
  if (!mailConfigured()) throw new Error('Email is not set up yet (SMTP settings in Vercel).');
  await getTransporter().sendMail({
    from: mailFrom(),
    to: mail.to.join(', '),
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments: mail.attachments,
  });
}
