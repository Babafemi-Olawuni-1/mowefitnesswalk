<?php
require_once __DIR__ . '/../config.php';

class Mailer {
    /**
     * Send email using PHP mail() with headers.
     * For production, swap this body with PHPMailer + SMTP if available.
     */
    public static function send(string $to, string $subject, string $htmlBody, string $attachmentPath = ''): bool {
        $headers  = "MIME-Version: 1.0\r\n";
        $headers .= "From: " . SMTP_FROM_NAME . " <" . SMTP_FROM . ">\r\n";
        $headers .= "Reply-To: " . SMTP_FROM . "\r\n";
        $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";

        if ($attachmentPath && file_exists($attachmentPath)) {
            $boundary = md5(time());
            $headers .= "Content-Type: multipart/mixed; boundary=\"{$boundary}\"\r\n";
            $body  = "--{$boundary}\r\n";
            $body .= "Content-Type: text/html; charset=UTF-8\r\n";
            $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
            $body .= chunk_split(base64_encode($htmlBody)) . "\r\n";
            $body .= "--{$boundary}\r\n";
            $filename = basename($attachmentPath);
            $body .= "Content-Type: application/octet-stream; name=\"{$filename}\"\r\n";
            $body .= "Content-Transfer-Encoding: base64\r\n";
            $body .= "Content-Disposition: attachment; filename=\"{$filename}\"\r\n\r\n";
            $body .= chunk_split(base64_encode(file_get_contents($attachmentPath))) . "\r\n";
            $body .= "--{$boundary}--";
        } else {
            $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
            $body = $htmlBody;
        }

        return @mail($to, $subject, $body, $headers);
    }

    public static function sendRegistrationConfirmation(array $participant, string $flyerPath): bool {
        $subject = '🎉 Registration Confirmed — ' . EVENT_NAME;
        $html = self::registrationTemplate($participant, $flyerPath);
        return self::send($participant['email'], $subject, $html, $flyerPath);
    }

    private static function registrationTemplate(array $p, string $flyerPath): string {
        $name   = htmlspecialchars($p['full_name']);
        $pid    = htmlspecialchars($p['participant_id']);
        $date   = date('d F Y', strtotime($p['registered_at'] ?? 'now'));
        $verify = QR_BASE_URL . urlencode($pid);
        return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Registration Confirmed</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f4">
    <tr><td align="center" style="padding:30px 0;">
      <table width="600" cellpadding="0" cellspacing="0" bgcolor="#0B0B0B" style="border-radius:12px;overflow:hidden;border:1px solid #22C55E;">
        <tr><td bgcolor="#22C55E" style="padding:20px 30px;">
          <h1 style="color:#0B0B0B;margin:0;font-size:22px;">🏃 Registration Confirmed!</h1>
        </td></tr>
        <tr><td style="padding:30px;color:#ffffff;">
          <p style="font-size:16px;">Dear <strong>{$name}</strong>,</p>
          <p>Welcome to the <strong style="color:#22C55E;">Mowe-Ibafo X Community Fitness Walk 2026</strong>! Your registration was successful.</p>
          <table width="100%" cellpadding="10" cellspacing="0" bgcolor="#1a1a1a" style="border-radius:8px;margin:20px 0;">
            <tr><td style="color:#22C55E;font-weight:bold;width:40%;">Participant ID:</td><td style="color:#fff;">{$pid}</td></tr>
            <tr><td style="color:#22C55E;font-weight:bold;">Name:</td><td style="color:#fff;">{$name}</td></tr>
            <tr><td style="color:#22C55E;font-weight:bold;">Registered:</td><td style="color:#fff;">{$date}</td></tr>
          </table>
          <p>Your <strong>Attendee Pass</strong> is attached to this email. Please keep it handy for the event.</p>
          <p style="text-align:center;margin:25px 0;">
            <a href="{$verify}" style="background:#22C55E;color:#0B0B0B;padding:14px 28px;border-radius:30px;text-decoration:none;font-weight:bold;font-size:15px;">Verify My Pass</a>
          </p>
          <p style="color:#888;font-size:13px;">See you at the walk! Stay active, stay united. 💚</p>
        </td></tr>
        <tr><td bgcolor="#111" style="padding:15px 30px;color:#666;font-size:12px;text-align:center;">
          &copy; 2026 Mowe-Ibafo X Community · All rights reserved
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
    }
}
