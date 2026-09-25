/**
 * Process entry point.
 *
 * Binds to process.env.PORT so Render can inject its own, and shuts down
 * gracefully on SIGTERM so in-flight requests are not dropped during a
 * deploy or a scale-down.
 */
import { createApp } from './app.js';
import config from './config/env.js';
import logger from './utils/logger.js';
import { closePool, checkConnection } from './db/pool.js';

const app = createApp();

// Render sets PORT. Locally it defaults to 3000.
const port = config.PORT;

// Fail fast if the database is unreachable at boot, so a misconfigured
// DATABASE_URL surfaces immediately instead of on the first request.
const database = await checkConnection();
if (!database.ok) {
  logger.error({ database }, 'database is not reachable at startup');
}

const server = app.listen(port, '0.0.0.0', () => {
  logger.info({ port, env: config.NODE_ENV }, 'Mowe-Ibafo X Community Fitness Walk API listening');
});

server.on('error', (error) => {
  logger.error({ err: error }, 'server error');
  process.exit(1);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'shutting down');

  // Stop accepting new connections, then release the database pool.
  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, 10_000);

  forceExit.unref();

  server.close(async (error) => {
    if (error) logger.error({ err: error }, 'error closing server');

    try {
      await closePool();
      logger.info('database pool closed');
    } catch (poolError) {
      logger.error({ err: poolError }, 'error closing database pool');
    }

    clearTimeout(forceExit);
    process.exit(error ? 1 : 0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception; exiting');
  process.exit(1);
});

export default server;
