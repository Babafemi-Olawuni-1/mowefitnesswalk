/**
 * Admin participant management.
 *
 * The photo bucket is private, so a signed URL is generated on demand.
 * Signed URLs are only minted for the detail endpoint, never for a whole
 * list, to keep listing cheap.
 */
import { BUCKETS } from '../db/supabase.js';
import * as participants from '../models/participant.model.js';
import * as sponsors from '../models/sponsor.model.js';
import * as contacts from '../models/contact.model.js';
import config from '../config/env.js';
import {
  listQuerySchema,
  participantUpdateSchema,
  bulkDeleteSchema,
} from '../validators/schemas.js';
import { regeneratePass } from '../services/registration.service.js';
import * as storage from '../services/storage.service.js';
import AppError from '../utils/errors.js';
import logger from '../utils/logger.js';
import { sendSuccess } from '../utils/response.js';

/** GET /api/admin/dashboard */
export async function dashboard(req, res) {
  const [stats, sponsorCount, unreadMessages] = await Promise.all([
    participants.stats(),
    sponsors.countActive(),
    contacts.countUnread(),
  ]);

  return sendSuccess(res, { stats, sponsor_count: sponsorCount, unread_messages: unreadMessages });
}

/** GET /api/admin/stats */
export async function stats(req, res) {
  return sendSuccess(res, await participants.stats());
}

/** GET /api/admin/participants */
export async function index(req, res) {
  const query = listQuerySchema.parse(req.query ?? {});

  const result = await participants.paginate({
    page: query.page,
    perPage: config.PAGE_SIZE,
    search: query.search,
    status: query.status,
  });

  return sendSuccess(res, result);
}

/** GET /api/admin/participants/:id */
export async function show(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) throw AppError.badRequest('Invalid participant id.');

  const participant = await participants.findById(id);
  if (!participant) throw AppError.notFound('Participant not found.');

  return sendSuccess(res, {
    ...participant,
    photo_url: await storage.signedUrl(BUCKETS.PARTICIPANT_PHOTOS, participant.photo_path),
    pass_url: storage.publicUrl(BUCKETS.PASSES, participant.flyer_path),
    qr_url: storage.publicUrl(BUCKETS.QR_CODES, participant.qr_path),
  });
}

/** PUT /api/admin/participants/:id */
export async function update(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) throw AppError.badRequest('Invalid participant id.');

  const existing = await participants.findById(id);
  if (!existing) throw AppError.notFound('Participant not found.');

  const data = participantUpdateSchema.parse(req.body ?? {});

  // Changing the email must not collide with another participant.
  if (data.email && data.email.toLowerCase() !== existing.email.toLowerCase()) {
    const clash = await participants.findByEmail(data.email);
    if (clash && clash.id !== existing.id) {
      throw AppError.conflict('This email address is already registered.');
    }
  }

  const updated = await participants.update(id, data);

  return sendSuccess(res, updated, 'Participant updated.');
}

/** Delete one participant and their stored files. */
async function destroyOne(participant) {
  await Promise.all([
    storage.remove(BUCKETS.PARTICIPANT_PHOTOS, participant.photo_path),
    storage.remove(BUCKETS.PASSES, participant.flyer_path),
    storage.remove(BUCKETS.QR_CODES, participant.qr_path),
  ]);
  await participants.remove(participant.id);
}

/** DELETE /api/admin/participants/:id */
export async function destroy(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) throw AppError.badRequest('Invalid participant id.');

  const participant = await participants.findById(id);
  if (!participant) throw AppError.notFound('Participant not found.');

  await destroyOne(participant);
  logger.info({ id }, 'participant deleted by admin');

  return sendSuccess(res, null, 'Participant deleted.');
}

/** POST /api/admin/participants/bulk-delete */
export async function bulkDelete(req, res) {
  const { ids } = bulkDeleteSchema.parse(req.body ?? {});

  const found = await participants.byIds(ids);
  for (const participant of found) {
    await destroyOne(participant);
  }

  logger.info({ requested: ids.length, deleted: found.length }, 'bulk delete');

  return sendSuccess(
    res,
    { deleted: found.length },
    `${found.length} participant(s) deleted.`
  );
}

/** POST /api/admin/participants/:id/regenerate-pass */
export async function regenerate(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) throw AppError.badRequest('Invalid participant id.');

  const participant = await participants.findById(id);
  if (!participant) throw AppError.notFound('Participant not found.');

  const result = await regeneratePass(participant);

  return sendSuccess(res, result, 'Pass regenerated.');
}

export default {
  dashboard,
  stats,
  index,
  show,
  update,
  destroy,
  bulkDelete,
  regenerate,
};
