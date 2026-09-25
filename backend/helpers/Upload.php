<?php
require_once __DIR__ . '/../config.php';

class Upload {
    public static function handleImage(array $file, string $destination): array {
        if (!isset($file['tmp_name']) || $file['error'] !== UPLOAD_ERR_OK) {
            return ['success' => false, 'error' => 'Upload failed or no file provided.'];
        }
        if ($file['size'] > MAX_UPLOAD_SIZE) {
            return ['success' => false, 'error' => 'File size exceeds ' . (MAX_UPLOAD_SIZE / 1024 / 1024) . 'MB limit.'];
        }
        $mimeType = null;
        if (function_exists('finfo_open')) {
            $finfo    = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo !== false) {
                $mimeType = finfo_file($finfo, $file['tmp_name']);
                finfo_close($finfo);
            }
        } elseif (function_exists('mime_content_type')) {
            $mimeType = mime_content_type($file['tmp_name']);
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!$mimeType) {
            $mimeTypeMap = [
                'jpg'  => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'png'  => 'image/png',
                'webp' => 'image/webp',
            ];
            $mimeType = $mimeTypeMap[$ext] ?? null;
        }

        if (!in_array($mimeType, ALLOWED_IMAGE_TYPES, true)) {
            return ['success' => false, 'error' => 'Invalid file type. Allowed: JPG, PNG, WebP.'];
        }
        $filename = uniqid('img_', true) . '.' . strtolower($ext);
        $fullPath = rtrim($destination, '/') . '/' . $filename;
        if (!is_dir($destination)) {
            mkdir($destination, 0755, true);
        }
        if (!move_uploaded_file($file['tmp_name'], $fullPath)) {
            return ['success' => false, 'error' => 'Failed to save uploaded file.'];
        }
        return ['success' => true, 'path' => $fullPath, 'filename' => $filename];
    }

    public static function delete(string $path): void {
        if ($path && file_exists($path)) {
            @unlink($path);
        }
    }

    public static function pathToUrl(string $path): string {
        $relative = str_replace(UPLOAD_BASE, '', $path);
        return UPLOAD_URL . str_replace('\\', '/', $relative);
    }
}
