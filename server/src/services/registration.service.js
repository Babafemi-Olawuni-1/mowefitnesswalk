/**
 * Registration orchestration.
 *
 * This is the heart of the application. The order of operations matters:
 *
 *   1. validate (done by the controller, before this is called)
 *   2. check duplicates
 *   3. reserve a unique participant id from the sequence
 *   4. upload the passport photo
 *   5. insert the participant row
 *   6. generate + upload the QR code
 *   7. generate + upload the attendee pass
 *   8. update the stored paths
 *   9. send the confirmation email
 *  10. record the email outcome in email_log
 *
 * A failure in steps 9-10 NEVER deletes the registration. An admin can
 * always resend or regenerate a pass.
 */
import { BUCKETS } from '../db/supabase.js';
import * as participants from '../models/participant.model.js';
import * as eventModel from '../models/event.model.js';
import { generateParticipantId } from './participantId.service.js';
import { generateQrPng, buildVerificationUrl } from './qr.service.js';
import { generatePass, passFilename, qrFilename } from './pass.service.js';
import { sendRegistrationConfirmation } from './mailer.service.js';
import * as storage from './storage.service.js';
import AppError from '../utils/errors.js';
import logger from '../utils/logger.js';

const DEFAULT_EVENT_NAME = 'Mowe-Ibafo X Community Fitness Walk 2026';

/** Human readable date, e.g. "14 Feb 2026". */
export function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  });
}

/**
 * Run a full registration.
 *
 * @param {{ fullName: string, email: string, phone: string, photoBuffer: Buffer, photoMime: string, ipAddress?: string|null }} input
 * @returns {Promise<object>} the API response payload
 */
export async function register({ fullName, email, phone, photoBuffer, photoMime, ipAddress = null }) {
  // ── 2. duplicate check ────────────────────────────────────────────────
  const existing = await participants.findByEmail(email);
  if (existing) {
    throw AppError.conflict('This email address is already registered.');
  }

  // ── 3. reserve the id ─────────────────────────────────────────────────
  const { participantId, participantSeq } = await generateParticipantId();
  logger.info({ participantId, participantSeq }, 'participant id reserved');

  // ── 4. upload the photo ───────────────────────────────────────────────
  const photoPath = await storage.upload(BUCKETS.PARTICIPANT_PHOTOS, photoBuffer, {
    contentType: photoMime,
    prefix: participantId,
    filename: 'passport',
  });

  // ── 5. insert the row ─────────────────────────────────────────────────
  let participant;
  try {
    participant = await participants.create({
      participantId,
      participantSeq,
      fullName,
      email,
      phone,
      photoPath,
      ipAddress,
    });
  } catch (error) {
    // The row is the source of truth. If it cannot be written, do not leave
    // an orphaned photo behind.
    await storage.remove(BUCKETS.PARTICIPANT_PHOTOS, photoPath);
    if (error.code === '23505') {
      throw AppError.conflict('This email address is already registered.');
    }
    throw error;
  }

  // ── 6-8. QR + pass ────────────────────────────────────────────────────
  let passBuffer = null;
  let qrUrl = null;
  let passUrl = null;

  try {
    const event = await eventModel.getEvent();

    const qrBuffer = await generateQrPng(participantId);
    const qrPath = await storage.upload(BUCKETS.QR_CODES, qrBuffer, {
      contentType: 'image/png',
      prefix: participantId,
      filename: qrFilename(participantId),
    });

    passBuffer = await generatePass({
      participant: {
        ...participant,
        event_name: event?.event_name ?? DEFAULT_EVENT_NAME,
        registered_at: formatDate(participant.registered_at),
      },
      photoBuffer,
      qrBuffer,
    });

    const passPath = await storage.upload(BUCKETS.PASSES, passBuffer, {
      contentType: 'image/jpeg',
      prefix: participantId,
      filename: passFilename(participantId),
    });

    participant = await participants.update(participant.id, {
      qr_path: qrPath,
      flyer_path: passPath,
    });

    qrUrl = storage.publicUrl(BUCKETS.QR_CODES, qrPath);
    passUrl = storage.publicUrl(BUCKETS.PASSES, passPath);
  } catch (error) {
    // Registration stands even when the pass cannot be produced. An admin can
    // regenerate it with POST /api/admin/participants/:id/regenerate-pass.
    logger.error({ err: error, participantId }, 'pass/QR generation failed; registration kept');
  }

  // ── 9. build the response immediately — the user should not wait for email ─
  const verifyUrl = buildVerificationUrl(participantId);

  const result = {
    participant_id: participantId,
    full_name: participant.full_name,
    registered_at: participant.registered_at,
    pass_url: passUrl,
    qr_url: qrUrl,
    verify_url: verifyUrl,
    email_status: 'queued',
  };

  // ── 10. send the email in the background so the HTTP response is instant ──
  logger.info({ participantId }, 'starting background email send');
  setImmediate(async () => {
    logger.info({ participantId }, 'inside setImmediate callback');
    let emailStatus = 'failed';
    try {
      const event = await eventModel.getEvent();
      logger.info({ participantId, event: event?.event_name }, 'got event for email');
      const sent = await sendRegistrationConfirmation({
        participant: { ...participant, registered_at: formatDate(participant.registered_at) },
        verifyUrl,
        passBuffer,
        passFilename: passFilename(participantId),
        eventName: event?.event_name ?? DEFAULT_EVENT_NAME,
      });
      emailStatus = sent.ok ? 'sent' : 'failed';
      if (!sent.ok) {
        logger.error({ participantId, error: sent.error }, 'registration email delivery failed');
      } else {
        logger.info({ participantId, messageId: sent.messageId }, 'registration email sent');
      }
    } catch (error) {
      logger.error({ err: error, participantId }, 'registration email threw');
    }

    await eventModel
      .logEmail({ recipient: email, subject: 'Registration Confirmed', status: emailStatus })
      .catch((error) => logger.error({ err: error }, 'could not write email_log'));

    logger.info({ participantId, emailStatus }, 'registration complete');
  });

  return result;
}

