<?php
require_once __DIR__ . '/../models/Participant.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Validator.php';
require_once __DIR__ . '/../helpers/Upload.php';
require_once __DIR__ . '/../helpers/QRCode.php';
require_once __DIR__ . '/../helpers/PassGenerator.php';
require_once __DIR__ . '/../helpers/Mailer.php';
require_once __DIR__ . '/../config.php';

class RegistrationController {
    public function register(): void {
        $v = new Validator($_POST);
        $v->required('full_name', 'Full Name')
          ->minLength('full_name', 2)
          ->maxLength('full_name', 150)
          ->required('email', 'Email')
          ->email('email')
          ->required('phone', 'Phone Number')
          ->phone('phone');

        if (!$v->passes()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        if (empty($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
            Response::error('Passport photograph is required.', 422, ['photo' => 'Please upload your passport photograph.']);
        }

        $model = new Participant();

        // Duplicate checks
        if (PREVENT_DUPLICATE_EMAIL) {
            if ($model->findByEmail($v->get('email'))) {
                Response::error('This email address is already registered.', 409);
            }
        }
        if (PREVENT_DUPLICATE_PHONE) {
            if ($model->findByPhone($v->get('phone'))) {
                Response::error('This phone number is already registered.', 409);
            }
        }

        // Upload photo
        $photoResult = Upload::handleImage($_FILES['photo'], UPLOAD_PHOTOS);
        if (!$photoResult['success']) {
            Response::error($photoResult['error'], 422, ['photo' => $photoResult['error']]);
        }

        // Generate participant ID
        $participantId = $model->generateId();

        // Generate QR code
        $qrFilename = 'qr_' . $participantId . '.png';
        $qrPath     = UPLOAD_FLYERS . '/' . $qrFilename;
        $qrGenerated = QRCode::generate($participantId, $qrPath);

        // Create participant record first (needed for pass generation)
        $participant = [
            'participant_id' => $participantId,
            'full_name'      => Validator::sanitizeString($v->get('full_name')),
            'email'          => strtolower(trim($v->get('email'))),
            'phone'          => $v->get('phone'),
            'photo_path'     => $photoResult['path'],
            'qr_path'        => $qrGenerated ? $qrPath : null,
            'flyer_path'     => null,
            'ip_address'     => $_SERVER['REMOTE_ADDR'] ?? null,
            'registered_at'  => date('Y-m-d H:i:s'),
        ];

        // Generate attendee pass
        $passResult = PassGenerator::generate($participant, $qrGenerated ? $qrPath : '');
        if ($passResult['success']) {
            $participant['flyer_path'] = $passResult['path'];
        }

        $id = $model->create($participant);

        // Send confirmation email (non-blocking)
        if ($passResult['success']) {
            @Mailer::sendRegistrationConfirmation($participant, $passResult['path']);
        }

        $responseData = [
            'participant_id'  => $participantId,
            'full_name'       => $participant['full_name'],
            'registered_at'   => $participant['registered_at'],
            'pass_url'        => $passResult['success'] ? $passResult['url'] : null,
            'qr_url'          => $qrGenerated ? Upload::pathToUrl($qrPath) : null,
            'verify_url'      => QR_BASE_URL . urlencode($participantId),
        ];

        Response::success($responseData, 'Registration successful! Your attendee pass is ready.', 201);
    }
}
