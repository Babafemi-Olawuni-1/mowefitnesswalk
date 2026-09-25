<?php
require_once __DIR__ . '/Database.php';

class Contact {
    private PDO $db;
    public function __construct() { $this->db = Database::getInstance(); }

    public function create(array $data): int {
        $stmt = $this->db->prepare("INSERT INTO contacts (name, email, phone, subject, message, ip_address) VALUES (:name,:email,:phone,:subject,:message,:ip)");
        $stmt->execute([':name'=>$data['name'],':email'=>$data['email'],':phone'=>$data['phone']??null,':subject'=>$data['subject'],':message'=>$data['message'],':ip'=>$data['ip_address']??null]);
        return (int)$this->db->lastInsertId();
    }

    public function all(string $status = ''): array {
        $where = $status ? "WHERE status = :status" : '';
        $params = $status ? [':status' => $status] : [];
        $stmt = $this->db->prepare("SELECT * FROM contacts $where ORDER BY created_at DESC");
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function find(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM contacts WHERE id = :id");
        $stmt->execute([':id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function update(int $id, array $data): bool {
        $sets = []; $params = [':id' => $id];
        foreach ($data as $k => $v) { $sets[] = "`$k` = :$k"; $params[":$k"] = $v; }
        $stmt = $this->db->prepare("UPDATE contacts SET " . implode(', ', $sets) . " WHERE id = :id");
        return $stmt->execute($params);
    }

    public function delete(int $id): bool {
        $stmt = $this->db->prepare("DELETE FROM contacts WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }
}
