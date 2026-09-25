<?php
require_once __DIR__ . '/Database.php';

class Gallery {
    private PDO $db;
    public function __construct() { $this->db = Database::getInstance(); }

    public function all(bool $activeOnly = false): array {
        $where = $activeOnly ? "WHERE status = 'active'" : '';
        $stmt  = $this->db->query("SELECT * FROM gallery $where ORDER BY sort_order ASC, uploaded_at DESC");
        return $stmt->fetchAll();
    }

    public function find(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM gallery WHERE id = :id");
        $stmt->execute([':id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function create(array $data): int {
        $stmt = $this->db->prepare("INSERT INTO gallery (image_path, caption, category, sort_order, status) VALUES (:img, :cap, :cat, :sort, :status)");
        $stmt->execute([
            ':img'    => $data['image_path'],
            ':cap'    => $data['caption'] ?? null,
            ':cat'    => $data['category'] ?? 'general',
            ':sort'   => $data['sort_order'] ?? 0,
            ':status' => $data['status'] ?? 'active',
        ]);
        return (int)$this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool {
        $sets = []; $params = [':id' => $id];
        foreach ($data as $k => $v) { $sets[] = "`$k` = :$k"; $params[":$k"] = $v; }
        $stmt = $this->db->prepare("UPDATE gallery SET " . implode(', ', $sets) . " WHERE id = :id");
        return $stmt->execute($params);
    }

    public function delete(int $id): bool {
        $stmt = $this->db->prepare("DELETE FROM gallery WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }
}
