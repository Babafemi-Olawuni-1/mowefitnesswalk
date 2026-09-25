<?php
require_once __DIR__ . '/../helpers/JWT.php';
require_once __DIR__ . '/../helpers/Response.php';

class AuthMiddleware {
    public static function handle(): array {
        $headers = getallheaders();
        $auth    = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        if (!$auth || !str_starts_with($auth, 'Bearer ')) {
            Response::unauthorized('No token provided.');
        }
        $token   = substr($auth, 7);
        $payload = JWT::decode($token);
        if (!$payload) {
            Response::unauthorized('Token invalid or expired.');
        }
        return $payload;
    }
}
