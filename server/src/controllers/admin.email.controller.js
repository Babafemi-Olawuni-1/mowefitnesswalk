/**
 * Admin email broadcast and CSV export.
 */
import * as participants from '../models/participant.model.js';
import * as sponsors from '../models/sponsor.model.js';
import * as contacts from '../models/contact.model.js';
import * as eventModel from '../models/event.model.js';
import { broadcastSchema } from '../validators/schemas.js';
import { sendBroadcast } from '../services/mailer.service.js';
import { buildCsv, sendCsv, PARTICIPANT_HEADERS, SPONSOR_HEADERS, CONTACT_HEADERS } from '../services/csv.service.js';
import { formatDate } from '../services/registration.service.js';
import AppError from '../utils/errors.js';
import logger from '../utils/logger.js';
import { sendSuccess } from '../utils/response.js';

/**
 * POST /api/admin/email/send
 *
 * Sends sequentially and records every outcome in email_log. One bad
 * address does not abort the run.
 */
export async function sendEmail(req, res) {
  const { subject, message, target } = broadcastSchema.parse(req.body ?? {});

  let recipients;
  if (Array.isArray(target)) {
    recipients = await participants.byIds(target);
  } else if (target === 'all') {
    recipients = await participants.all('');
  } else {
    recipients = await participants.all(target);
  }

  if (recipients.length === 0) {
    throw AppError.badRequest('No participants found for the selected target.');
  }

  let sent = 0;
  let failed = 0;

  for (const participant of recipients) {
    const result = await sendBroadcast({ participant, subject, message });
    const status = result.ok ? 'sent' : 'failed';

    if (result.ok) sent += 1;
    else failed += 1;

    await eventModel.logEmail({ recipient: participant.email, subject, status });
  }

  logger.info({ sent, failed, total: recipients.length }, 'broadcast complete');

  return sendSuccess(
    res,
    { sent, failed, total: recipients.length },
    `Email sent to ${sent} participant(s).`
  );
}

/** GET /api/admin/export/:type */
export async function exportCsv(req, res) {
  const type = String(req.params.type ?? '');

  if (type === 'participants') {
    const records = await participants.all('');
    const body = records.map((r) => [
      r.id,
      r.participant_id,
      r.full_name,
      r.email,
      r.phone,
      r.status,
      formatDate(r.registered_at),
    ]);

    return sendCsv(res, `participants_${stamp()}.csv`, buildCsv(PARTICIPANT_HEADERS, body));
  }

  if (type === 'sponsors') {
    const records = await sponsors.all(false);
    const body = records.map((r) => [
      r.id,
      r.business_name,
      r.website_url ?? '',
      r.whatsapp ?? '',
      r.priority,
      r.status,
    ]);

    return sendCsv(res, `sponsors_${stamp()}.csv`, buildCsv(SPONSOR_HEADERS, body));
  }

  if (type === 'contacts') {
    const records = await contacts.all('');
    const body = records.map((r) => [
      r.id,
      r.name,
      r.email,
      r.phone ?? '',
      r.subject,
      r.status,
      formatDate(r.created_at),
    ]);

    return sendCsv(res, `contacts_${stamp()}.csv`, buildCsv(CONTACT_HEADERS, body));
  }

  throw AppError.notFound(`Export type '${type}' not found.`);
}

function stamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

export default { sendEmail, exportCsv };
