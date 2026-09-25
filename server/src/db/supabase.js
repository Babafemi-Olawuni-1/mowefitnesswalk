/**
 * Supabase clients.
 *
 * `admin` uses the service role key and is server-side only. It is used
 * for Supabase Auth verification and Storage. It is never returned by any
 * endpoint and never sent to the browser.
 */
import { createClient } from '@supabase/supabase-js';
import config from '../config/env.js';

let adminClient = null;

export function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  adminClient = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return adminClient;
}

export const BUCKETS = Object.freeze({
  PARTICIPANT_PHOTOS: 'participant-photos',
  PASSES: 'passes',
  QR_CODES: 'qr-codes',
  SPONSOR_LOGOS: 'sponsor-logos',
  EVENT_IMAGES: 'event-images',
});

/** Buckets whose objects are readable without a signed URL. */
export const PUBLIC_BUCKETS = Object.freeze([
  BUCKETS.PASSES,
  BUCKETS.QR_CODES,
  BUCKETS.SPONSOR_LOGOS,
  BUCKETS.EVENT_IMAGES,
]);

export default getSupabaseAdmin;

/**
 * Replace the service-role client. Tests only. Never call this from
 * application code.
 * @param {ReturnType<import('@supabase/supabase-js').createClient>} replacement
 */
export function __setAdminForTests(replacement) {
  adminClient = replacement;
}
