/**
 * Public endpoints: verification, sponsors, gallery, event, contact, pass
 * download.
 */
import { BUCKETS } from '../db/supabase.js';
import * as participants from '../models/participant.model.js';
import * as sponsors from '../models/sponsor.model.js';
import * as gallery from '../models/gallery.model.js';
import * as contacts from '../models/contact.model.js';
import * as eventModel from '../models/event.model.js';
import { contactSchema } from '../validators/schemas.js';
import { parseParticipantId } from '../utils/qrPayload.js';
import { formatDate } from '../services/registration.service.js';
import * as storage from '../services/storage.service.js';
import { buildVerificationUrl } from '../services/qr.service.js';
import AppError from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

/**
 * GET /api/verify/:id
 *
 * :id may be a bare id, a full verification URL, or the legacy verify.php
 * URL. A scanner hands us whatever the QR contained, so all three resolve.
 */
export async function verify(req, res) {
  const participantId = parseParticipantId(req.params.id);

  if (!participantId) {
    throw AppError.unprocessable('A valid participant ID is required.');
  }

  const participant = await participants.findByParticipantId(participantId);

  if (!participant) {
    throw AppError.notFound('Participant not found.');
  }

  // Only the fields a gate needs. No photo URL, no IP address, no internals.
  return sendSuccess(
    res,
    {
      participant_id: participant.participant_id,
      full_name: participant.full_name,
      email: participant.email,
      phone: participant.phone,
      status: participant.status,
      registered_at: participant.registered_at,
      registered_on: formatDate(participant.registered_at),
      // false for cancelled, true otherwise.
      valid: participant.status !== 'cancelled',
    },
    'Participant verified.',
    200
  );
}

/** GET /api/sponsors — public list, active only. */
export async function listSponsors(req, res) {
  const list = await sponsors.all(true);

  const data = await Promise.all(
    list.map(async (sponsor) => ({
      ...sponsor,
      logo_url: storage.publicUrl(BUCKETS.SPONSOR_LOGOS, sponsor.logo_path),
      logo_path: undefined,
    }))
  );

  return sendSuccess(res, data);
}

/** GET /api/gallery — public list, active only. */
export async function listGallery(req, res) {
  const items = await gallery.all(true);

  const data = items.map((item) => ({
    ...item,
    image_url: storage.publicUrl(BUCKETS.EVENT_IMAGES, item.image_path),
    image_path: undefined,
  }));

  return sendSuccess(res, data);
}

/** GET /api/event */
export async function getEvent(req, res) {
  const event = await eventModel.getEvent();

  if (!event) {
    throw AppError.notFound('Event settings not configured.');
  }

  return sendSuccess(res, {
    ...event,
    banner_url: storage.publicUrl(BUCKETS.EVENT_IMAGES, event.banner_path),
    banner_path: undefined,
  });
}

/** POST /api/contact */
export async function submitContact(req, res) {
  const { name, email, phone, subject, message } = contactSchema.parse(req.body ?? {});

  await contacts.create({
    name,
    email,
    phone: phone || null,
    subject,
    message,
    ipAddress: req.ip ?? null,
  });

  return sendSuccess(
    res,
    null,
    'Your message has been received. We will get back to you shortly.',
    201
  );
}

/**
 * GET /api/download-pass/:filename
 *
 * Kept so the old pass_url shape keeps working. The canonical URL is the
 * public Storage URL; this streams the object back through the API when a
 * filename is supplied instead.
 */
export async function downloadPass(req, res) {
  const filename = String(req.params.filename ?? '').replace(/[^A-Za-z0-9._-]/g, '');

  if (!filename.toLowerCase().endsWith('.jpg')) {
    throw AppError.notFound('Pass not found.');
  }

  // The stored key is prefixed, so locate the object by its filename suffix.
  const list = await storage.listBucket(BUCKETS.PASSES, 1000);
  const match = list.find((key) => key.endsWith(`/${filename}`) || key === filename);

  if (!match) {
    throw AppError.notFound('Pass not found.');
  }

  const buffer = await storage.download(BUCKETS.PASSES, match);

  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', String(buffer.length));
  return res.status(200).end(buffer);
}

export { buildVerificationUrl };

export default {
  verify,
  listSponsors,
  listGallery,
  getEvent,
  submitContact,
  downloadPass,
};
