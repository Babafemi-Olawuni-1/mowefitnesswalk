-- =====================================================================
-- Mowe-Ibafo X Community Fitness Walk 2026
-- 0002 — Storage buckets
--
-- Apply with:  supabase db push
--          or: npm run migrate   (from server/)
--
-- Buckets are created through the Storage API (storage.buckets) so that
-- `public` and the file size / MIME limits are applied correctly.
-- =====================================================================

-- ── participant-photos : PRIVATE, 5 MB, JPEG/PNG/WEBP ───────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'participant-photos',
  'participant-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── passes : PUBLIC, 10 MB, JPEG ─────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('passes', 'passes', true, 10485760, array['image/jpeg'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── qr-codes : PUBLIC, 2 MB, PNG ─────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('qr-codes', 'qr-codes', true, 2097152, array['image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── sponsor-logos : PUBLIC, 5 MB, JPEG/PNG/WEBP/SVG ──────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sponsor-logos',
  'sponsor-logos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── event-images : PUBLIC, 10 MB, JPEG/PNG/WEBP/SVG ──────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images',
  'event-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
