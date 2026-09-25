/**
 * Multipart upload handling and image validation.
 *
 * Two independent checks, because either one alone is bypassable:
 *   1. the declared Content-Type must be on the allowlist
 *   2. the file's magic bytes must actually be a JPEG, PNG or WebP
 *
 * Check 2 is what rejects "fake image renamed .jpg": a text file called
 * photo.jpg passes the MIME check and fails the magic byte check.
 *
 * Files are held in memory only. Nothing is ever written to Render's disk.
 */
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import config from '../config/env.js';
import AppError from '../utils/errors.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.MAX_UPLOAD_SIZE,
    files: 1,
    fields: 20,
  },
});

/** Single optional image field. */
export const singleImage = (field) => upload.single(field);

/** Verify the real content type of an uploaded buffer. */
export async function assertRealImage(file, allowedTypes = config.ALLOWED_IMAGE_TYPES) {
  if (!file || !file.buffer?.length) {
    throw AppError.unprocessable('Please upload your passport photograph.', {
      errors: { photo: 'Please upload your passport photograph.' },
    });
  }

  // The browser-declared type is a hint only.
  if (file.mimetype && !allowedTypes.includes(file.mimetype)) {
    throw AppError.unprocessable('Invalid file type. Allowed: JPG, PNG, WebP.', {
      errors: { photo: 'Invalid file type. Allowed: JPG, PNG, WebP.' },
    });
  }

  // The authoritative check: what do the bytes actually say?
  const detected = await fileTypeFromBuffer(file.buffer);

  if (!detected || !allowedTypes.includes(detected.mime)) {
    throw AppError.unprocessable(
      'That file is not a valid image. Allowed: JPG, PNG, WebP.',
      { errors: { photo: 'That file is not a valid image. Allowed: JPG, PNG, WebP.' } }
    );
  }

  return { ...file, detectedMime: detected.mime, detectedExt: detected.ext };
}

/**
 * Validate an optional uploaded image. Returns null when absent.
 * @param {Express.Multer.File|undefined} file
 * @param {{ field?: string, required?: boolean, allowedTypes?: string[] }} options
 */
export async function validateOptionalImage(
  file,
  { field = 'photo', required = false, allowedTypes = config.ALLOWED_IMAGE_TYPES } = {}
) {
  if (!file) {
    if (required) {
      throw AppError.unprocessable('Please upload your passport photograph.', {
        errors: { [field]: 'Please upload your passport photograph.' },
      });
    }
    return null;
  }

  try {
    return await assertRealImage(file, allowedTypes);
  } catch (error) {
    // Re-key the error to the actual form field the client sent.
    if (error.errors) {
      throw AppError.unprocessable(error.message, {
        errors: { [field]: error.errors.photo ?? error.message },
      });
    }
    throw error;
  }
}

export default { singleImage, assertRealImage, validateOptionalImage };
