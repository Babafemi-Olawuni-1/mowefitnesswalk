<?php
require_once __DIR__ . '/../models/Participant.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Upload.php';
require_once __DIR__ . '/../helpers/QRCode.php';
require_once __DIR__ . '/../helpers/PassGenerator.php';
require_once __DIR__ . '/../helpers/Validator.php';

class ParticipantController {
    private Participant $model;
    public function __construct() { $this->model = new Participant(); }

    public function index(): void {
        $page   = (int)($_GET['page'] ?? 1);
        $search = $_GET['search'] ?? '';
        $status = $_GET['status'] ?? '';
        Response::success($this->model->paginate($page, PAGE_SIZE, $search, $status));
    }

    public function show(int $id): void {
        $p = $this->model->findById($id);
        if (!$p) Response::notFound('Participant not found.');
        $p['photo_url'] = Upload::pathToUrl($p['photo_path']);
        $p['pass_url']  = $p['flyer_path'] ? Upload::pathToUrl($p['flyer_path']) : null;
        $p['qr_url']    = $p['qr_path']    ? Upload::pathToUrl($p['qr_path'])    : null;
        Response::success($p);
    }

    public function update(int $id): void {
        $p = $this->model->findById($id);
        if (!$p) Response::notFound('Participant not found.');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $allowed = ['full_name','email','phone','status'];
        $data = [];
        foreach ($allowed as $k) { if (isset($body[$k])) $data[$k] = $body[$k]; }
        if (empty($data)) Response::error('No valid fields to update.');
        $this->model->update($id, $data);
        Response::success(null, 'Participant updated.');
    }

    public function delete(int $id): void {
        $p = $this->model->findById($id);
        if (!$p) Response::notFound('Participant not found.');
        Upload::delete($p['photo_path']);
        Upload::delete($p['flyer_path']);
        Upload::delete($p['qr_path']);
        $this->model->delete($id);
        Response::success(null, 'Participant deleted.');
    }

    public function regeneratePass(int $id): void {
        $p = $this->model->findById($id);
        if (!$p) Response::notFound('Participant not found.');
        // Regen QR
        $qrPath = UPLOAD_FLYERS . '/qr_' . $p['participant_id'] . '.png';
        QRCode::generate($p['participant_id'], $qrPath);
        // Regen pass
        $passResult = PassGenerator::generate($p, $qrPath);
        if (!$passResult['success']) Response::serverError('Pass generation failed.');
        $this->model->update($id, ['flyer_path' => $passResult['path'], 'qr_path' => $qrPath]);
        Response::success(['pass_url' => $passResult['url']], 'Pass regenerated.');
    }

    public function stats(): void {
        Response::success($this->model->stats());
    }

    public function bulkDelete(): void {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $ids  = $body['ids'] ?? [];
        if (empty($ids) || !is_array($ids)) Response::error('No IDs provided.');
        foreach ($ids as $id) {
            $p = $this->model->findById((int)$id);
            if ($p) {
                Upload::delete($p['photo_path']);
                Upload::delete($p['flyer_path']);
                Upload::delete($p['qr_path']);
                $this->model->delete((int)$id);
            }
        }
        Response::success(null, count($ids) . ' participants deleted.');
    }
}
