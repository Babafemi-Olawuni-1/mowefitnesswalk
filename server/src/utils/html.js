/**
 * HTML email templates.
 *
 * These reproduce the visual style of the old PHP mailer: dark card,
 * #22C55E green header, table based layout for maximum client
 * compatibility. All interpolated values are escaped.
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const shell = (title, inner) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f4">
    <tr><td align="center" style="padding:30px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" bgcolor="#0B0B0B" style="border-radius:12px;overflow:hidden;border:1px solid #22C55E;max-width:100%;">
        <tr><td bgcolor="#22C55E" style="padding:20px 30px;">
          <h1 style="color:#0B0B0B;margin:0;font-size:22px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(
            title
          )}</h1>
        </td></tr>
        <tr><td style="padding:30px;color:#ffffff;">
          ${inner}
        </td></tr>
        <tr><td bgcolor="#111111" style="padding:15px 30px;color:#666666;font-size:12px;text-align:center;">
          &copy; ${new Date().getFullYear()} Mowe-Ibafo X Community &middot; All rights reserved
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

/** Matches the old Mailer::registrationTemplate. */
export function registrationEmailTemplate({ participant, verifyUrl, eventName }) {
  const name = escapeHtml(participant.full_name);
  const pid = escapeHtml(participant.participant_id);
  const date = escapeHtml(participant.registered_at);
  const verify = escapeHtml(verifyUrl);

  return shell(
    '🏃 Registration Confirmed!',
    `
          <p style="font-size:16px;margin:0 0 12px;">Dear <strong>${name}</strong>,</p>
          <p style="line-height:1.6;margin:0 0 8px;">Welcome to the <strong style="color:#22C55E;">${escapeHtml(
            eventName
          )}</strong>! Your registration was successful.</p>
          <table width="100%" cellpadding="10" cellspacing="0" bgcolor="#1a1a1a" style="border-radius:8px;margin:20px 0;">
            <tr><td style="color:#22C55E;font-weight:bold;width:40%;">Participant ID:</td><td style="color:#fff;">${pid}</td></tr>
            <tr><td style="color:#22C55E;font-weight:bold;">Name:</td><td style="color:#fff;">${name}</td></tr>
            <tr><td style="color:#22C55E;font-weight:bold;">Registered:</td><td style="color:#fff;">${date}</td></tr>
          </table>
          <p style="line-height:1.6;">Your <strong>Attendee Pass</strong> is attached to this email. Please keep it handy for the event.</p>
          <p style="text-align:center;margin:25px 0;">
            <a href="${verify}" style="background:#22C55E;color:#0B0B0B;padding:14px 28px;border-radius:30px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">Verify My Pass</a>
          </p>
          <p style="color:#888888;font-size:13px;margin:0;">See you at the walk! Stay active, stay united. 💚</p>
        `
  );
}

/** Matches the old EmailController::buildEmailBody. */
export function broadcastEmailTemplate({ participant, message }) {
  const name = escapeHtml(participant.full_name);
  const body = escapeHtml(message).replace(/\n/g, '<br />');

  return shell(
    'Mowe-Ibafo X Community',
    `
          <p>Dear <strong>${name}</strong>,</p>
          <p>${body}</p>
          <hr style="border:none;border-top:1px solid #333333;margin:20px 0;">
          <p style="color:#888888;font-size:12px;">Mowe-Ibafo X Community Fitness Walk 2026</p>
        `
  );
}

export default { escapeHtml, registrationEmailTemplate, broadcastEmailTemplate };
