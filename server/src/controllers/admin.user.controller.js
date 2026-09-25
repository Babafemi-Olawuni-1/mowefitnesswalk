/**
 * Admin user management (super admin only).
 */
import { getSupabaseAdmin } from '../db/supabase.js';
import { one, rows, closePool } from '../db/pool.js';
import { adminCreateSchema, adminUpdateSchema } from '../validators/schemas.js';
import { requireRole } from '../middleware/auth.js';
import AppError from '../utils/errors.js';
import logger from '../utils/logger.js';
import { sendSuccess } from '../utils/response.js';

/** GET /api/admin/admins */
export async function listAdmins(req, res) {
  const admins = await rows('select id, email, name, role, last_login, created_at from public.admins order by created_at desc');
  return sendSuccess(res, admins);
}

/** POST /api/admin/admins (super only) */
export async function createAdmin(req, res) {
  const { email, password, name, role } = adminCreateSchema.parse(req.body ?? {});

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });

  if (error) {
    if (!/already been registered|already exists/i.test(error.message ?? '')) {
      throw AppError.badRequest(`Could not create the Auth user: ${error.message}`);
    }

    const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw AppError.internal('Could not list Auth users.');

    const existing = list?.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (!existing) throw AppError.notFound('The existing Auth user could not be located.');

    const linked = await one(
      `insert into public.admins (id, name, email, role)
       values ($1, $2, $3, $4)
       on conflict (id) do update set name = excluded.name, email = excluded.email, role = excluded.role
       returning id, email, name, role`,
      [existing.id, name, email, role]
    );

    return sendSuccess(res, linked, 'Administrator linked.', 201);
  }

  const admin = await one(
    `insert into public.admins (id, name, email, role)
     values ($1, $2, $3, $4)
     returning id, email, name, role`,
    [data.user.id, name, email, role]
  );

  logger.info({ adminId: admin.id, email: admin.email, role: admin.role }, 'administrator created via API');
  return sendSuccess(res, admin, 'Administrator created.', 201);
}

/** PUT /api/admin/admins/:id (super only) */
export async function updateAdmin(req, res) {
  const id = req.params.id;
  const input = adminUpdateSchema.parse(req.body ?? {});

  const data = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.role !== undefined) data.role = input.role;

  if (Object.keys(data).length === 0) {
    throw AppError.badRequest('No valid fields provided.');
  }

  const admin = await one(
    `update public.admins set ${Object.keys(data).map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1 returning id, email, name, role`,
    [id, ...Object.values(data)]
  );

  if (!admin) throw AppError.notFound('Administrator not found.');

  return sendSuccess(res, admin, 'Administrator updated.');
}

/** DELETE /api/admin/admins/:id (super only) */
export async function deleteAdmin(req, res) {
  const id = req.params.id;

  if (id === req.admin.id) {
    throw AppError.badRequest('You cannot delete your own account.');
  }

  const admin = await one('select id from public.admins where id = $1', [id]);
  if (!admin) throw AppError.notFound('Administrator not found.');

  const supabase = getSupabaseAdmin();
  await supabase.auth.admin.deleteUser(id);
  await one('delete from public.admins where id = $1', [id]);

  logger.info({ deletedId: id }, 'administrator deleted');
  return sendSuccess(res, null, 'Administrator deleted.');
}

export default { listAdmins, createAdmin, updateAdmin, deleteAdmin };