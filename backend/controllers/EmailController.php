<?php
require_once __DIR__ . '/../models/Participant.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Mailer.php';
require_once __DIR__ . '/../models/Database.php';

class EmailController {
    public function send(): void {
        $body    = json_decode(file_get_contents('php://input'), true) ?? [];
        $subject = trim($body['subject'] ?? '');
        $message = trim($body['message'] ?? '');
        $target  = $body['target'] ?? 'all'; // 'all' | 'verified' | array of IDs
        $attachment = $body['attachment_path'] ?? '';

        if (!$subject || !$message) {
            Response::error('Subject and message are required.', 422);
        }

        $model = new Participant();
        $status = match($target) {
            'verified' => 'verified',
            default    => '',
        };

        if (is_array($target)) {
            $participants = [];
            foreach ($target as $id) {
                $p = $model->findById((int)$id);
                if ($p) $participants[] = $p;
            }
        } else {
            $participants = $model->getAll($status);
        }

        if (empty($participants)) {
            Response::error('No participants found for the selected target.');
        }

        $db      = Database::getInstance();
        $sent    = 0;
        $failed  = 0;
        $logStmt = $db->prepare("INSERT INTO email_log (recipient, subject, status) VALUES (:email, :subject, :status)");

        foreach ($participants as $p) {
            $html = self::buildEmailBody($p, $subject, $message);
            $ok   = Mailer::send($p['email'], $subject, $html, $attachment && file_exists($attachment) ? $attachment : '');
            if ($ok) $sent++;
            else $failed++;
            $logStmt->execute([':email' => $p['email'], ':subject' => $subject, ':status' => $ok ? 'sent' : 'failed']);
        }

        Response::success(['sent' => $sent, 'failed' => $failed], "Email sent to $sent participants.");
    }

    private static function buildEmailBody(array $p, string $subject, string $message): string {
        $name    = htmlspecialchars($p['full_name']);
        $message = nl2br(htmlspecialchars($message));
        return <<<HTML
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
  <table width="600" style="background:#0B0B0B;border-radius:10px;border:1px solid #22C55E;margin:auto;" cellpadding="0" cellspacing="0">
    <tr><td bgcolor="#22C55E" style="padding:18px 24px;"><h2 style="color:#0B0B0B;margin:0;">Mowe-Ibafo X Community</h2></td></tr>
    <tr><td style="padding:24px;color:#fff;">
      <p>Dear <strong>$name</strong>,</p>
      <p>$message</p>
      <hr style="border-color:#333;margin:20px 0;">
      <p style="color:#888;font-size:12px;">Mowe-Ibafo X Community Fitness Walk 2026</p>
    </td></tr>
  </table>
</body></html>
HTML;
    }
}
