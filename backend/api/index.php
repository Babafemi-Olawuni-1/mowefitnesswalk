<?php
/**
 * API Router — Mowe-Ibafo X Community Fitness Walk 2026
 */

// ── Bootstrap ─────────────────────────────────────────────────────────────────
define('ROOT', dirname(__DIR__));
require_once ROOT . '/config.php';

// ── CORS ─────────────────────────────────────────────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
// Allow only configured frontend origin, localhost dev origin, or same-origin backend requests
$allowed = [FRONTEND_URL, APP_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'];
if ($origin && in_array($origin, $allowed, true)) {
    header("Access-Control-Allow-Origin: $origin");
} elseif (empty(FRONTEND_URL) || FRONTEND_URL === 'https://yourfrontend.netlify.app') {
    header('Access-Control-Allow-Origin: *');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ── Error Handling ────────────────────────────────────────────────────────────
set_exception_handler(function (Throwable $e) {
    require_once ROOT . '/helpers/Response.php';
    if (LOG_ERRORS) {
        $msg = date('Y-m-d H:i:s') . ' ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() . PHP_EOL;
        @file_put_contents(LOG_DIR . '/errors.log', $msg, FILE_APPEND);
    }
    Response::serverError(DEBUG ? $e->getMessage() : 'Internal server error.');
});

// ── Autoload helpers ──────────────────────────────────────────────────────────
require_once ROOT . '/helpers/Response.php';
require_once ROOT . '/middleware/AuthMiddleware.php';

// ── Route Parsing ─────────────────────────────────────────────────────────────
$requestUri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$scriptDir     = str_replace('/index.php', '', $_SERVER['SCRIPT_NAME']);
$path          = '/' . trim(str_replace($scriptDir, '', $requestUri), '/');
$method        = $_SERVER['REQUEST_METHOD'];
$segments      = array_values(array_filter(explode('/', trim($path, '/'))));

// ── Route Dispatch ────────────────────────────────────────────────────────────
// Public routes
if ($method === 'GET' && $segments === []) {
    Response::success(['status' => 'ok', 'api' => APP_NAME]);
}

// GET /download-pass/{filename}
if ($method === 'GET' && ($segments[0] ?? '') === 'download-pass' && isset($segments[1])) {
    $filename = basename($segments[1]);
    $filePath = UPLOAD_FLYERS . '/' . $filename;
    if (!file_exists($filePath) || strpos(realpath($filePath), realpath(UPLOAD_FLYERS)) !== 0) {
        http_response_code(404);
        echo 'Pass not found.';
        exit;
    }
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . filesize($filePath));
    readfile($filePath);
    exit;
}

// POST /register
if ($method === 'POST' && ($segments[0] ?? '') === 'register') {
    require_once ROOT . '/controllers/RegistrationController.php';
    (new RegistrationController())->register();
}

// GET /verify/{id} (also handled by verify.php, but JSON version here)
if ($method === 'GET' && ($segments[0] ?? '') === 'verify' && isset($segments[1])) {
    require_once ROOT . '/models/Participant.php';
    require_once ROOT . '/helpers/Upload.php';
    $p = (new Participant())->findByParticipantId(urldecode($segments[1]));
    if (!$p) Response::notFound('Participant not found.');
    Response::success([
        'participant_id'  => $p['participant_id'],
        'full_name'       => $p['full_name'],
        'status'          => $p['status'],
        'registered_at'   => $p['registered_at'],
        'photo_url'       => Upload::pathToUrl($p['photo_path']),
    ]);
}

// GET /sponsors
if ($method === 'GET' && ($segments[0] ?? '') === 'sponsors') {
    require_once ROOT . '/controllers/SponsorController.php';
    (new SponsorController())->index(true);
}

// GET /gallery
if ($method === 'GET' && ($segments[0] ?? '') === 'gallery') {
    require_once ROOT . '/controllers/GalleryController.php';
    (new GalleryController())->index(true);
}

// GET /event
if ($method === 'GET' && ($segments[0] ?? '') === 'event') {
    require_once ROOT . '/controllers/EventController.php';
    (new EventController())->get();
}

// POST /contact
if ($method === 'POST' && ($segments[0] ?? '') === 'contact') {
    require_once ROOT . '/controllers/ContactController.php';
    (new ContactController())->submit();
}

// ── Admin routes (protected) ──────────────────────────────────────────────────
if (($segments[0] ?? '') === 'admin') {
    $sub = $segments[1] ?? '';

    // POST /admin/login (public)
    if ($method === 'POST' && $sub === 'login') {
        require_once ROOT . '/controllers/AuthController.php';
        (new AuthController())->login();
    }

    // All routes below require auth
    $adminPayload = AuthMiddleware::handle();

    // Dashboard
    if ($method === 'GET' && $sub === 'dashboard') {
        require_once ROOT . '/models/Participant.php';
        require_once ROOT . '/models/Sponsor.php';
        $pModel = new Participant();
        $sModel = new Sponsor();
        Response::success([
            'stats'        => $pModel->stats(),
            'sponsor_count'=> $sModel->count(),
        ]);
    }

    // ── Participants ──────────────────────────────────────────────────────────
    if ($sub === 'participants') {
        require_once ROOT . '/controllers/ParticipantController.php';
        $ctrl = new ParticipantController();
        $id   = isset($segments[2]) ? (int)$segments[2] : null;
        $action = $segments[3] ?? null;

        if ($method === 'GET'    && !$id)               { $ctrl->index(); }
        elseif ($method === 'GET'    && $id && !$action) { $ctrl->show($id); }
        elseif ($method === 'GET'    && $id && $action === 'stats') { $ctrl->stats(); }
        elseif ($method === 'PUT'    && $id)             { $ctrl->update($id); }
        elseif ($method === 'DELETE' && $id)             { $ctrl->delete($id); }
        elseif ($method === 'POST'   && $id && $action === 'regenerate-pass') { $ctrl->regeneratePass($id); }
        elseif ($method === 'POST'   && $sub === 'participants' && $action === null && isset($segments[2]) && $segments[2] === 'bulk-delete') { $ctrl->bulkDelete(); }
        else   Response::notFound();
    }

    // Stats shortcut
    if ($method === 'GET' && $sub === 'stats') {
        require_once ROOT . '/controllers/ParticipantController.php';
        (new ParticipantController())->stats();
    }

    // ── Sponsors ──────────────────────────────────────────────────────────────
    if ($sub === 'sponsors') {
        require_once ROOT . '/controllers/SponsorController.php';
        $ctrl = new SponsorController();
        $id   = isset($segments[2]) ? (int)$segments[2] : null;
        if    ($method === 'GET')    { $ctrl->index(false); }
        elseif($method === 'POST')   { $ctrl->store(); }
        elseif($method === 'PUT'   && $id) { $ctrl->update($id); }
        elseif($method === 'DELETE'&& $id) { $ctrl->delete($id); }
        else  Response::notFound();
    }

    // ── Gallery ───────────────────────────────────────────────────────────────
    if ($sub === 'gallery') {
        require_once ROOT . '/controllers/GalleryController.php';
        $ctrl = new GalleryController();
        $id   = isset($segments[2]) ? (int)$segments[2] : null;
        if    ($method === 'GET')    { $ctrl->index(false); }
        elseif($method === 'POST')   { $ctrl->store(); }
        elseif($method === 'PUT'   && $id) { $ctrl->update($id); }
        elseif($method === 'DELETE'&& $id) { $ctrl->delete($id); }
        else  Response::notFound();
    }

    // ── Contacts ──────────────────────────────────────────────────────────────
    if ($sub === 'contacts') {
        require_once ROOT . '/controllers/ContactController.php';
        $ctrl = new ContactController();
        $id   = isset($segments[2]) ? (int)$segments[2] : null;
        if    ($method === 'GET')           { $ctrl->index(); }
        elseif($method === 'PUT'   && $id)  { $ctrl->update($id); }
        elseif($method === 'DELETE'&& $id)  { $ctrl->delete($id); }
        else  Response::notFound();
    }

    // ── Event ─────────────────────────────────────────────────────────────────
    if ($sub === 'event') {
        require_once ROOT . '/controllers/EventController.php';
        $ctrl = new EventController();
        if      ($method === 'GET') { $ctrl->get(); }
        elseif  ($method === 'PUT') { $ctrl->update(); }
        else    Response::notFound();
    }

    // ── Email ─────────────────────────────────────────────────────────────────
    if ($sub === 'email' && ($segments[2] ?? '') === 'send' && $method === 'POST') {
        require_once ROOT . '/controllers/EmailController.php';
        (new EmailController())->send();
    }

    // ── Export ────────────────────────────────────────────────────────────────
    if ($sub === 'export' && $method === 'GET' && isset($segments[2])) {
        require_once ROOT . '/controllers/ExportController.php';
        (new ExportController())->export($segments[2]);
    }
}

Response::notFound('Route not found.');
