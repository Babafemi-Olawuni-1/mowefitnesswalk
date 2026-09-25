/**
 * Request validation schemas (zod).
 *
 * Error keys match the React form state exactly, so the client can drop
 * `errors` straight into its field state with no translation layer.
 */
import { z } from 'zod';

// Accepts +234..., 0803..., 803... etc. Digits only, 7-15 of them.
const phoneRegex = /^[+]?[0-9\s()-]{7,20}$/;

export const nameSchema = z
  .string({ required_error: 'Full name is required.' })
  .trim()
  .min(2, 'Full name is required.')
  .max(150, 'Full name must not exceed 150 characters.')
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}\p{Zs}.'-]*$/u, 'Full name contains invalid characters.');

export const emailSchema = z
  .string({ required_error: 'Valid email is required.' })
  .trim()
  .toLowerCase()
  .min(1, 'Valid email is required.')
  .max(150, 'Email must not exceed 150 characters.')
  .email('Valid email is required.');

export const phoneSchema = z
  .string({ required_error: 'Valid phone number required.' })
  .trim()
  .min(1, 'Valid phone number required.')
  .refine((value) => phoneRegex.test(value), 'Valid phone number required.')
  .refine(
    (value) => {
      const digits = value.replace(/\D/g, '').length;
      return digits >= 7 && digits <= 15;
    },
    'Valid phone number required.'
  );

/** The multipart body of POST /api/register (the photo is checked separately). */
export const registerSchema = z.object({
  full_name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  // Accepted for compatibility; the registered form may send either key.
  name: z.string().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'Password is required.' }).min(1, 'Password is required.').max(200),
});

export const contactSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  subject: z.string().trim().min(1, 'Subject is required.').max(300, 'Subject is too long.'),
  message: z.string().trim().min(1, 'Message is required.').max(5000, 'Message is too long.'),
});

export const participantUpdateSchema = z
  .object({
    full_name: nameSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    status: z.enum(['registered', 'verified', 'cancelled']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No valid fields to update.',
  });

export const bulkDeleteSchema = z.object({
  ids: z
    .array(z.coerce.number().int().positive())
    .min(1, 'No IDs provided.')
    .max(500, 'Too many ids in one request.'),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  search: z.string().trim().max(150).optional().default(''),
  status: z.enum(['registered', 'verified', 'cancelled', '']).optional().default(''),
});

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === '' || /^https?:\/\//i.test(value), 'Must be a valid http(s) URL.')
  .optional()
  .or(z.literal(''));

export const sponsorSchema = z.object({
  business_name: z.string().trim().min(1, 'Business Name').max(200),
  website_url: optionalUrl,
  whatsapp: z.string().trim().max(40).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  priority: z.coerce.number().int().min(0).max(9999).optional().default(0),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const sponsorUpdateSchema = sponsorSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No valid fields to update.',
  });

export const gallerySchema = z.object({
  caption: z.string().trim().max(300).optional().or(z.literal('')),
  category: z.string().trim().max(100).optional().default('general'),
  sort_order: z.coerce.number().int().min(0).max(9999).optional().default(0),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const galleryUpdateSchema = gallerySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No valid fields to update.',
  });

export const contactUpdateSchema = z
  .object({
    reply: z.string().trim().max(5000).optional().or(z.literal('')),
    status: z.enum(['new', 'read', 'replied', 'resolved']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No valid fields to update.',
  });

export const eventUpdateSchema = z
  .object({
    event_name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional().or(z.literal('')),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    event_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().or(z.literal('')),
    venue: z.string().trim().max(300).optional().or(z.literal('')),
    registration_open: z.coerce.boolean().optional(),
    contact_email: emailSchema.optional().or(z.literal('')),
    contact_phone: z.string().trim().max(30).optional().or(z.literal('')),
    whatsapp: z.string().trim().max(40).optional().or(z.literal('')),
    twitter_url: optionalUrl,
    instagram_url: optionalUrl,
    facebook_url: optionalUrl,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No valid fields provided.',
  });

export const broadcastSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required.').max(300),
  message: z.string().trim().min(1, 'Message is required.').max(10_000),
  target: z
    .union([
      z.literal('all'),
      z.literal('registered'),
      z.literal('verified'),
      z.array(z.coerce.number().int().positive()),
    ])
    .optional()
    .default('all'),
});

export const adminCreateSchema = z.object({
  email: emailSchema,
  password: z.string().min(12, 'Password must be at least 12 characters.').max(200),
  name: nameSchema,
  role: z.enum(['super', 'admin']).optional().default('admin'),
});

export const adminUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    role: z.enum(['super', 'admin']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No valid fields to update.',
  });

/** Normalise a multipart body into a plain object of strings. */
export function bodyToStrings(body = {}) {
  const result = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    result[key] = typeof value === 'string' ? value : String(value);
  }
  return result;
}

export default { registerSchema, loginSchema, contactSchema };
