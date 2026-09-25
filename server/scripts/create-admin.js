/**
 * Create an administrator.
 *
 * The password is NEVER stored in this repository and NEVER has a default.
 * Supply it through the environment so it does not end up in shell history:
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<strong-password>' \
 *   ADMIN_NAME='Your Name' ADMIN_ROLE=super npm run create-admin
 *
 * This creates the Supabase Auth user with the service role key and then
 * links it to public.admins using the same UUID.
 */
import { getSupabaseAdmin } from '../src/db/supabase.js';
import { one, closePool } from '../src/db/pool.js';
import logger from '../src/utils/logger.js';

const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? '';
const name = (process.env.ADMIN_NAME ?? '').trim();
const role = process.env.ADMIN_ROLE ?? 'admin';

function fail(message) {
  console.error(`\n[create-admin] ${message}\n`);
  process.exit(1);
}

if (!email) fail('ADMIN_EMAIL is required.');
if (!password) fail('ADMIN_PASSWORD is required. It is never stored in this repo.');
if (password.length < 12) fail('ADMIN_PASSWORD must be at least 12 characters.');
if (!name) fail('ADMIN_NAME is required.');
if (!['super', 'admin'].includes(role)) fail("ADMIN_ROLE must be 'super' or 'admin'.");

const supabase = getSupabaseAdmin();

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { name, role },
});

if (error) {
  // An existing account is not fatal: link the admin row and stop there.
  if (!/already been registered|already exists/i.test(error.message ?? '')) {
    fail(`Could not create the Auth user: ${error.message}`);
  }

  console.log('\n[create-admin] An Auth user with that email already exists. Linking it instead.');

  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) fail(`Could not list Auth users: ${listError.message}`);

  const existing = list?.users?.find((user) => user.email?.toLowerCase() === email);
  if (!existing) fail('The existing Auth user could not be located.');

  const linked = await one(
    `insert into public.admins (id, name, email, role)
     values ($1, $2, $3, $4)
     on conflict (id) do update set name = excluded.name, email = excluded.email, role = excluded.role
     returning id, email, name, role`,
    [existing.id, name, email, role]
  );

  console.log(`[create-admin] Linked administrator: ${linked.email} (${linked.role})\n`);
  await closePool();
  process.exit(0);
}

const admin = await one(
  `insert into public.admins (id, name, email, role)
   values ($1, $2, $3, $4)
   returning id, email, name, role`,
  [data.user.id, name, email, role]
);

logger.info({ adminId: admin.id, email: admin.email, role: admin.role }, 'administrator created');
console.log(`\n[create-admin] Created administrator: ${admin.email} (${admin.role})\n`);

await closePool();
process.exit(0);
