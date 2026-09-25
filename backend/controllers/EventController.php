<?php
require_once __DIR__ . '/../models/Event.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Upload.php';

class EventController {
    private Event $model;
    public function __construct() { $this->model = new Event(); }

    public function get(): void {
        $event = $this->model->get();
        if ($event && $event['banner_path']) {
            $event['banner_url'] = Upload::pathToUrl($event['banner_path']);
        }
        Response::success($event);
    }

    public function update(): void {
        $data   = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $allowed = ['event_name','description','event_date','event_time','venue','registration_open',
                    'contact_email','contact_phone','whatsapp_number','twitter_url','instagram_url','facebook_url'];
        $update = [];
        foreach ($allowed as $k) {
            if (array_key_exists($k, $data)) $update[$k] = $data[$k];
        }

        if (!empty($_FILES['banner']) && $_FILES['banner']['error'] === UPLOAD_ERR_OK) {
            $result = Upload::handleImage($_FILES['banner'], UPLOAD_BASE . '/banners');
            if ($result['success']) {
                $current = $this->model->get();
                if ($current && $current['banner_path']) Upload::delete($current['banner_path']);
                $update['banner_path'] = $result['path'];
            }
        }

        if (empty($update)) Response::error('No valid fields provided.');
        $this->model->update($update);
        Response::success(null, 'Event settings updated.');
    }
}
