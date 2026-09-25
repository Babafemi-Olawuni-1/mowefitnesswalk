<?php
/**
 * MASTER CONFIGURATION — Mowe-Ibafo X Community Fitness Walk 2026
 * All application settings live here. Never hardcode these values elsewhere.
 */

// ── Database ──────────────────────────────────────────────────────────────────
define('DB_HOST',     'localhost');
define('DB_NAME',     'whitehal_mixc');
define('DB_USER',     'whitehal_user');
define('DB_PASS',     '@Whitehall12345');
define('DB_CHARSET',  'utf8mb4');

// ── Application ───────────────────────────────────────────────────────────────
define('APP_NAME',    'Mowe Fitness Walk 2026');
define('SITE_NAME',   'Mowe Fitness Walk');
define('APP_URL',     'https://api.whitehallpavilionmotel.com');  // Backend base URL (no trailing slash)
// Frontend URL (for CORS). Set to your frontend domain.
define('FRONTEND_URL','https://mowefitnesswalk.netlify.app');

// ── Community & Event ─────────────────────────────────────────────────────────
define('COMMUNITY_NAME', 'Mowe-Ibafo X Community');
define('EVENT_NAME',     'Fitness Walk 2026');
define('EVENT_YEAR',     '2026');
define('PARTICIPANT_PREFIX', 'MIWC2026');

// ── JWT ───────────────────────────────────────────────────────────────────────
define('JWT_SECRET',  'MX-Community-Fitness-Walk-2026-SuperSecretKey!@#');
define('JWT_EXPIRY',  86400); // 24 hours in seconds

// ── Upload Paths ──────────────────────────────────────────────────────────────
define('UPLOAD_BASE',     __DIR__ . '/uploads');
define('UPLOAD_PHOTOS',   __DIR__ . '/uploads/photos');
define('UPLOAD_FLYERS',   __DIR__ . '/uploads/flyers');
define('UPLOAD_SPONSORS', __DIR__ . '/uploads/sponsors');
define('UPLOAD_GALLERY',  __DIR__ . '/uploads/gallery');

define('UPLOAD_URL',      APP_URL . '/uploads');

// ── Upload Limits ─────────────────────────────────────────────────────────────
define('MAX_UPLOAD_SIZE',     5 * 1024 * 1024); // 5MB in bytes
define('ALLOWED_IMAGE_TYPES', ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
define('ALLOWED_IMAGE_EXT',   ['jpg', 'jpeg', 'png', 'webp']);

// ── QR Code ───────────────────────────────────────────────────────────────────
define('QR_SIZE',      300);  // pixels
define('QR_BASE_URL',  APP_URL . '/verify.php?id=');

// ── Attendee Pass / Flyer ─────────────────────────────────────────────────────
define('PASS_WIDTH',   900);
define('PASS_HEIGHT',  500);
define('PASS_BG_COLOR','#0B0B0B');
define('PASS_ACCENT',  '#22C55E');
define('COMMUNITY_LOGO', __DIR__ . '/assets/logo.png');

// ── SMTP / Email ──────────────────────────────────────────────────────────────
define('SMTP_HOST',     'mail.whitehallpavilionmotel.com');
define('SMTP_PORT',     587);
define('SMTP_SECURE',   'tls');
define('SMTP_USER',     'noreply@whitehallpavilionmotel.com');
define('SMTP_PASS',     'EmailPassword123!');  // Update this
define('SMTP_FROM',     'noreply@whitehallpavilionmotel.com');
define('SMTP_FROM_NAME', COMMUNITY_NAME);

// ── WhatsApp ──────────────────────────────────────────────────────────────────
define('WHATSAPP_NUMBER', '2347061038567');
define('SPONSOR_WHATSAPP_MSG', 'Hello%20I%20would%20like%20to%20become%20a%20sponsor%20for%20the%20Mowe-Ibafo%20X%20Community%20Fitness%20Walk%202026.');

// ── Pagination ────────────────────────────────────────────────────────────────
define('PAGE_SIZE', 20);

// ── CSV Export ────────────────────────────────────────────────────────────────
define('CSV_DELIMITER', ',');
define('CSV_ENCLOSURE', '"');

// ── Duplicate Registration ────────────────────────────────────────────────────
define('PREVENT_DUPLICATE_EMAIL', true);
define('PREVENT_DUPLICATE_PHONE', false);

// ── Timezone ──────────────────────────────────────────────────────────────────
define('APP_TIMEZONE', 'Africa/Lagos');
date_default_timezone_set(APP_TIMEZONE);

// ── Logs ──────────────────────────────────────────────────────────────────────
define('LOG_DIR', __DIR__ . '/logs');
define('LOG_ERRORS', true);

// ── Environment ───────────────────────────────────────────────────────────────
define('APP_ENV', 'production'); // 'development' | 'production'
define('DEBUG',   false);
