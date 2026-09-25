/**
 * Admin sponsor, gallery, contact and event management.
 */
import { BUCKETS } from '../db/supabase.js';
import * as sponsors from '../models/sponsor.model.js';
import * as gallery from '../models/gallery.model.js';
import * as contacts from '../models/contact.model.js';
import * as eventModel from '../models/event.model.js';
import {
  sponsorSchema,
  sponsorUpdateSchema,
  gallerySchema,
  galleryUpdateSchema,
  contactUpdateSchema,
  eventUpdateSchema,
  bodyToStrings,
} from '../validators/schemas.js';
import { validateOptionalImage } from '../middleware/upload.js';
import * as storage from '../services/storage.service.js';
import AppError from '../utils/errors.js';
import logger from '../utils/logger.js';
import { sendSuccess } from '../utils/response.js';

const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

const toId = (value) => {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id)) throw AppError.badRequest('Invalid id.');
  return id;
};

const nullify = (value) => (value === '' ? null : value);

// ── Sponsors ────────────────────────────────────────────────────────────

/** GET /api/admin/sponsors */
export async function listSponsors(req, res) {
  const list = await sponsors.all(false);

  const data = list.map((sponsor) => ({
    ...sponsor,
    logo_url: storage.publicUrl(BUCKETS.SPONSOR_LOGOS, sponsor.logo_path),
  }));

  return sendSuccess(res, data);
}

/** POST /api/admin/sponsors */
export async function createSponsor(req, res) {
  const input = sponsorSchema.parse(bodyToStrings(req.body));

  const logo = await validateOptionalImage(req.file, {
    field: 'logo',
    required: false,
    allowedTypes: LOGO_TYPES,
  });

  const logoPath = logo
    ? await storage.upload(BUCKETS.SPONSOR_LOGOS, logo.buffer, {
        contentType: logo.detectedMime,
        prefix: 'sponsors',
        filename: 'logo',
      })
    : null;

  const sponsor = await sponsors.create({
    businessName: input.business_name,
    logoPath,
    websiteUrl: nullify(input.website_url),
    whatsapp: nullify(input.whatsapp),
    description: nullify(input.description),
    priority: input.priority,
    status: input.status,
  });

  return sendSuccess(res, sponsor, 'Sponsor created.', 201);
}

/** PUT /api/admin/sponsors/:id */
export async function updateSponsor(req, res) {
  const id = toId(req.params.id);
  const existing = await sponsors.findById(id);
  if (!existing) throw AppError.notFound('Sponsor not found.');

  const input = sponsorUpdateSchema.parse(bodyToStrings(req.body));
  const data = {};

  if (input.business_name !== undefined) data.business_name = input.business_name;
  if (input.website_url !== undefined) data.website_url = nullify(input.website_url);
  if (input.whatsapp !== undefined) data.whatsapp = nullify(input.whatsapp);
  if (input.description !== undefined) data.description = nullify(input.description);
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.status !== undefined) data.status = input.status;

  const logo = await validateOptionalImage(req.file, {
    field: 'logo',
    required: false,
    allowedTypes: LOGO_TYPES,
  });

  if (logo) {
    const logoPath = await storage.upload(BUCKETS.SPONSOR_LOGOS, logo.buffer, {
      contentType: logo.detectedMime,
      prefix: 'sponsors',
      filename: 'logo',
    });
    if (existing.logo_path) await storage.remove(BUCKETS.SPONSOR_LOGOS, existing.logo_path);
    data.logo_path = logoPath;
  }

  const sponsor = await sponsors.update(id, data);
  return sendSuccess(res, sponsor, 'Sponsor updated.');
}

/** DELETE /api/admin/sponsors/:id */
export async function deleteSponsor(req, res) {
  const id = toId(req.params.id);
  const existing = await sponsors.findById(id);
  if (!existing) throw AppError.notFound('Sponsor not found.');

  if (existing.logo_path) await storage.remove(BUCKETS.SPONSOR_LOGOS, existing.logo_path);
  await sponsors.remove(id);

  return sendSuccess(res, null, 'Sponsor deleted.');
}


// ── Gallery ─────────────────────────────────────────────────────────────

/** GET /api/admin/gallery */
export async function listGallery(req, res) {
  const items = await gallery.all(false);

  const data = items.map((item) => ({
    ...item,
    image_url: storage.publicUrl(BUCKETS.EVENT_IMAGES, item.image_path),
  }));

  return sendSuccess(res, data);
}

/** POST /api/admin/gallery */
export async function createGalleryItem(req, res) {
  const input = gallerySchema.parse(bodyToStrings(req.body));

  const image = await validateOptionalImage(req.file, {
    field: 'image',
    required: true,
    allowedTypes: LOGO_TYPES,
  });

  const imagePath = await storage.upload(BUCKETS.EVENT_IMAGES, image.buffer, {
    contentType: image.detectedMime,
    prefix: 'gallery',
    filename: 'image',
  });

  const item = await gallery.create({
    imagePath,
    caption: nullify(input.caption),
    category: input.category,
    sortOrder: input.sort_order,
    status: input.status,
  });

  return sendSuccess(
    res,
    { ...item, image_url: storage.publicUrl(BUCKETS.EVENT_IMAGES, imagePath) },
    'Image uploaded.',
    201
  );
}

