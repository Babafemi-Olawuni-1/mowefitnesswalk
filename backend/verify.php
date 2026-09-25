<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/models/Database.php';
require_once __DIR__ . '/models/Participant.php';
require_once __DIR__ . '/helpers/Upload.php';

$id          = trim($_GET['id'] ?? '');
$participant = null;
$error       = '';

if ($id) {
    try {
        $model       = new Participant();
        $participant = $model->findByParticipantId($id);
        if (!$participant) $error = 'Participant Not Found';
    } catch (Exception $e) {
        $error = 'Database error. Please try again.';
    }
} else {
    $error = 'No participant ID provided.';
}

$photoUrl = $participant ? Upload::pathToUrl($participant['photo_path']) : '';
$regDate  = $participant ? date('d F Y', strtotime($participant['registered_at'])) : '';
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verify Participant — <?= htmlspecialchars(APP_NAME) ?></title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0B0B0B; color: #fff; font-family: 'Segoe UI', Arial, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .card { background: #141414; border: 1px solid #22C55E; border-radius: 16px; max-width: 480px; width: 100%; overflow: hidden; box-shadow: 0 0 40px rgba(34,197,94,0.15); }
  .card-header { background: #22C55E; padding: 20px 28px; display: flex; align-items: center; gap: 12px; }
  .card-header h1 { color: #0B0B0B; font-size: 20px; font-weight: 800; }
  .card-header .badge { background: #0B0B0B; color: #22C55E; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; letter-spacing: 1px; }
  .card-body { padding: 28px; }
  .photo-wrap { display: flex; justify-content: center; margin-bottom: 24px; }
  .photo-wrap img { width: 110px; height: 110px; border-radius: 50%; border: 3px solid #22C55E; object-fit: cover; }
  .photo-placeholder { width: 110px; height: 110px; border-radius: 50%; background: #1f1f1f; border: 3px solid #22C55E; display: flex; align-items: center; justify-content: center; font-size: 40px; }
  table.info { width: 100%; border-collapse: collapse; }
  table.info tr { border-bottom: 1px solid #222; }
  table.info tr:last-child { border-bottom: none; }
  table.info td { padding: 10px 0; font-size: 14px; }
  table.info td:first-child { color: #22C55E; font-weight: 600; width: 42%; }
  table.info td:last-child { color: #fff; }
  .status-badge { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
  .status-registered { background: rgba(34,197,94,0.15); color: #22C55E; border: 1px solid #22C55E; }
  .status-verified   { background: rgba(34,197,94,0.3);  color: #4ade80; border: 1px solid #4ade80; }
  .status-cancelled  { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid #ef4444; }
  .error-box { text-align: center; padding: 40px 28px; }
  .error-icon { font-size: 60px; margin-bottom: 16px; }
  .error-box h2 { color: #ef4444; font-size: 22px; margin-bottom: 10px; }
  .error-box p  { color: #888; font-size: 14px; }
  .footer { padding: 16px 28px; text-align: center; border-top: 1px solid #1f1f1f; color: #555; font-size: 12px; }
  .verified-icon { display: flex; align-items: center; gap: 6px; color: #22C55E; font-weight: 700; margin-top: 16px; font-size: 15px; }
  .verified-icon::before { content: '✓'; background: #22C55E; color: #0B0B0B; border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 12px; }
</style>
</head>
<body>
<div class="card">
  <?php if ($participant): ?>
    <div class="card-header">
      <div>
        <h1>✅ Verified Participant</h1>
      </div>
      <span class="badge">MIXC 2026</span>
    </div>
    <div class="card-body">
      <div class="photo-wrap">
        <?php if ($photoUrl): ?>
          <img src="<?= htmlspecialchars($photoUrl) ?>" alt="<?= htmlspecialchars($participant['full_name']) ?>">
        <?php else: ?>
          <div class="photo-placeholder">👤</div>
        <?php endif; ?>
      </div>
      <table class="info">
        <tr><td>Name</td><td><?= htmlspecialchars($participant['full_name']) ?></td></tr>
        <tr><td>Participant ID</td><td><strong><?= htmlspecialchars($participant['participant_id']) ?></strong></td></tr>
        <tr><td>Registered</td><td><?= $regDate ?></td></tr>
        <tr>
          <td>Status</td>
          <td>
            <span class="status-badge status-<?= $participant['status'] ?>">
              <?= ucfirst($participant['status']) ?>
            </span>
          </td>
        </tr>
      </table>
      <div class="verified-icon">Official Fitness Walk Participant</div>
    </div>
  <?php else: ?>
    <div class="card-header">
      <h1>❌ Verification Failed</h1>
    </div>
    <div class="error-box">
      <div class="error-icon">🔍</div>
      <h2>Participant Not Found</h2>
      <p><?= htmlspecialchars($error) ?></p>
      <?php if ($id): ?>
        <p style="margin-top:10px;color:#555;font-size:12px;">ID: <?= htmlspecialchars($id) ?></p>
      <?php endif; ?>
    </div>
  <?php endif; ?>
  <div class="footer"><?= htmlspecialchars(APP_NAME) ?></div>
</div>
</body>
</html>
