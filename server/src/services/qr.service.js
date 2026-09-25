/**
 * QR code generation.
 *
 * Generated locally with the `qrcode` package. The old PHP backend called
 * api.qrserver.com, which meant a registration could silently produce a
 * pass with no QR code whenever that third party was unreachable. There is
 * no external dependency here.
 */
import QRCode from 'qrcode';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const DEFAULT_SIZE = 300;

/** The stable public URL encoded into the QR image. */
export function buildVerificationUrl(participantId) {
  return config.QR_BASE_URL.replace('{id}', encodeURIComponent(participantId));
}

/**
 * Render a QR code PNG.
 * Colours match the old api.qrserver.com call: green on black.
 *
 * @param {string} participantId
 * @param {{ width?: number, margin?: number }} [options]
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function generateQrPng(participantId, options = {}) {
  const url = buildVerificationUrl(participantId);

  const buffer = await QRCode.toBuffer(url, {
    type: 'png',
    errorCorrectionLevel: 'M',
    width: options.width ?? DEFAULT_SIZE,
    margin: options.margin ?? 2,
    color: {
      dark: '#22C55E',
      light: '#0B0B0B',
    },
  });

  logger.debug({ participantId, bytes: buffer.length }, 'generated QR code');
  return buffer;
}

/**
 * The payload a scanner will read back. Exposed for tests and for the
 * admin screen so the expected value is never guessed.
 */
export const verificationPayloadFor = (participantId) => buildVerificationUrl(participantId);

export default { generateQrPng, buildVerificationUrl, verificationPayloadFor };
