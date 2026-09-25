<?php
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/../config.php';

class Participant {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function generateId(): string {
        $stmt = $this->db->query("SELECT MAX(id) as max_id FROM participants");
        $row  = $stmt->fetch();
        $next = ($row['max_id'] ?? 0) + 1;
        return PARTICIPANT_PREFIX . '-' . str_pad($next, 6, '0', STR_PAD_LEFT);
    }

    public function create(array $data): int {
        $sql = "INSERT INTO participants (participant_id, full_name, email, phone, photo_path, flyer_path, qr_path, ip_address)
                VALUES (:pid, :name, :email, :phone, :photo, :flyer, :qr, :ip)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':pid'   => $data['participant_id'],
            ':name'  => $data['full_name'],
            ':email' => $data['email'],
            ':phone' => $data['phone'],
            ':photo' => $data['photo_path'],
            ':flyer' => $data['flyer_path'] ?? null,
            ':qr'    => $data['qr_path'] ?? null,
            ':ip'    => $data['ip_address'] ?? null,
        ]);
        return (int)$this->db->lastInsertId();
    }

    public function findById(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM participants WHERE id = :id");
        $stmt->execute([':id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function findByParticipantId(string $pid): ?array {
        $stmt = $this->db->prepare("SELECT * FROM participants WHERE participant_id = :pid");
        $stmt->execute([':pid' => $pid]);
        return $stmt->fetch() ?: null;
    }

    public function findByEmail(string $email): ?array {
        $stmt = $this->db->prepare("SELECT * FROM participants WHERE email = :email");
        $stmt->execute([':email' => $email]);
        return $stmt->fetch() ?: null;
    }

    public function findByPhone(string $phone): ?array {
        $stmt = $this->db->prepare("SELECT * FROM participants WHERE phone = :phone");
        $stmt->execute([':phone' => $phone]);
        return $stmt->fetch() ?: null;
    }

    public function update(int $id, array $data): bool {
        $sets   = [];
        $params = [':id' => $id];
        foreach ($data as $k => $v) {
            $sets[]        = "`$k` = :$k";
            $params[":$k"] = $v;
        }
        $sql  = "UPDATE participants SET " . implode(', ', $sets) . " WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($params);
    }

    public function delete(int $id): bool {
        $stmt = $this->db->prepare("DELETE FROM participants WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }

    public function paginate(int $page = 1, int $perPage = PAGE_SIZE, string $search = '', string $status = ''): array {
        $where  = [];
        $params = [];
        if ($search) {
            $where[]          = "(full_name LIKE :search OR email LIKE :search OR participant_id LIKE :search OR phone LIKE :search)";
            $params[':search'] = "%$search%";
        }
        if ($status) {
            $where[]          = "status = :status";
            $params[':status'] = $status;
        }
        $whereStr = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $offset   = ($page - 1) * $perPage;

        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM participants $whereStr");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $params[':limit']  = $perPage;
        $params[':offset'] = $offset;
        $stmt = $this->db->prepare("SELECT * FROM participants $whereStr ORDER BY registered_at DESC LIMIT :limit OFFSET :offset");
        $stmt->bindValue(':limit',  $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset,  PDO::PARAM_INT);
        foreach (array_diff_key($params, [':limit' => 1, ':offset' => 1]) as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->execute();
        $rows = $stmt->fetchAll();

        return ['data' => $rows, 'total' => $total, 'page' => $page, 'per_page' => $perPage, 'last_page' => (int)ceil($total / $perPage)];
    }

    public function getAll(string $status = ''): array {
        $where = $status ? "WHERE status = :status" : '';
        $params = $status ? [':status' => $status] : [];
        $stmt = $this->db->prepare("SELECT * FROM participants $where ORDER BY registered_at DESC");
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function stats(): array {
        $total   = $this->db->query("SELECT COUNT(*) FROM participants")->fetchColumn();
        $today   = $this->db->query("SELECT COUNT(*) FROM participants WHERE DATE(registered_at) = CURDATE()")->fetchColumn();
        $verified= $this->db->query("SELECT COUNT(*) FROM participants WHERE status = 'verified'")->fetchColumn();
        $week    = $this->db->query("SELECT DATE(registered_at) as d, COUNT(*) as cnt FROM participants WHERE registered_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY d ORDER BY d")->fetchAll();
        return ['total' => (int)$total, 'today' => (int)$today, 'verified' => (int)$verified, 'week_chart' => $week];
    }
}
