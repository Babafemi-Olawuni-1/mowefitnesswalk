/**
 * Attendee pass generation (900 x 500 JPEG).
 *
 * Replaces the PHP GD PassGenerator. The layout is a direct reproduction of
 * the original design:
 *   - #0B0B0B background, 8px green left accent bar
 *   - #141414 card inset by 20px
 *   - green header strip, event name + "MOWE FITNESS WALK"
 *   - "OFFICIAL PARTICIPANT" badge, top right
 *   - 160x180 passport photo with a green frame
 *   - name / participant id / email / phone / registered date
 *   - 160x160 QR code on a white backing with "SCAN TO VERIFY"
 *   - footer strip with the event name and site
 *   - community logo in the header
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = path.resolve(HERE, '../../assets');
const LOGO_PATH = path.join(ASSET_DIR, 'logo.png');

export const PASS_WIDTH = 900;
export const PASS_HEIGHT = 500;

const COLORS = {
  bg: '#0B0B0B',
  card: '#141414',
  footer: '#0F0F0F',
  accent: '#22C55E',
  accentDark: '#16A34A',
  white: '#FFFFFF',
  grey: '#969696',
};

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** SVG text baseline, matching the y offsets used by the old GD code. */
const text = (x, y, content, { size, fill, weight = 400, anchor = 'start', spacing }) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}"` +
  ` text-anchor="${anchor}"${spacing ? ` letter-spacing="${spacing}"` : ''}` +
  `>${esc(content)}</text>`;

