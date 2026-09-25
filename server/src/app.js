/**
 * Express application.
 *
 * Exported without calling listen() so that tests can mount it with
 * supertest and so that server.js owns the process lifecycle.
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import config, { allowedOrigins } from './config/env.js';
import logger from './utils/logger.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

import healthRoutes from './routes/health.routes.js';
import publicRoutes from './routes/public.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { health } from './controllers/health.controller.js';

export function createApp() {
  const app = express();

  // Render terminates TLS at its edge and forwards over HTTP.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API only ever returns JSON and images; a restrictive CSP here
      // would be meaningless but harmless.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header: curl, health checks, server-to-server.
        if (!origin) return callback(null, true);
        if (allowedOrigins().includes(origin)) return callback(null, true);
        logger.warn({ origin }, 'CORS rejected');
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 86_400,
    })
  );

  // Request logging.
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      logger.info(
        {
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Date.now() - started,
        },
        'request'
      );
    });
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(generalLimiter);

  app.use('/', healthRoutes);
  app.use('/api', publicRoutes);
  app.use('/api/admin', adminRoutes);

  // Fallback mounts without /api prefix so /admin/* and /* requests work seamlessly
  app.use('/admin', adminRoutes);
  app.use('/', publicRoutes);

  // Convenience alias so /api/health works as well as /health.
  app.get('/api/health', health);

  app.use(notFoundHandler);
  app.use(errorHandler);

  logger.info(
    { env: config.NODE_ENV, frontend: config.FRONTEND_URL },
    'application configured'
  );

  return app;
}

export default createApp;
