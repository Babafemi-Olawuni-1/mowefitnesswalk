/**
 * QR payload parsing.
 *
 * A scanner returns whatever is encoded in the QR image, which may be:
 *   1. a bare participant id              MIWC2026-000001
 *   2. the current verification URL       https://<front>/verify?id=MIWC2026-000001
 *   3. the legacy PHP verification URL   https://<host>/verify.php?id=MIWC2026-000001
 *   4. a URL fragment form               .../verify#MIWC2026-000001
 *
 * This normalises all four down to the bare participant id so that
 * GET /api/verify/:id always receives something it can look up.
 */

const PARTICIPANT_ID_PATTERN = /^[A-Za-z0-9]+-\d{1,12}$/;

export const PARTICIPANT_ID_REGEX = PARTICIPANT_ID_PATTERN;

/** The urlencoded form also shows up in some scanners. */
function decodeOnce(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Extract a bare participant id from any supported QR payload.
 * @param {unknown} raw
 * @returns {string|null} the participant id, or null if none was found
 */
export function parseParticipantId(raw) {
  if (typeof raw !== 'string') return null;

  let value = raw.trim();
  if (!value) return null;

  value = decodeOnce(value).trim();
  // Strip surrounding quotes/whitespace a scanner may add.
  value = value.replace(/^["'<(\s]+|["'>)\s]+$/g, '');

  // 1. Already a bare id.
  if (PARTICIPANT_ID_PATTERN.test(value)) {
    return normaliseCase(value);
  }

  // 2-4. Anything URL-shaped: prefer the ?id= query parameter.
  if (/^https?:\/\//i.test(value) || value.includes('?') || value.includes('=')) {
    const fromQuery = readQueryParam(value, 'id');
    if (fromQuery && PARTICIPANT_ID_PATTERN.test(fromQuery)) {
      return normaliseCase(fromQuery);
    }

    const fromFragment = value.split('#')[1];
    if (fromFragment) {
      const candidate = decodeOnce(fromFragment).trim();
      if (PARTICIPANT_ID_PATTERN.test(candidate)) return normaliseCase(candidate);
    }

    // Last resort: the last path segment.
    const segments = value.split('?')[0].split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && PARTICIPANT_ID_PATTERN.test(last)) return normaliseCase(last);

    return null;
  }

  return null;
}

function readQueryParam(value, key) {
  const queryIndex = value.indexOf('?');
  if (queryIndex === -1) return null;
  const query = value.slice(queryIndex + 1).split('#')[0];
  for (const pair of query.split('&')) {
    const [rawKey, ...rest] = pair.split('=');
    if (decodeOnce(rawKey ?? '').toLowerCase() === key) {
      return decodeOnce(rest.join('=')).trim();
    }
  }
  return null;
}

function normaliseCase(value) {
  // Participant ids are always uppercase, e.g. MIWC2026-000001.
  return value.toUpperCase();
}

/** Convenience predicate used by controllers and tests. */
export const isParticipantId = (value) => parseParticipantId(value) !== null;

export default { parseParticipantId, isParticipantId, PARTICIPANT_ID_REGEX };
