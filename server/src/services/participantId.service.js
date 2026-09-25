/**
 * Participant id generation.
 *
 * Ids come from a PostgreSQL sequence (public.participant_seq), never from
 * MAX(id) + 1. A sequence is safe under concurrency: each caller receives a
 * distinct value even when two registrations arrive in the same
 * millisecond.
 *
 * Format: MIWC2026-000001
 */
import config from '../config/env.js';
import { query } from '../db/pool.js';
import logger from '../utils/logger.js';

const SEQUENCE_NAME = 'public.participant_seq';

/**
 * Reserve the next sequence value and format it as a participant id.
 * @returns {Promise<{ participantId: string, participantSeq: number }>}
 */
export async function generateParticipantId() {
  // nextval() is atomic and non-blocking; two concurrent callers can never
  // receive the same value.
  const result = await query(`select nextval($1) as seq`, [SEQUENCE_NAME]);
  const participantSeq = Number(result.rows[0].seq);

  if (!Number.isFinite(participantSeq) || participantSeq < 1) {
    // Fail loudly rather than issue a malformed id.
    throw new Error(`Sequence ${SEQUENCE_NAME} returned an unexpected value`);
  }

  return {
    participantId: formatParticipantId(participantSeq),
    participantSeq,
  };
}

/**
 * @param {number|string} seq
 * @param {string} [prefix]
 * @returns {string} e.g. MIWC2026-000001
 */
export function formatParticipantId(seq, prefix = config.PARTICIPANT_PREFIX) {
  const numeric = Number(seq);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error('Participant sequence must be a non-negative integer');
  }
  return `${prefix}-${String(numeric).padStart(6, '0')}`;
}

/**
 * Peek at the next id without consuming it. Useful for diagnostics only.
 */
export async function peekNextParticipantId() {
  const result = await query(`select last_value from ${SEQUENCE_NAME}`);
  const last = Number(result.rows[0].last_value);
  logger.debug({ last }, 'peeked participant sequence');
  return formatParticipantId(last + 1);
}

export default { generateParticipantId, formatParticipantId, peekNextParticipantId };
