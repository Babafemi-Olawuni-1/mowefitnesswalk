/** Sponsor data access. */
import { one, rows, query } from '../db/pool.js';

const COLUMNS = `
  id, business_name, logo_path, website_url, whatsapp,
  description, priority, status, created_at, updated_at
`;

export const all = (activeOnly = false) =>
  activeOnly
    ? rows(
        `select ${COLUMNS} from public.sponsors where status = 'active' order by priority desc, id asc`
      )
    : rows(`select ${COLUMNS} from public.sponsors order by priority desc, id asc`);

export const findById = (id) => one(`select ${COLUMNS} from public.sponsors where id = $1`, [id]);

export const countActive = async () => {
  const row = await one(`select count(*)::int as total from public.sponsors where status = 'active'`);
  return row?.total ?? 0;
};

export async function create({
  businessName,
  logoPath = null,
  websiteUrl = null,
  whatsapp = null,
  description = null,
  priority = 0,
  status = 'active',
}) {
  const result = await query(
    `insert into public.sponsors
       (business_name, logo_path, website_url, whatsapp, description, priority, status)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning ${COLUMNS}`,
    [businessName, logoPath, websiteUrl, whatsapp, description, priority, status]
  );
  return result.rows[0];
}

const UPDATABLE = new Set([
  'business_name',
  'logo_path',
  'website_url',
  'whatsapp',
  'description',
  'priority',
  'status',
]);

export async function update(id, data) {
  const entries = Object.entries(data).filter(([key]) => UPDATABLE.has(key));
  if (entries.length === 0) return null;

  const setClause = entries.map(([key], index) => `${key} = $${index + 1}`).join(', ');
  const values = entries.map(([, value]) => value);

  const result = await query(
    `update public.sponsors set ${setClause} where id = $${values.length + 1} returning ${COLUMNS}`,
    [...values, id]
  );
  return result.rows[0] ?? null;
}

export const remove = (id) => query('delete from public.sponsors where id = $1', [id]);

export default { all, findById, countActive, create, update, remove };
