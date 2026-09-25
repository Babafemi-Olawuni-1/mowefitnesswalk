/** Event settings (singleton) and email log data access. */
import { one, rows, query } from '../db/pool.js';

const EVENT_COLUMNS = `
  id, event_name, description, event_date, event_time, venue,
  registration_open, banner_path, contact_email, contact_phone,
  whatsapp, twitter_url, instagram_url, facebook_url, updated_at
`;

/** Always the single row with id = 1. */
export const getEvent = () => one(`select ${EVENT_COLUMNS} from public.event_settings where id = 1`);

const UPDATABLE = new Set([
  'event_name',
  'description',
  'event_date',
  'event_time',
  'venue',
  'registration_open',
  'banner_path',
  'contact_email',
  'contact_phone',
  'whatsapp',
  'twitter_url',
  'instagram_url',
  'facebook_url',
]);

export async function updateEvent(data) {
  const entries = Object.entries(data).filter(([key]) => UPDATABLE.has(key));
  if (entries.length === 0) return null;

  const setClause = entries.map(([key], index) => `${key} = $${index + 1}`).join(', ');
  const values = entries.map(([, value]) => (value === '' ? null : value));

  const result = await query(
    `update public.event_settings set ${setClause} where id = 1 returning ${EVENT_COLUMNS}`,
    values
  );
  return result.rows[0] ?? null;
}

/** Email delivery log. */
export const logEmail = ({ recipient, subject, status }) =>
  query(
    'insert into public.email_log (recipient, subject, status) values ($1, $2, $3)',
    [recipient, subject, status]
  );

export const emailLogRecent = (limit = 50) =>
  rows('select id, recipient, subject, status, sent_at from public.email_log order by sent_at desc, id desc limit $1', [
    limit,
  ]);

export default { getEvent, updateEvent, logEmail, emailLogRecent };