/**
 * Rebuild and re-upload the QR code and pass for an existing participant.
 * @param {object} participant
 * @returns {Promise<{ pass_url: string|null, qr_url: string|null, verify_url: string }>}
 */
export async function regeneratePass(participant) {
  const event = await eventModel.getEvent();

  const qrBuffer = await generateQrPng(participant.participant_id);
  const qrPath = await storage.upload(BUCKETS.QR_CODES, qrBuffer, {
    contentType: 'image/png',
    prefix: participant.participant_id,
    filename: qrFilename(participant.participant_id),
  });

  // The photo bucket is private; fetch it back to embed it in the pass.
  let photoBuffer = null;
  if (participant.photo_path) {
    try {
      photoBuffer = await storage.download(BUCKETS.PARTICIPANT_PHOTOS, participant.photo_path);
    } catch (error) {
      logger.warn({ err: error, id: participant.id }, 'photo unavailable for pass regeneration');
    }
  }

  const passBuffer = await generatePass({
    participant: {
      ...participant,
      event_name: event?.event_name ?? DEFAULT_EVENT_NAME,
      registered_at: formatDate(participant.registered_at),
    },
    photoBuffer,
    qrBuffer,
  });

  const passPath = await storage.upload(BUCKETS.PASSES, passBuffer, {
    contentType: 'image/jpeg',
    prefix: participant.participant_id,
    filename: passFilename(participant.participant_id),
  });

  await participants.update(participant.id, { qr_path: qrPath, flyer_path: passPath });

  return {
    pass_url: storage.publicUrl(BUCKETS.PASSES, passPath),
    qr_url: storage.publicUrl(BUCKETS.QR_CODES, qrPath),
    verify_url: buildVerificationUrl(participant.participant_id),
  };
}

export default { register, regeneratePass, formatDate };
