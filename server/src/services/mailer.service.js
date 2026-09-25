/**
 * Transactional email.
 *
 * Replaces PHP mail(). The provider is chosen purely by configuration:
 *
 *   MAIL_PROVIDER=smtp     -> nodemailer against SMTP_HOST
 *   MAIL_PROVIDER=resend   -> Resend HTTP API
 *   MAIL_PROVIDER=log      -> no-op that only writes to the log (default)
 *
 * Nothing in here ever throws at the caller. A failed email must never
 * undo a successful registration, so send() reports success as a boolean
 * and the caller records the outcome in email_log.
 */
import nodemailer from 'nodemailer';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import { registrationEmailTemplate, broadcastEmailTemplate } from '../utils/html.js';

let cachedTransport = null;

function fromHeader() {
  return config.SMTP_FROM
    ? `"${config.SMTP_FROM_NAME}" <${config.SMTP_FROM}>`
    : config.SMTP_FROM_NAME;
}

function getSmtpTransport() {
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  });
  return cachedTransport;
}

async function sendViaSmtp({ to, subject, html, attachments }) {
  const info = await getSmtpTransport().sendMail({
    from: fromHeader(),
    to,
    subject,
    html,
    attachments,
  });
  return info?.messageId ?? null;
}

async function sendViaResend({ to, subject, html, attachments }) {
  // Attachments are inlined as base64, which the Resend API accepts.
  const content = (attachments ?? []).map((attachment) => ({
    filename: attachment.filename,
    content: Buffer.from(attachment.content).toString('base64'),
  }));

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.SMTP_FROM ?? 'onboarding@resend.dev',
      to: [to],
      subject,
      html,
      attachments: content,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend responded ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = await response.json().catch(() => ({}));
  return payload?.id ?? null;
}

async function sendViaLog({ to, subject, html }) {
  logger.info({ to, subject, bytes: html?.length ?? 0 }, '[mail:log] email not sent');
  return 'logged';
}

/**
 * Send one email.
 * @param {{ to: string, subject: string, html: string, attachments?: Array<{filename:string, content:Buffer}> }} params
 * @returns {Promise<{ ok: boolean, messageId?: string|null, error?: string }>}
 */
export async function send({ to, subject, html, attachments = [] }) {
  const payload = { to, subject, html, attachments };

  try {
    if (config.MAIL_PROVIDER === 'smtp') {
      const messageId = await sendViaSmtp(payload);
      logger.info({ to, subject, messageId }, 'email sent via SMTP');
      return { ok: true, messageId };
    }

    if (config.MAIL_PROVIDER === 'resend') {
      const id = await sendViaResend(payload);
      logger.info({ to, subject, messageId: id }, 'email sent via Resend');
      return { ok: true, messageId: id };
    }

    const messageId = await sendViaLog(payload);
    return { ok: true, messageId };
  } catch (error) {
    logger.error({ err: error, to, subject }, 'email delivery failed');
    return { ok: false, error: error.message };
  }
}

/** Reset the cached transport. Used by tests. */
export function resetTransport() {
  cachedTransport = null;
}

/**
 * Registration confirmation, with the pass attached.
 * @param {{ participant: object, verifyUrl: string, passBuffer?: Buffer|null, passFilename?: string, eventName?: string }} params
 */
export async function sendRegistrationConfirmation({
  participant,
  verifyUrl,
  passBuffer = null,
  passFilename = 'attendee-pass.jpg',
  eventName = 'Mowe-Ibafo X Community Fitness Walk 2026',
}) {
  const html = registrationEmailTemplate({ participant, verifyUrl, eventName });

  const attachments = passBuffer
    ? [{ filename: passFilename, content: passBuffer }]
    : [];

  return send({
    to: participant.email,
    subject: `🎉 Registration Confirmed — ${eventName}`,
    html,
    attachments,
  });
}

/** Admin broadcast to one participant. */
export async function sendBroadcast({ participant, subject, message }) {
  const html = broadcastEmailTemplate({ participant, message });
  return send({ to: participant.email, subject, html });
}

export default { send, sendRegistrationConfirmation, sendBroadcast, resetTransport };
