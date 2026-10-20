// Scheduled Reports — sends the email.
// 1) Zoho Mail API, when Zoho Mail is connected in the module (recommended: Zoho blocks SMTP from Vercel)
// 2) otherwise SMTP (any other mailbox, e.g. Gmail), from Vercel → Environment Variables:
//    SMTP_HOST, SMTP_PORT (587 / 465), SMTP_USER, SMTP_PASS, optional SMTP_FROM, SMTP_SECURE

import nodemailer from 'nodemailer';
import { getZohoConnection, sendViaZoho } from './ZohoMail';

const smtpReady = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export async function mailStatus(): Promise<{ ready: boolean; provider: 'zoho' | 'smtp' | null; from: string | null }> {
  const zoho = await getZohoConnection();
  if (zoho && process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET) return { ready: true, provider: 'zoho', from: zoho.fromEmail };
  if (smtpReady()) return { ready: true, provider: 'smtp', from: process.env.SMTP_FROM?.trim() || `BHS Reports <${process.env.SMTP_USER}>` };
  return { ready: false, provider: null, from: null };
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
  const status = await mailStatus();
  if (status.provider === 'zoho') {
    const conn = await getZohoConnection();
    if (conn) return sendViaZoho(conn, mail);
  }
  if (status.provider !== 'smtp') throw new Error('Email is not set up yet — connect Zoho Mail (✉ button in Scheduled Reports)');
  await getTransporter().sendMail({
    from: status.from,
    to: mail.to.join(', '),
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments: mail.attachments,
  });
}