/** Truncate a long value so it never overflows its column. */
function clamp(value, max) {
  const str = String(value ?? '');
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function readLogoDataUri() {
  try {
    if (!fs.existsSync(LOGO_PATH)) return null;
    const buffer = fs.readFileSync(LOGO_PATH);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (error) {
    logger.warn({ err: error }, 'community logo could not be read');
    return null;
  }
}

const PHOTO = { x: 40, y: 80, w: 160, h: 180 };
const QR = { x: PASS_WIDTH - 160 - 35, y: 75, size: 160 };

/**
 * Build the pass SVG.
 * @param {{ participant: object, photoBase64?: string|null, qrBase64?: string|null }} input
 * @returns {string}
 */
function buildSvg({ participant, photoBase64, qrBase64 }) {
  const eventName = String(
    participant.event_name ?? 'Mowe-Ibafo X Community Fitness Walk 2026'
  ).toUpperCase();

  const photoMarkup = photoBase64
    ? `<image href="${photoBase64}" x="${PHOTO.x}" y="${PHOTO.y}" width="${PHOTO.w}" height="${PHOTO.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>`
    : text(PHOTO.x + PHOTO.w / 2, PHOTO.y + PHOTO.h / 2 + 6, 'PHOTO', {
        size: 16,
        fill: COLORS.grey,
        anchor: 'middle',
      });

  const qrMarkup = qrBase64
    ? `<image href="${qrBase64}" x="${QR.x}" y="${QR.y}" width="${QR.size}" height="${QR.size}" preserveAspectRatio="xMidYMid meet"/>`
    : '';

  const logo = readLogoDataUri();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PASS_WIDTH}" height="${PASS_HEIGHT}" viewBox="0 0 ${PASS_WIDTH} ${PASS_HEIGHT}">
  <defs>
    <clipPath id="photoClip"><rect x="${PHOTO.x}" y="${PHOTO.y}" width="${PHOTO.w}" height="${PHOTO.h}"/></clipPath>
  </defs>

  <rect x="0" y="0" width="${PASS_WIDTH}" height="${PASS_HEIGHT}" fill="${COLORS.bg}"/>
  <rect x="0" y="0" width="8" height="${PASS_HEIGHT}" fill="${COLORS.accent}"/>
  <rect x="20" y="20" width="${PASS_WIDTH - 40}" height="${PASS_HEIGHT - 40}" fill="${COLORS.card}"/>
  <rect x="20" y="20" width="${PASS_WIDTH - 40}" height="35" fill="${COLORS.accent}"/>

  ${text(36, 45, eventName, { size: 18, fill: COLORS.white, weight: 700, spacing: 1 })}
  ${text(36, 70, 'MOWE FITNESS WALK', { size: 9, fill: COLORS.grey, spacing: 3 })}
  ${
    logo
      ? `<image href="${logo}" x="${PASS_WIDTH - 90}" y="23" width="30" height="30" preserveAspectRatio="xMidYMid meet"/>`
      : ''
  }

  <rect x="${PASS_WIDTH - 200}" y="70" width="170" height="25" fill="${COLORS.accentDark}" rx="2"/>
  ${text(PASS_WIDTH - 115, 87, 'OFFICIAL PARTICIPANT', {
    size: 10,
    fill: COLORS.white,
    weight: 700,
    anchor: 'middle',
    spacing: 1,
  })}

  <rect x="${PHOTO.x - 3}" y="${PHOTO.y - 3}" width="${PHOTO.w + 6}" height="${PHOTO.h + 6}" fill="${COLORS.accent}"/>
  ${photoMarkup}

  ${text(225, 105, clamp(participant.full_name, 34), { size: 22, fill: COLORS.white, weight: 700 })}
  ${text(225, 135, 'PARTICIPANT ID', { size: 9, fill: COLORS.grey, spacing: 2 })}
  ${text(225, 158, participant.participant_id, { size: 18, fill: COLORS.accent, weight: 700, spacing: 1 })}
  ${text(225, 185, 'EMAIL', { size: 9, fill: COLORS.grey, spacing: 2 })}
  ${text(225, 202, clamp(participant.email, 34), { size: 13, fill: COLORS.white })}
  ${text(225, 227, 'PHONE', { size: 9, fill: COLORS.grey, spacing: 2 })}
  ${text(225, 244, clamp(participant.phone, 24), { size: 13, fill: COLORS.white })}
  ${text(225, 269, 'REGISTERED', { size: 9, fill: COLORS.grey, spacing: 2 })}
  ${text(225, 286, participant.registered_at, { size: 12, fill: COLORS.white })}

  <rect x="${QR.x - 5}" y="${QR.y - 5}" width="${QR.size + 10}" height="${QR.size + 10}" fill="${COLORS.white}"/>
  ${qrMarkup}
  ${text(QR.x + QR.size / 2, QR.y + QR.size + 22, 'SCAN TO VERIFY', {
    size: 9,
    fill: COLORS.grey,
    anchor: 'middle',
    spacing: 2,
  })}

  <rect x="20" y="${PASS_HEIGHT - 55}" width="${PASS_WIDTH - 40}" height="35" fill="${COLORS.footer}"/>
  ${text(40, PASS_HEIGHT - 32, `${eventName} · ${config.APP_URL}`, {
    size: 10,
    fill: COLORS.accent,
    weight: 500,
  })}
</svg>`;
}



/** Normalise any image to a PNG data URI for embedding in the SVG. */
async function toPngDataUri(buffer) {
  if (!buffer?.length) return null;
  try {
    const png = await sharp(buffer).png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch (error) {
    logger.warn({ err: error }, 'could not normalise image for the pass');
    return null;
  }
}

/**
 * Render the attendee pass.
 *
 * @param {{ participant: object, photoBuffer?: Buffer|null, qrBuffer?: Buffer|null }} input
 * @returns {Promise<Buffer>} JPEG buffer (900x500)
 */
export async function generatePass({ participant, photoBuffer = null, qrBuffer = null }) {
  const [photoBase64, qrBase64] = await Promise.all([
    toPngDataUri(photoBuffer),
    toPngDataUri(qrBuffer),
  ]);

  const svg = buildSvg({ participant, photoBase64, qrBase64 });

  const jpeg = await sharp(Buffer.from(svg), { density: 96 })
    .resize(PASS_WIDTH, PASS_HEIGHT, { fit: 'fill' })
    .flatten({ background: COLORS.bg })
    .jpeg({ quality: 92 })
    .toBuffer();

  logger.debug(
    { participantId: participant.participant_id, bytes: jpeg.length },
    'generated pass'
  );
  return jpeg;
}

/** Deterministic, safe object name for the pass. */
export const passFilename = (participantId) =>
  `pass_${String(participantId).replace(/[^A-Za-z0-9_-]/g, '')}.jpg`;

/** Deterministic, safe object name for the QR code. */
export const qrFilename = (participantId) =>
  `qr_${String(participantId).replace(/[^A-Za-z0-9_-]/g, '')}.png`;

export default { generatePass, passFilename, qrFilename, PASS_WIDTH, PASS_HEIGHT };
