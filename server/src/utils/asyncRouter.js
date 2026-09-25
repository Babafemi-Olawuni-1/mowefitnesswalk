/**
 * Async route wrapper.
 *
 * Express 4 does not catch rejected promises from route handlers. Without
 * this, any `throw` inside a controller becomes an unhandled rejection and
 * the HTTP request hangs until the client times out.
 *
 * `asyncRouter()` returns a router whose handler registration methods wrap
 * every handler, so route files stay free of boilerplate.
 */
import { Router as ExpressRouter } from 'express';

/**
 * Wrap a single handler so rejections reach the error middleware.
 * @param {Function} handler
 * @returns {import('express').RequestHandler}
 */
export const wrapAsync = (handler) => (req, res, next) => {
  try {
    const result = handler(req, res, next);
    if (result && typeof result.then === 'function') {
      result.catch(next);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * A Router that automatically wraps every handler in wrapAsync.
 * @returns {import('express').Router}
 */
export function asyncRouter() {
  const router = ExpressRouter();

  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'all']) {
    const original = router[method].bind(router);

    router[method] = (path, ...handlers) =>
      original(
        path,
        ...handlers.map((handler) =>
          typeof handler === 'function' && handler.length <= 3 ? wrapAsync(handler) : handler
        )
      );
  }

  return router;
}

export default asyncRouter;
