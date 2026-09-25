/** Gallery data access. */
import { one, rows, query } from '../db/pool.js';

const COLUMNS = 'id, image_path, caption, category, sort_order, status, uploaded_at';

export const all = (activeOnly = false) =>
  activeOnly
    ? rows(`select ${COLUMNS} from public.gallery where status = 'active' order by sort_order asc, id asc`)
    : rows(`select ${COLUMNS} from public.gallery order by sort_order asc, id asc`);

export const findById = (id) => one(`select ${COLUMNS} from public.gallery where id = $1`, [id]);

export async function create({
  imagePath,
  caption = null,
  category = 'general',
  sortOrder = 0,
  status = 'active',
}) {
  const result = await query(
    `insert into public.gallery (image_path, caption, category, sort_order, status)
     values ($1, $2, $3, $4, $5) returning ${COLUMNS}`,
    [imagePath, caption, category, sortOrder, status]
  );
  return result.rows[0];
}

const UPDATABLE = new Set(['image_path', 'caption', 'category', 'sort_order', 'status']);

export async function update(id, data) {
  const entries = Object.entries(data).filter(([key]) => UPDATABLE.has(key));
  if (entries.length === 0) return null;

  const setClause = entries.map(([key], index) => `${key} = $${index + 1}`).join(', ');
  const values = entries.map(([, value]) => value);

  const result = await query(
    `update public.gallery set ${setClause} where id = $${values.length + 1} returning ${COLUMNS}`,
    [...values, id]
  );
  return result.rows[0] ?? null;
}

export const remove = (id) => query('delete from public.gallery where id = $1', [id]);

export default { all, findById, create, update, remove };
