/**
 * Email sender integration using nodemailer.
 *
 * Configuration (environment variables):
 *   SMTP_HOST     — SMTP server host (e.g. smtp.gmail.com, smtp.resend.com)
 *   SMTP_PORT     — SMTP port (default 587)
 *   SMTP_USER     — SMTP username
 *   SMTP_PASS     — SMTP password or API key
 *   SMTP_FROM     — From address, e.g. "Care Setu <noreply@caresetu.in>"
 *
 * If SMTP_HOST is not set, emails are logged to console only (development mode).
 */

import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) {
    // Development/testing: use ethereal-style console logging
    return nodemailer.createTransport({
      jsonTransport: true,
    } as any);
  }

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    secure: (process.env.SMTP_PORT ?? "587") === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ messageId: string }> {
  const transporter = createTransport();
  const from = process.env.SMTP_FROM ?? "Care Setu <noreply@caresetu.in>";

  const info = await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments,
  });

  if (!process.env.SMTP_HOST) {
    // Development: log to console
    console.log(`[email-sender] DEV MODE — email NOT sent. Would have sent to ${opts.to}`);
    console.log(`[email-sender]   subject: ${opts.subject}`);
    if (opts.attachments?.length) {
      console.log(`[email-sender]   attachments: ${opts.attachments.map((a) => a.filename).join(", ")}`);
    }
  }

  return { messageId: info.messageId ?? "dev-no-message-id" };
}
