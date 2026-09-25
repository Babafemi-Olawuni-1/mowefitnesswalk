/**
 * PostgreSQL connection pool.
 *
 * All queries are parameterised. Nothing in this codebase ever builds SQL
 * by string interpolation of user input.
 */
import pg from 'pg';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const { Pool, types } = pg;

// bigint (OID 20) and numeric (OID 1700) arrive as strings so that ids
// beyond Number.MAX_SAFE_INTEGER survive the round trip intact.
types.setTypeParser(20, (value) => value);
types.setTypeParser(1700, (value) => value);

let pool = null;

export function getPool() {
  if (pool) return pool;

  pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: config.DATABASE_URL.includes('sslmode') || config.isProduction
      ? { rejectUnauthorized: false }
      : undefined,
  });

  pool.on('error', (error) => {
    logger.error({ err: error }, 'Idle database client error');
  });

  return pool;
}

/**
 * Run a parameterised query.
 * @param {string} text SQL with $1, $2, ... placeholders
 * @param {Array<any>} [values]
 */
export async function query(text, values = []) {
  const started = Date.now();
  const result = await getPool().query(text, values);
  logger.debug({ durationMs: Date.now() - started, rows: result.rowCount }, 'query');
  return result;
}

/** Convenience: return only the rows. */
export async function rows(text, values = []) {
  const result = await query(text, values);
  return result.rows;
}

/** Convenience: return the first row or null. */
export async function one(text, values = []) {
  const result = await rows(text, values);
  return result[0] ?? null;
}

/**
 * Run `fn` inside a transaction. Rolls back on any throw.
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Used by GET /health. Never throws. */
export async function checkConnection() {
  const started = Date.now();
  try {
    await getPool().query('select 1 as ok');
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    logger.error({ err: error }, 'Database health check failed');
    return { ok: false, latencyMs: Date.now() - started, error: error.message };
  }
}

export async function closePool() {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}

/**
 * Replace the pool. Tests only — this is how the suite points the app at an
 * in-process PGlite instance. Never call this from application code.
 * @param {import('pg').Pool} replacement
 */
export function __setPoolForTests(replacement) {
  pool = replacement;
}
