/**
 * POST /api/register
 *
 * multipart/form-data:
 *   full_name, email, phone, photo
 */
import { registerSchema, bodyToStrings } from '../validators/schemas.js';
import { validateOptionalImage } from '../middleware/upload.js';
import { register as runRegistration } from '../services/registration.service.js';
import { sendSuccess } from '../utils/response.js';

/** The React form sends `full_name`; older clients may send `name`. */
function normaliseBody(body) {
  const strings = bodyToStrings(body);
  if (!strings.full_name && strings.name) {
    strings.full_name = strings.name;
  }
  return strings;
}

export async function register(req, res) {
  const { full_name, email, phone } = registerSchema.parse(normaliseBody(req.body));

  // Magic-byte validated. A text file renamed to .jpg is rejected here.
  const photo = await validateOptionalImage(req.file, { field: 'photo', required: true });

  const data = await runRegistration({
    fullName: full_name,
    email,
    phone,
    photoBuffer: photo.buffer,
    photoMime: photo.detectedMime,
    ipAddress: req.ip ?? null,
  });

  return sendSuccess(res, data, 'Registration successful. Your attendee pass is ready.', 201);
}

export default { register };
