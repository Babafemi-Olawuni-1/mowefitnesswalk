/**
 * Application-level HTTP error.
 *
 * Thrown anywhere in a controller and translated into the standard error
 * envelope by the global error handler.
 */
export class AppError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} message client-safe message
   * @param {object} [options]
   * @param {object} [options.errors] per-field validation errors
   * @param {string} [options.code] machine readable code
   * @param {Error}  [options.cause]
   */
  constructor(status, message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.expose = true;
    if (options.errors) this.errors = options.errors;
    if (options.code) this.code = options.code;
    if (options.cause) this.cause = options.cause;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message = 'Bad request.', options) {
    return new AppError(400, message, options);
  }

  static unauthorized(message = 'Unauthorized.', options) {
    return new AppError(401, message, options);
  }

  static forbidden(message = 'Forbidden.', options) {
    return new AppError(403, message, options);
  }

  static notFound(message = 'Not found.', options) {
    return new AppError(404, message, options);
  }

  static conflict(message = 'Conflict.', options) {
    return new AppError(409, message, options);
  }

  static unprocessable(message = 'Validation failed.', options) {
    return new AppError(422, message, options);
  }

  static tooManyRequests(message = 'Too many requests.', options) {
    return new AppError(429, message, options);
  }

  static internal(message = 'Internal server error.', options) {
    const error = new AppError(500, message, options);
    error.expose = false;
    return error;
  }
}

export default AppError;
