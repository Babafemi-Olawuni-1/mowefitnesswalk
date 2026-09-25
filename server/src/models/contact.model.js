/** Contact message data access. */
import { one, rows, query } from '../db/pool.js';

const COLUMNS =
  'id, name, email, phone, subject, message, reply, status, ip_address, created_at, updated_at';

export const all = (status = '') =>
  status
    ? rows(`select ${COLUMNS} from public.contacts where status = $1 order by created_at desc, id desc`, [status])
    : rows(`select ${COLUMNS} from public.contacts order by created_at desc, id desc`);

export const findById = (id) => one(`select ${COLUMNS} from public.contacts where id = $1`, [id]);

export const countUnread = async () => {
  const row = await one(`select count(*)::int as total from public.contacts where status = 'new'`);
  return row?.total ?? 0;
};

export async function create({ name, email, phone = null, subject, message, ipAddress = null }) {
  const result = await query(
    `insert into public.contacts (name, email, phone, subject, message, ip_address)
     values ($1, $2, $3, $4, $5, $6) returning ${COLUMNS}`,
    [name, email, phone, subject, message, ipAddress]
  );
  return result.rows[0];
}

const UPDATABLE = new Set(['reply', 'status']);

export async function update(id, data) {
  const entries = Object.entries(data).filter(([key]) => UPDATABLE.has(key));
  if (entries.length === 0) return null;

  const setClause = entries.map(([key], index) => `${key} = $${index + 1}`).join(', ');
  const values = entries.map(([, value]) => value);

  const result = await query(
    `update public.contacts set ${setClause} where id = $${values.length + 1} returning ${COLUMNS}`,
    [...values, id]
  );
  return result.rows[0] ?? null;
}

export const remove = (id) => query('delete from public.contacts where id = $1', [id]);

export default { all, findById, countUnread, create, update, remove };
