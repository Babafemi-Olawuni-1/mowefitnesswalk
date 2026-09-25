/**
 * Participant data access.
 *
 * Every statement is parameterised. Dynamic fragments are only ever built
 * from a fixed whitelist of clauses, never from request input.
 */
import { one, rows, query } from '../db/pool.js';

const BASE_COLUMNS = `
  id, participant_id, participant_seq, full_name, email, phone,
  photo_path, flyer_path, qr_path, status, ip_address,
  registered_at, updated_at
`;

/** Insert a participant using an already-reserved sequence value. */
export async function create({
  participantId,
  participantSeq,
  fullName,
  email,
  phone,
  photoPath = null,
  ipAddress = null,
}) {
  const result = await query(
    `insert into public.participants
       (participant_id, participant_seq, full_name, email, phone, photo_path, ip_address)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning ${BASE_COLUMNS}`,
    [participantId, participantSeq, fullName, email, phone, photoPath, ipAddress]
  );

  return result.rows[0];
}

export const findById = (id) => one(`select ${BASE_COLUMNS} from public.participants where id = $1`, [id]);

export const findByParticipantId = (participantId) =>
  one(`select ${BASE_COLUMNS} from public.participants where participant_id = $1`, [
    participantId,
  ]);

/** Case-insensitive duplicate email check. */
export const findByEmail = (email) =>
  one('select id, participant_id from public.participants where lower(email) = lower($1)', [email]);

/** Keyset pagination with optional search and status filter. */
export async function paginate({ page = 1, perPage = 20, search = '', status = '' }) {
  const conditions = [];
  const values = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(
      `(full_name ilike $${values.length} or email ilike $${values.length} or participant_id ilike $${values.length} or phone ilike $${values.length})`
    );
  }

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';

  const countRow = await one(
    `select count(*)::int as total from public.participants ${where}`,
    values
  );

  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;

  const data = await rows(
    `select ${BASE_COLUMNS} from public.participants ${where}
     order by registered_at desc, id desc
     limit $${limitIndex} offset $${offsetIndex}`,
    [...values, perPage, (page - 1) * perPage]
  );

  const total = countRow?.total ?? 0;

  return {
    data,
    total,
    page,
    per_page: perPage,
    last_page: Math.max(1, Math.ceil(total / perPage)),
  };
}

export const all = (status = '') =>
  status
    ? rows(`select ${BASE_COLUMNS} from public.participants where status = $1 order by registered_at desc, id desc`, [status])
    : rows(`select ${BASE_COLUMNS} from public.participants order by registered_at desc, id desc`);

export const byIds = (ids) =>
  rows(`select ${BASE_COLUMNS} from public.participants where id = any($1::bigint[]) order by id`, [
    ids,
  ]);

/** Whitelisted, so the SET clause is never built from request input. */
const UPDATABLE = new Set(['full_name', 'email', 'phone', 'status', 'photo_path', 'flyer_path', 'qr_path']);

export async function update(id, data) {
  const entries = Object.entries(data).filter(([key]) => UPDATABLE.has(key));
  if (entries.length === 0) return null;

  const setClause = entries.map(([key], index) => `${key} = $${index + 1}`).join(', ');
  const values = entries.map(([, value]) => value);

  const result = await query(
    `update public.participants set ${setClause} where id = $${values.length + 1} returning ${BASE_COLUMNS}`,
    [...values, id]
  );

  return result.rows[0] ?? null;
}

export const remove = (id) =>
  query('delete from public.participants where id = $1', [id]);

export const removeMany = async (ids) => {
  const result = await query('delete from public.participants where id = any($1::bigint[]) returning id', [ids]);
  return result.rows;
};

export const stats = async () => {
  const totals = await one(`
    select
      count(*)::int                                       as total,
      count(*) filter (where status = 'verified')::int    as verified,
      count(*) filter (where status = 'cancelled')::int   as cancelled,
      count(*) filter (where registered_at >= date_trunc('day', now()))::int as today
    from public.participants
  `);

  const week = await rows(`
    select to_char(d.day, 'YYYY-MM-DD') as d, coalesce(count(p.id), 0)::int as cnt
    from generate_series(date_trunc('day', now()) - interval '6 days', date_trunc('day', now()), interval '1 day') as d(day)
    left join public.participants p
      on date_trunc('day', p.registered_at) = d.day
    group by d.day
    order by d.day asc
  `);

  return {
    total: totals?.total ?? 0,
    today: totals?.today ?? 0,
    verified: totals?.verified ?? 0,
    cancelled: totals?.cancelled ?? 0,
    week_chart: week,
  };
};

export default {
  create,
  findById,
  findByParticipantId,
  findByEmail,
  paginate,
  all,
  byIds,
  update,
  remove,
  removeMany,
  stats,
};
