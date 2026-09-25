<?php
require_once __DIR__ . '/../config.php';

class QRCode {
    /**
     * Generates a QR code image and saves it to disk.
     * Uses the free QR Server API (no library needed).
     */
    public static function generate(string $participantId, string $savePath): bool {
        $url  = QR_BASE_URL . urlencode($participantId);
        $size = QR_SIZE . 'x' . QR_SIZE;
        $apiUrl = "https://api.qrserver.com/v1/create-qr-code/?size={$size}&data=" . urlencode($url) . "&color=22C55E&bgcolor=0B0B0B&format=png&margin=10";

        $ctx = stream_context_create(['http' => ['timeout' => 15, 'user_agent' => 'MIXC-FitnessWalk/1.0']]);
        $img = @file_get_contents($apiUrl, false, $ctx);
        if ($img === false) return false;

        $dir = dirname($savePath);
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        return file_put_contents($savePath, $img) !== false;
    }

    public static function getUrl(string $qrPath): string {
        return Upload::pathToUrl($qrPath);
    }
}
