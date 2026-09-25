/**
 * Apply the Supabase migrations in supabase/migrations to DATABASE_URL.
 *
 * Usage:
 *   npm run migrate              # apply everything that has not run yet
 *   npm run migrate -- --status  # list applied / pending files
 *
 * The migration history is tracked in a schema_migrations table so that
 * re-running is safe.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getPool, closePool, query, rows } from '../src/db/pool.js';
import logger from '../src/utils/logger.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, '../supabase/migrations');

async function ensureHistoryTable() {
  await query(`
    create table if not exists public.schema_migrations (
      filename   text primary key,
      checksum   text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

async function readMigrationFiles() {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  const files = entries.filter((name) => name.endsWith('.sql')).sort();

  return Promise.all(
    files.map(async (filename) => {
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
      return {
        filename,
        sql,
        checksum: crypto.createHash('sha256').update(sql).digest('hex').slice(0, 16),
      };
    })
  );
}

async function main() {
  const statusOnly = process.argv.includes('--status');

  const pool = getPool();
  const client = await pool.connect();

  try {
    await ensureHistoryTable();

    const files = await readMigrationFiles();
    const applied = await rows('select filename, checksum, applied_at from public.schema_migrations');
    const appliedMap = new Map(applied.map((row) => [row.filename, row]));

    const pending = files.filter((file) => !appliedMap.has(file.filename));

    if (statusOnly) {
      console.log('\nMigration status\n');
      for (const file of files) {
        const record = appliedMap.get(file.filename);
        console.log(
          `  ${record ? '[applied]' : '[pending]'}  ${file.filename}` +
            (record ? `  (${new Date(record.applied_at).toISOString()})` : '')
        );
      }
      console.log('');
      return;
    }

    if (pending.length === 0) {
      console.log('\nNothing to do: all migrations are already applied.\n');
      return;
    }

    for (const file of pending) {
      // Each migration runs in its own transaction: either it fully applies
      // or it fully rolls back.
      await client.query('BEGIN');
      try {
        await client.query(file.sql);
        await client.query(
          'insert into public.schema_migrations (filename, checksum) values ($1, $2)',
          [file.filename, file.checksum]
        );
        await client.query('COMMIT');
        console.log(`  applied  ${file.filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error({ err: error, file: file.filename }, 'migration failed');
        throw error;
      }
    }

    console.log(`\nApplied ${pending.length} migration(s).\n`);
  } finally {
    client.release();
    await closePool();
  }
}

main().catch((error) => {
  console.error('\nMigration failed:', error.message);
  process.exit(1);
});
