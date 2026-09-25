<?php
require_once __DIR__ . '/Database.php';

class Sponsor {
    private PDO $db;
    public function __construct() { $this->db = Database::getInstance(); }

    public function all(bool $activeOnly = false): array {
        $where = $activeOnly ? "WHERE status = 'active'" : '';
        $stmt  = $this->db->query("SELECT * FROM sponsors $where ORDER BY priority DESC, id ASC");
        return $stmt->fetchAll();
    }

    public function find(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM sponsors WHERE id = :id");
        $stmt->execute([':id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function create(array $data): int {
        $stmt = $this->db->prepare("INSERT INTO sponsors (business_name, logo_path, website_url, whatsapp, description, priority, status)
                                    VALUES (:name, :logo, :website, :wa, :desc, :priority, :status)");
        $stmt->execute([
            ':name'     => $data['business_name'],
            ':logo'     => $data['logo_path'] ?? null,
            ':website'  => $data['website_url'] ?? null,
            ':wa'       => $data['whatsapp'] ?? null,
            ':desc'     => $data['description'] ?? null,
            ':priority' => $data['priority'] ?? 0,
            ':status'   => $data['status'] ?? 'active',
        ]);
        return (int)$this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool {
        $sets = []; $params = [':id' => $id];
        foreach ($data as $k => $v) { $sets[] = "`$k` = :$k"; $params[":$k"] = $v; }
        $stmt = $this->db->prepare("UPDATE sponsors SET " . implode(', ', $sets) . " WHERE id = :id");
        return $stmt->execute($params);
    }

    public function delete(int $id): bool {
        $stmt = $this->db->prepare("DELETE FROM sponsors WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }

    public function count(): int {
        return (int)$this->db->query("SELECT COUNT(*) FROM sponsors WHERE status = 'active'")->fetchColumn();
    }
}
