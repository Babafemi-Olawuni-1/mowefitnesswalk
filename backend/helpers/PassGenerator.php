<?php
require_once __DIR__ . '/../config.php';

class PassGenerator {
    public static function generate(array $participant, string $qrImagePath): array {
        $w = PASS_WIDTH;
        $h = PASS_HEIGHT;

        $img = imagecreatetruecolor($w, $h);

        // ── Colors ─────────────────────────────────────────────────────────────
        $bg       = imagecolorallocate($img, 11, 11, 11);
        $accent   = imagecolorallocate($img, 34, 197, 94);
        $accentD  = imagecolorallocate($img, 22, 163, 74);
        $white    = imagecolorallocate($img, 255, 255, 255);
        $grey     = imagecolorallocate($img, 150, 150, 150);
        $card     = imagecolorallocate($img, 20, 20, 20);
        $border   = imagecolorallocate($img, 34, 197, 94);

        // ── Background ─────────────────────────────────────────────────────────
        imagefilledrectangle($img, 0, 0, $w, $h, $bg);

        // Left accent bar
        imagefilledrectangle($img, 0, 0, 8, $h, $accent);

        // Card background
        imagefilledrectangle($img, 20, 20, $w - 20, $h - 20, $card);

        // Top accent strip
        imagefilledrectangle($img, 20, 20, $w - 20, 55, $accent);

        // ── Header Text ────────────────────────────────────────────────────────
        $fontPath = null;
        // Try to find a system font
        foreach ([
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
            '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
        ] as $f) {
            if (file_exists($f)) { $fontPath = $f; break; }
        }

        if ($fontPath) {
            imagettftext($img, 18, 0, 36, 45, $white, $fontPath, strtoupper(EVENT_NAME));
            imagettftext($img, 9, 0, 36, 70, $grey, $fontPath, 'MOWE FITNESS WALK');
        } else {
            imagestring($img, 5, 40, 28, strtoupper(EVENT_NAME), $white);
            imagestring($img, 2, 40, 48, 'MOWE FITNESS WALK', $grey);
        }

        // ── OFFICIAL PARTICIPANT badge ─────────────────────────────────────────
        $badgeX = $w - 190;
        imagefilledrectangle($img, $badgeX, 70, $w - 30, 95, $accentD);
        if ($fontPath) {
            imagettftext($img, 8, 0, $badgeX + 10, 87, $white, $fontPath, 'OFFICIAL PARTICIPANT');
        } else {
            imagestring($img, 2, $badgeX + 10, 76, 'OFFICIAL PARTICIPANT', $white);
        }

        // ── Photo ──────────────────────────────────────────────────────────────
        $photoX = 40; $photoY = 80; $photoW = 160; $photoH = 180;
        imagefilledrectangle($img, $photoX - 3, $photoY - 3, $photoX + $photoW + 3, $photoY + $photoH + 3, $accent);

        if (file_exists($participant['photo_path'])) {
            $ext  = strtolower(pathinfo($participant['photo_path'], PATHINFO_EXTENSION));
            $src  = match($ext) {
                'jpg','jpeg' => @imagecreatefromjpeg($participant['photo_path']),
                'png'        => @imagecreatefrompng($participant['photo_path']),
                'webp'       => @imagecreatefromwebp($participant['photo_path']),
                default      => null,
            };
            if ($src) {
                imagecopyresampled($img, $src, $photoX, $photoY, 0, 0, $photoW, $photoH, imagesx($src), imagesy($src));
                imagedestroy($src);
            }
        } else {
            imagefilledrectangle($img, $photoX, $photoY, $photoX + $photoW, $photoY + $photoH, $card);
            imagestring($img, 3, $photoX + 50, $photoY + 80, 'PHOTO', $grey);
        }

        // ── Participant Info ────────────────────────────────────────────────────
        $infoX = 230; $infoY = 85;
        if ($fontPath) {
            imagettftext($img, 20, 0, $infoX, $infoY + 25, $white, $fontPath, $participant['full_name']);
            imagettftext($img, 10, 0, $infoX, $infoY + 55, $grey, $fontPath, 'PARTICIPANT ID');
            imagettftext($img, 14, 0, $infoX, $infoY + 78, $accent, $fontPath, $participant['participant_id']);
            imagettftext($img, 9, 0, $infoX, $infoY + 105, $grey, $fontPath, 'EMAIL');
            imagettftext($img, 11, 0, $infoX, $infoY + 122, $white, $fontPath, $participant['email']);
            imagettftext($img, 9, 0, $infoX, $infoY + 145, $grey, $fontPath, 'PHONE');
            imagettftext($img, 11, 0, $infoX, $infoY + 162, $white, $fontPath, $participant['phone']);
            imagettftext($img, 9, 0, $infoX, $infoY + 185, $grey, $fontPath, 'REGISTERED');
            imagettftext($img, 10, 0, $infoX, $infoY + 202, $white, $fontPath, date('d M Y', strtotime($participant['registered_at'])));
        } else {
            imagestring($img, 5, $infoX, $infoY + 10, $participant['full_name'], $white);
            imagestring($img, 3, $infoX, $infoY + 40, 'ID: ' . $participant['participant_id'], $accent);
            imagestring($img, 2, $infoX, $infoY + 60, $participant['email'], $grey);
            imagestring($img, 2, $infoX, $infoY + 78, $participant['phone'], $grey);
        }

        // ── QR Code ────────────────────────────────────────────────────────────
        $qrSize = 160; $qrX = $w - $qrSize - 35; $qrY = 75;
        imagefilledrectangle($img, $qrX - 5, $qrY - 5, $qrX + $qrSize + 5, $qrY + $qrSize + 5, $white);
        if ($qrImagePath && file_exists($qrImagePath)) {
            $qrSrc = @imagecreatefrompng($qrImagePath);
            if ($qrSrc) {
                imagecopyresampled($img, $qrSrc, $qrX, $qrY, 0, 0, $qrSize, $qrSize, imagesx($qrSrc), imagesy($qrSrc));
                imagedestroy($qrSrc);
            }
        }
        if ($fontPath) {
            imagettftext($img, 8, 0, $qrX + 20, $qrY + $qrSize + 20, $grey, $fontPath, 'SCAN TO VERIFY');
        } else {
            imagestring($img, 2, $qrX + 22, $qrY + $qrSize + 8, 'SCAN TO VERIFY', $grey);
        }

        // ── Footer ─────────────────────────────────────────────────────────────
        imagefilledrectangle($img, 20, $h - 55, $w - 20, $h - 20, imagecolorallocate($img, 15, 15, 15));
        $footerText = strtoupper(EVENT_NAME) . ' · ' . APP_URL;
        if ($fontPath) {
            imagettftext($img, 9, 0, 40, $h - 32, $accent, $fontPath, $footerText);
        } else {
            imagestring($img, 2, 40, $h - 40, $footerText, $accent);
        }

        // ── Logo ───────────────────────────────────────────────────────────────
        if (defined('COMMUNITY_LOGO') && file_exists(COMMUNITY_LOGO)) {
            $logo = @imagecreatefrompng(COMMUNITY_LOGO);
            if ($logo) {
                imagecopyresampled($img, $logo, $w - 80, 22, 0, 0, 50, 50, imagesx($logo), imagesy($logo));
                imagedestroy($logo);
            }
        }

        // ── Save ───────────────────────────────────────────────────────────────
        $dir      = UPLOAD_FLYERS;
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        $filename = 'pass_' . $participant['participant_id'] . '_' . time() . '.jpg';
        $savePath = $dir . '/' . $filename;
        $result   = imagejpeg($img, $savePath, 92);
        imagedestroy($img);

        if (!$result) {
            return ['success' => false, 'error' => 'Failed to generate pass image.'];
        }
        return ['success' => true, 'path' => $savePath, 'url' => APP_URL . '/api/download-pass/' . basename($savePath)];
    }
}
