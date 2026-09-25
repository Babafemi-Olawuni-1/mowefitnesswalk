<?php
require_once __DIR__ . '/../models/Gallery.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Upload.php';
require_once __DIR__ . '/../helpers/Validator.php';

class GalleryController {
    private Gallery $model;
    public function __construct() { $this->model = new Gallery(); }

    public function index(bool $publicOnly = false): void {
        $items = $this->model->all($publicOnly);
        foreach ($items as &$item) {
            $item['image_url'] = Upload::pathToUrl($item['image_path']);
        }
        Response::success($items);
    }

    public function store(): void {
        if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            Response::error('Image is required.', 422);
        }
        $result = Upload::handleImage($_FILES['image'], UPLOAD_GALLERY);
        if (!$result['success']) Response::error($result['error'], 422);

        $id = $this->model->create([
            'image_path' => $result['path'],
            'caption'    => $_POST['caption'] ?? null,
            'category'   => $_POST['category'] ?? 'general',
            'sort_order' => (int)($_POST['sort_order'] ?? 0),
            'status'     => $_POST['status'] ?? 'active',
        ]);
        Response::success(['id' => $id, 'image_url' => Upload::pathToUrl($result['path'])], 'Image uploaded.', 201);
    }

    public function update(int $id): void {
        $item = $this->model->find($id);
        if (!$item) Response::notFound('Gallery item not found.');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $allowed = ['caption','category','sort_order','status'];
        $data = [];
        foreach ($allowed as $k) { if (isset($body[$k])) $data[$k] = $body[$k]; }
        $this->model->update($id, $data);
        Response::success(null, 'Gallery item updated.');
    }

    public function delete(int $id): void {
        $item = $this->model->find($id);
        if (!$item) Response::notFound('Gallery item not found.');
        Upload::delete($item['image_path']);
        $this->model->delete($id);
        Response::success(null, 'Gallery item deleted.');
    }
}
