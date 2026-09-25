<?php
require_once __DIR__ . '/../models/Sponsor.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Upload.php';
require_once __DIR__ . '/../helpers/Validator.php';

class SponsorController {
    private Sponsor $model;
    public function __construct() { $this->model = new Sponsor(); }

    public function index(bool $publicOnly = false): void {
        $sponsors = $this->model->all($publicOnly);
        foreach ($sponsors as &$s) {
            $s['logo_url'] = $s['logo_path'] ? Upload::pathToUrl($s['logo_path']) : null;
        }
        Response::success($sponsors);
    }

    public function store(): void {
        $v = new Validator($_POST);
        $v->required('business_name', 'Business Name');
        if (!$v->passes()) Response::error('Validation failed.', 422, $v->errors());

        $logoPath = null;
        if (!empty($_FILES['logo']) && $_FILES['logo']['error'] === UPLOAD_ERR_OK) {
            $result = Upload::handleImage($_FILES['logo'], UPLOAD_SPONSORS);
            if (!$result['success']) Response::error($result['error'], 422);
            $logoPath = $result['path'];
        }

        $id = $this->model->create([
            'business_name' => $v->get('business_name'),
            'logo_path'     => $logoPath,
            'website_url'   => $v->get('website_url'),
            'whatsapp'      => $v->get('whatsapp'),
            'description'   => $v->get('description'),
            'priority'      => (int)($_POST['priority'] ?? 0),
            'status'        => $_POST['status'] ?? 'active',
        ]);
        Response::success(['id' => $id], 'Sponsor created.', 201);
    }

    public function update(int $id): void {
        $sponsor = $this->model->find($id);
        if (!$sponsor) Response::notFound('Sponsor not found.');

        $data = [];
        $fields = ['business_name','website_url','whatsapp','description','priority','status'];
        foreach ($fields as $f) { if (isset($_POST[$f])) $data[$f] = $_POST[$f]; }

        if (!empty($_FILES['logo']) && $_FILES['logo']['error'] === UPLOAD_ERR_OK) {
            $result = Upload::handleImage($_FILES['logo'], UPLOAD_SPONSORS);
            if (!$result['success']) Response::error($result['error'], 422);
            Upload::delete($sponsor['logo_path']);
            $data['logo_path'] = $result['path'];
        }

        $this->model->update($id, $data);
        Response::success(null, 'Sponsor updated.');
    }

    public function delete(int $id): void {
        $sponsor = $this->model->find($id);
        if (!$sponsor) Response::notFound('Sponsor not found.');
        Upload::delete($sponsor['logo_path']);
        $this->model->delete($id);
        Response::success(null, 'Sponsor deleted.');
    }
}
