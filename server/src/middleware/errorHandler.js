/**
 * Global error handling and 404 handling.
 *
 * Every failure leaves the server in the same envelope the React client
 * already parses:
 *   { success: false, message: string, errors?: object }
 */
import { ZodError } from 'zod';
import multer from 'multer';
import AppError from '../utils/errors.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import { sendError, sendNotFound } from '../utils/response.js';

/** Unmatched route. */
export function notFoundHandler(req, res) {
  return sendNotFound(res, `Route not found: ${req.method} ${req.originalUrl}`);
}

/** Flatten a ZodError into { field: message }. */
export function zodFieldErrors(error) {
  const fieldErrors = {};

  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }

  return fieldErrors;
}

/**
 * Express error handler. Must keep all four parameters.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  // Multer: file too large.
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      const limitMb = Math.round(config.MAX_UPLOAD_SIZE / (1024 * 1024));
      return sendError(res, `File size exceeds the ${limitMb}MB limit.`, 422, {
        photo: `File size exceeds the ${limitMb}MB limit.`,
      });
    }
    return sendError(res, 'File upload failed.', 422, { photo: 'File upload failed.' });
  }

  // Zod validation.
  if (error instanceof ZodError) {
    const errors = zodFieldErrors(error);
    logger.info({ path: req.originalUrl, errors }, 'validation failed');
    return sendError(res, 'Validation failed.', 422, errors);
  }

  // Deliberate, client-safe errors.
  if (error instanceof AppError) {
    if (error.status >= 500) {
      logger.error({ err: error, path: req.originalUrl }, 'request failed');
    } else {
      logger.info({ status: error.status, path: req.originalUrl, message: error.message }, 'request rejected');
    }
    return sendError(res, error.message, error.status, error.errors);
  }

  // Invalid JSON body from express.json()
  if (error instanceof SyntaxError && 'body' in error) {
    return sendError(res, 'Malformed JSON body.', 400);
  }

  // Anything else is a bug. Never leak internals in production.
  logger.error({ err: error, path: req.originalUrl }, 'unhandled error');
  return sendError(
    res,
    config.isProduction ? 'Internal server error.' : error.message || 'Internal server error.',
    500
  );
}

export default { notFoundHandler, errorHandler, zodFieldErrors };
