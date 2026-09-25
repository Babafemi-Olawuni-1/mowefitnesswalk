<?php
require_once __DIR__ . '/../models/Admin.php';
require_once __DIR__ . '/../helpers/JWT.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Validator.php';

class AuthController {
    public function login(): void {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $v = new Validator($body);
        $v->required('email')->email('email')->required('password');
        if (!$v->passes()) { Response::error('Validation failed.', 422, $v->errors()); }

        $adminModel = new Admin();
        $admin = $adminModel->findByEmail($v->get('email'));
        if (!$admin || !$adminModel->verifyPassword($v->get('password'), $admin['password'])) {
            Response::error('Invalid email or password.', 401);
        }
        $adminModel->updateLastLogin($admin['id']);
        $token = JWT::encode(['sub' => $admin['id'], 'email' => $admin['email'], 'role' => $admin['role'], 'name' => $admin['name']]);
        Response::success(['token' => $token, 'admin' => ['id' => $admin['id'], 'name' => $admin['name'], 'email' => $admin['email'], 'role' => $admin['role']]]);
    }
}
