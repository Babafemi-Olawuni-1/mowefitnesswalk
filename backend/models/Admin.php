<?php
require_once __DIR__ . '/Database.php';

class Admin {
    private PDO $db;
    public function __construct() { $this->db = Database::getInstance(); }

    public function findByEmail(string $email): ?array {
        $stmt = $this->db->prepare("SELECT * FROM admins WHERE email = :email");
        $stmt->execute([':email' => $email]);
        return $stmt->fetch() ?: null;
    }

    public function updateLastLogin(int $id): void {
        $stmt = $this->db->prepare("UPDATE admins SET last_login = NOW() WHERE id = :id");
        $stmt->execute([':id' => $id]);
    }

    public function verifyPassword(string $plain, string $hash): bool {
        return password_verify($plain, $hash);
    }
}
