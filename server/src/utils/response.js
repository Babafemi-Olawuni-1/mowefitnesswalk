/**
 * Response envelope helpers.
 *
 * The contract is fixed and matches what the React app already expects:
 *   success -> { success: true,  message: string, data?: any }
 *   failure -> { success: false, message: string, errors?: object }
 */

/** @param {import('express').Response} res */
export function sendSuccess(res, data, message = 'Success', status = 200) {
  const payload = { success: true, message };
  if (data !== undefined && data !== null) payload.data = data;
  return res.status(status).json(payload);
}

/** @param {import('express').Response} res */
export function sendError(res, message = 'An error occurred', status = 400, errors) {
  const payload = { success: false, message };
  if (errors && Object.keys(errors).length > 0) payload.errors = errors;
  return res.status(status).json(payload);
}

/** @param {import('express').Response} res */
export const sendUnauthorized = (res, message = 'Unauthorized.') =>
  sendError(res, message, 401);

/** @param {import('express').Response} res */
export const sendForbidden = (res, message = 'Forbidden.') => sendError(res, message, 403);

/** @param {import('express').Response} res */
export const sendNotFound = (res, message = 'Not found.') => sendError(res, message, 404);

export default { sendSuccess, sendError, sendUnauthorized, sendForbidden, sendNotFound };
