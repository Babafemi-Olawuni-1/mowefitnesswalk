/**
 * CSV export.
 *
 * Column ordering is preserved exactly as the old PHP ExportController
 * produced it. Every file starts with a UTF-8 BOM so that Excel on
 * Windows opens it with the correct encoding instead of mojibake.
 */
import config from '../config/env.js';

const BOM = '\uFEFF';

/** RFC 4180 quoting. Quote everything, which is always safe. */
const escapeCell = (value) => {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
};

/**
 * Build a CSV string (including the BOM) from headers and rows.
 * @param {string[]} headers
 * @param {Array<Array<any>>} rows
 * @returns {string}
 */
export function buildCsv(headers, rows) {
  const lines = [headers.map(escapeCell).join(',')];

  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }

  return BOM + lines.join('\r\n') + '\r\n';
}

const stamp = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
};

/** participants_YYYYMMDD_HHMMSS.csv */
export const participantsFilename = () => `participants_${stamp()}.csv`;
/** sponsors_YYYYMMDD_HHMMSS.csv */
export const sponsorsFilename = () => `sponsors_${stamp()}.csv`;
/** contacts_YYYYMMDD_HHMMSS.csv */
export const contactsFilename = () => `contacts_${stamp()}.csv`;

export const PARTICIPANT_HEADERS = [
  'ID',
  'Participant ID',
  'Full Name',
  'Email',
  'Phone',
  'Status',
  'Registered At',
];

export const SPONSOR_HEADERS = [
  'ID',
  'Business Name',
  'Website',
  'WhatsApp',
  'Priority',
  'Status',
];

export const CONTACT_HEADERS = ['ID', 'Name', 'Email', 'Phone', 'Subject', 'Status', 'Date'];

/**
 * Stream a CSV to the client as a download.
 * @param {import('express').Response} res
 * @param {string} filename
 * @param {string} csv
 */
export function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.status(200).send(Buffer.from(csv, 'utf8'));
}

export { BOM, config };

export default {
  buildCsv,
  sendCsv,
  participantsFilename,
  sponsorsFilename,
  contactsFilename,
  PARTICIPANT_HEADERS,
  SPONSOR_HEADERS,
  CONTACT_HEADERS,
  BOM,
};
