/**
 * Admin authentication.
 *
 * POST /api/admin/login is the only public admin route. It delegates to
 * Supabase Auth and then confirms the user has a row in public.admins, so
 * an ordinary Supabase user with no admin record is rejected with 403
 * rather than being let in.
 */
import { getSupabaseAdmin } from '../db/supabase.js';
import { one } from '../db/pool.js';
import { loginSchema } from '../validators/schemas.js';
import { touchLastLogin } from '../middleware/auth.js';
import config from '../config/env.js';
import AppError from '../utils/errors.js';
import logger from '../utils/logger.js';
import { sendSuccess } from '../utils/response.js';

export async function login(req, res) {
  const { email, password } = loginSchema.parse(req.body ?? {});

  // Optional allowlist, checked before we even talk to Supabase.
  if (config.ADMIN_EMAILS.length > 0) {
    const allowed = config.ADMIN_EMAILS.map((value) => value.toLowerCase());
    if (!allowed.includes(email.toLowerCase())) {
      logger.warn({ email }, 'login attempt from a non-allowlisted address');
      throw AppError.forbidden('This account is not allowed to sign in.');
    }
  }

  const { data, error } = await getSupabaseAdmin().auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data?.user || !data.session) {
    // Supabase deliberately does not say which of the two was wrong.
    logger.info({ email, reason: error?.message }, 'failed admin login');
    throw AppError.unauthorized('Invalid email or password.');
  }

  const admin = await one(
    'select id, email, name, role from public.admins where id = $1',
    [data.user.id]
  );

  if (!admin) {
    logger.warn({ userId: data.user.id, email }, 'authenticated user has no admin record');
    throw AppError.forbidden('This account is not an administrator.');
  }

  await touchLastLogin(admin.id);

  return sendSuccess(
    res,
    {
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type ?? 'bearer',
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    },
    'Signed in successfully.'
  );
}

export default { login };
