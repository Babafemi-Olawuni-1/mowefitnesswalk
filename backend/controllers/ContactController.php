<?php
require_once __DIR__ . '/../models/Contact.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Validator.php';

class ContactController {
    private Contact $model;
    public function __construct() { $this->model = new Contact(); }

    public function submit(): void {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $v = new Validator($body);
        $v->required('name')->required('email')->email('email')->required('subject')->required('message');
        if (!$v->passes()) Response::error('Validation failed.', 422, $v->errors());

        $this->model->create([
            'name'       => Validator::sanitizeString($v->get('name')),
            'email'      => strtolower(trim($v->get('email'))),
            'phone'      => Validator::sanitizeString($v->get('phone') ?? ''),
            'subject'    => Validator::sanitizeString($v->get('subject')),
            'message'    => Validator::sanitizeString($v->get('message')),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
        ]);
        Response::success(null, 'Your message has been received. We will get back to you shortly.', 201);
    }

    public function index(): void {
        Response::success($this->model->all($_GET['status'] ?? ''));
    }

    public function update(int $id): void {
        $contact = $this->model->find($id);
        if (!$contact) Response::notFound('Message not found.');
        $body    = json_decode(file_get_contents('php://input'), true) ?? [];
        $allowed = ['reply','status'];
        $data = [];
        foreach ($allowed as $k) { if (isset($body[$k])) $data[$k] = $body[$k]; }
        $this->model->update($id, $data);
        Response::success(null, 'Updated.');
    }

    public function delete(int $id): void {
        $contact = $this->model->find($id);
        if (!$contact) Response::notFound('Message not found.');
        $this->model->delete($id);
        Response::success(null, 'Deleted.');
    }
}
