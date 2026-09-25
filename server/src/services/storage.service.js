/**
 * Supabase Storage access.
 *
 * Nothing is ever written to the local filesystem: Render's disk is
 * ephemeral, so every permanent artefact lives in Supabase Storage.
 *
 * participant-photos is a private bucket and is only ever exposed through a
 * short-lived signed URL.
 */
import crypto from 'node:crypto';
import config from '../config/env.js';
import { getSupabaseAdmin, BUCKETS, PUBLIC_BUCKETS } from '../db/supabase.js';
import AppError from '../utils/errors.js';
import logger from '../utils/logger.js';

/** Build a collision-resistant, non-guessable object key. */
function buildKey(prefix, filenameHint = '') {
  const random = crypto.randomBytes(16).toString('hex');
  const safeName = String(filenameHint)
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-40);
  return `${prefix}/${Date.now()}-${random}${safeName ? `-${safeName}` : ''}`;
}

async function unwrap(result, context) {
  if (result.error) {
    logger.error({ err: result.error, context }, 'storage operation failed');
    throw AppError.internal('Storage operation failed.');
  }
  return result.data;
}

/**
 * Upload a buffer.
 * @param {'participant-photos'|'passes'|'qr-codes'|'sponsor-logos'|'event-images'} bucket
 * @param {Buffer} buffer
 * @param {{ contentType: string, prefix?: string, filename?: string }} options
 * @returns {Promise<string>} the storage object key
 */
export async function upload(bucket, buffer, { contentType, prefix = '', filename = '' }) {
  if (!buffer?.length) {
    throw AppError.unprocessable('Nothing to upload.');
  }

  const key = buildKey(prefix || bucket, filename);
  const data = await unwrap(
    getSupabaseAdmin().storage.from(bucket).upload(key, buffer, {
      contentType,
      upsert: false,
      cacheControl: bucket === BUCKETS.PASSES ? '3600' : '31536000',
    }),
    { bucket, key }
  );

  logger.info({ bucket, key, bytes: buffer.length }, 'uploaded object');
  return data?.path ?? key;
}

/** Remove an object. Missing objects are not an error. */
export async function remove(bucket, key) {
  if (!bucket || !key) return;
  try {
    await getSupabaseAdmin().storage.from(bucket).remove([key]);
    logger.info({ bucket, key }, 'removed object');
  } catch (error) {
    // Storage cleanup must never break a successful database operation.
    logger.warn({ err: error, bucket, key }, 'failed to remove object');
  }
}

/**
 * Public URL for an object in a public bucket. Returns null for private
 * buckets so callers are forced to think.
 */
export function publicUrl(bucket, key) {
  if (!key || !PUBLIC_BUCKETS.includes(bucket)) return null;
  return getSupabaseAdmin().storage.from(bucket).getPublicUrl(key).data.publicUrl ?? null;
}

/**
 * Short-lived signed URL. Required for the private participant-photos
 * bucket and also used for passes/QR when a private URL is preferable.
 */
export async function signedUrl(bucket, key, ttlSeconds = config.SIGNED_URL_TTL_SECONDS) {
  if (!key) return null;
  const data = await unwrap(
    getSupabaseAdmin().storage.from(bucket).createSignedUrl(key, ttlSeconds),
    { bucket, key, ttlSeconds }
  );
  return data?.signedUrl ?? null;
}

/** Download an object as a Buffer. */
export async function download(bucket, key) {
  const data = await unwrap(
    getSupabaseAdmin().storage.from(bucket).download(key),
    { bucket, key }
  );
  if (!data) throw AppError.notFound('File not found.');
  return Buffer.from(await data.arrayBuffer());
}

/**
 * List object keys in a bucket. Used by the legacy pass download route to
 * resolve a bare filename to its prefixed storage key.
 * @param {string} bucket
 * @param {number} [limit]
 * @returns {Promise<string[]>}
 */
export async function listBucket(bucket, limit = 1000) {
  const data = await unwrap(getSupabaseAdmin().storage.from(bucket).list('', { limit }), {
    bucket,
  });
  // list('') returns top-level "folders" when keys contain a slash, so walk
  // one level down to reach the actual objects.
  const folders = Array.isArray(data) ? data : [];
  const keys = [];

  for (const entry of folders) {
    if (entry.id) {
      keys.push(entry.name);
      continue;
    }
    const children = await unwrap(
      getSupabaseAdmin().storage.from(bucket).list(entry.name, { limit }),
      { bucket, prefix: entry.name }
    );
    for (const child of children ?? []) {
      if (child.id) keys.push(`${entry.name}/${child.name}`);
    }
  }

  return keys;
}

/**
 * Resolve a stored path into something a browser can fetch.
 * Public buckets get a permanent URL; private buckets get a signed URL.
 *
 * @param {{ photo_path?: string|null, flyer_path?: string|null, qr_path?: string|null, logo_path?: string|null, image_path?: string|null, banner_path?: string|null }} record
 * @param {Record<string,string>} fieldToBucket
 */
export async function resolveUrls(record, fieldToBucket) {
  const result = {};

  for (const [field, bucket] of Object.entries(fieldToBucket)) {
    const key = record?.[field];
    if (!key) {
      result[`${field.replace(/_path$/, '')}_url`] = null;
      continue;
    }
    if (PUBLIC_BUCKETS.includes(bucket)) {
      result[`${field.replace(/_path$/, '')}_url`] = publicUrl(bucket, key);
    } else {
      result[`${field.replace(/_path$/, '')}_url`] = await signedUrl(bucket, key);
    }
  }

  return result;
}

export { BUCKETS, PUBLIC_BUCKETS };

export default {
  upload,
  remove,
  publicUrl,
  signedUrl,
  download,
  listBucket,
  resolveUrls,
  BUCKETS,
};
