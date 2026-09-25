/**
 * GET /  and  GET /health
 *
 * Render uses the health endpoint for availability checks, so it must stay
 * cheap and must not throw.
 */
import { checkConnection } from '../db/pool.js';
import { getSupabaseAdmin } from '../db/supabase.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const startedAt = Date.now();

/** Liveness: the process is up. Always 200. */
export function root(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Success',
    data: {
      status: 'ok',
      api: 'Mowe-Ibafo X Community Fitness Walk 2026',
      environment: config.NODE_ENV,
      uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
    },
  });
}

/**
 * Readiness: the process is up and its dependencies answer.
 * Returns 503 when the database is unreachable so Render restarts it.
 */
export async function health(req, res) {
  const database = await checkConnection();
  const storage = { ok: true };

  try {
    const { error } = await getSupabaseAdmin().storage.listBuckets();
    if (error) storage.ok = false;
  } catch (error) {
    storage.ok = false;
  }

  const healthy = database.ok && storage.ok;

  if (!healthy) {
    logger.warn({ database, storage }, 'health check degraded');
  }

  return res.status(healthy ? 200 : 503).json({
    success: healthy,
    message: healthy ? 'Success' : 'Service degraded.',
    data: {
      status: healthy ? 'ok' : 'degraded',
      uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
      database,
      storage,
    },
  });
}

export default { root, health };
