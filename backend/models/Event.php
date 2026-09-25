<?php
require_once __DIR__ . '/Database.php';

class Event {
    private PDO $db;
    public function __construct() { $this->db = Database::getInstance(); }

    public function get(): ?array {
        return $this->db->query("SELECT * FROM event_settings LIMIT 1")->fetch() ?: null;
    }

    public function update(array $data): bool {
        $sets = []; $params = [];
        foreach ($data as $k => $v) { $sets[] = "`$k` = :$k"; $params[":$k"] = $v; }
        $stmt = $this->db->prepare("UPDATE event_settings SET " . implode(', ', $sets) . " WHERE id = 1");
        return $stmt->execute($params);
    }
}