/** PUT /api/admin/gallery/:id */
export async function updateGalleryItem(req, res) {
  const id = toId(req.params.id);
  const existing = await gallery.findById(id);
  if (!existing) throw AppError.notFound('Gallery item not found.');

  const input = galleryUpdateSchema.parse(req.body ?? {});
  const data = {};

  if (input.caption !== undefined) data.caption = nullify(input.caption);
  if (input.category !== undefined) data.category = input.category;
  if (input.sort_order !== undefined) data.sort_order = input.sort_order;
  if (input.status !== undefined) data.status = input.status;

  const image = await validateOptionalImage(req.file, {
    field: 'image',
    required: false,
    allowedTypes: LOGO_TYPES,
  });

  if (image) {
    const imagePath = await storage.upload(BUCKETS.EVENT_IMAGES, image.buffer, {
      contentType: image.detectedMime,
      prefix: 'gallery',
      filename: 'image',
    });
    if (existing.image_path) await storage.remove(BUCKETS.EVENT_IMAGES, existing.image_path);
    data.image_path = imagePath;
  }

  return sendSuccess(res, await gallery.update(id, data), 'Gallery item updated.');
}

/** DELETE /api/admin/gallery/:id */
export async function deleteGalleryItem(req, res) {
  const id = toId(req.params.id);
  const existing = await gallery.findById(id);
  if (!existing) throw AppError.notFound('Gallery item not found.');

  if (existing.image_path) await storage.remove(BUCKETS.EVENT_IMAGES, existing.image_path);
  await gallery.remove(id);

  return sendSuccess(res, null, 'Gallery item deleted.');
}

// ── Contacts ────────────────────────────────────────────────────────────

/** GET /api/admin/contacts */
export async function listContacts(req, res) {
  const status = String(req.query?.status ?? '');
  const valid = ['new', 'read', 'replied', 'resolved'];

  return sendSuccess(res, await contacts.all(valid.includes(status) ? status : ''));
}

/** PUT /api/admin/contacts/:id */
export async function updateContact(req, res) {
  const id = toId(req.params.id);
  const existing = await contacts.findById(id);
  if (!existing) throw AppError.notFound('Message not found.');

  const input = contactUpdateSchema.parse(req.body ?? {});
  const data = {};

  if (input.reply !== undefined) data.reply = nullify(input.reply);
  if (input.status !== undefined) data.status = input.status;

  return sendSuccess(res, await contacts.update(id, data), 'Updated.');
}

/** DELETE /api/admin/contacts/:id */
export async function deleteContact(req, res) {
  const id = toId(req.params.id);
  const existing = await contacts.findById(id);
  if (!existing) throw AppError.notFound('Message not found.');

  await contacts.remove(id);
  return sendSuccess(res, null, 'Deleted.');
}

// ── Event settings ──────────────────────────────────────────────────────

/** GET /api/admin/event */
export async function getEvent(req, res) {
  const event = await eventModel.getEvent();
  if (!event) throw AppError.notFound('Event settings not configured.');

  return sendSuccess(res, {
    ...event,
    banner_url: storage.publicUrl(BUCKETS.EVENT_IMAGES, event.banner_path),
  });
}

/** PUT /api/admin/event */
export async function updateEvent(req, res) {
  // Accepts JSON, or multipart when a banner image is replaced.
  const input = eventUpdateSchema.parse(bodyToStrings(req.body));
  const data = {};

  for (const [key, value] of Object.entries(input)) {
    data[key] = value === '' ? null : value;
  }

  const banner = await validateOptionalImage(req.file, {
    field: 'banner',
    required: false,
    allowedTypes: LOGO_TYPES,
  });

  if (banner) {
    const existing = await eventModel.getEvent();
    const bannerPath = await storage.upload(BUCKETS.EVENT_IMAGES, banner.buffer, {
      contentType: banner.detectedMime,
      prefix: 'event',
      filename: 'banner',
    });
    if (existing?.banner_path) await storage.remove(BUCKETS.EVENT_IMAGES, existing.banner_path);
    data.banner_path = bannerPath;
  }

  if (Object.keys(data).length === 0) {
    throw AppError.badRequest('No valid fields provided.');
  }

  await eventModel.updateEvent(data);
  logger.info({ fields: Object.keys(data) }, 'event settings updated');

  return sendSuccess(res, null, 'Event settings updated.');
}

export default {
  listSponsors,
  createSponsor,
  updateSponsor,
  deleteSponsor,
  listGallery,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  listContacts,
  updateContact,
  deleteContact,
  getEvent,
  updateEvent,
};
