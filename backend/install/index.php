<?php
session_start();

$lockFile = __DIR__ . '/install.lock';
$rootDir  = dirname(__DIR__);
$configFile = $rootDir . '/config.php';

// Prevent re-running after successful install
if (file_exists($lockFile)) {
    die('<!DOCTYPE html><html><head><title>Already Installed</title><style>body{background:#0B0B0B;color:#22C55E;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}</style></head><body><h1>✅ Already Installed</h1><p style="color:#888;margin-top:12px;">Delete <code>install/install.lock</code> to re-run.</p></body></html>');
}

$errors  = [];
$success = false;
$step    = 'check';

// ── Checks ────────────────────────────────────────────────────────────────────
$checks = [];
$checks['php_version'] = ['label' => 'PHP Version ≥ 8.0', 'pass' => version_compare(PHP_VERSION, '8.0.0', '>='), 'info' => PHP_VERSION];
$checks['pdo']         = ['label' => 'PDO Extension',      'pass' => extension_loaded('pdo'),         'info' => ''];
$checks['pdo_mysql']   = ['label' => 'PDO MySQL Driver',   'pass' => extension_loaded('pdo_mysql'),   'info' => ''];
$checks['gd']          = ['label' => 'GD Image Library',   'pass' => extension_loaded('gd'),           'info' => ''];
$checks['json']        = ['label' => 'JSON Extension',     'pass' => extension_loaded('json'),         'info' => ''];
$checks['mbstring']    = ['label' => 'Mbstring Extension', 'pass' => extension_loaded('mbstring'),     'info' => ''];
$checks['uploads_dir'] = ['label' => 'Uploads Directory Writable', 'pass' => is_writable($rootDir . '/uploads'), 'info' => $rootDir . '/uploads'];
$checks['logs_dir']    = ['label' => 'Logs Directory Writable',    'pass' => is_writable($rootDir . '/logs'),    'info' => $rootDir . '/logs'];

$allChecksPass = !in_array(false, array_column($checks, 'pass'), true);

// ── Handle form submission ────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $dbHost = trim($_POST['db_host'] ?? 'localhost');
    $dbName = trim($_POST['db_name'] ?? '');
    $dbUser = trim($_POST['db_user'] ?? '');
    $dbPass = $_POST['db_pass'] ?? '';
    $adminEmail = trim($_POST['admin_email'] ?? '');
    $adminPass  = $_POST['admin_pass'] ?? '';
    $appUrl     = rtrim(trim($_POST['app_url'] ?? ''), '/');

    if (!$dbName || !$dbUser || !$adminEmail || !$adminPass) {
        $errors[] = 'All fields are required.';
    } elseif (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Admin email is invalid.';
    } elseif (strlen($adminPass) < 8) {
        $errors[] = 'Admin password must be at least 8 characters.';
    } else {
        // Test DB connection
        try {
            $pdo = new PDO("mysql:host={$dbHost};charset=utf8mb4", $dbUser, $dbPass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $pdo->exec("USE `{$dbName}`");

            // Import schema
            $schema = file_get_contents($rootDir . '/database/schema.sql');
            foreach (array_filter(explode(';', $schema)) as $q) {
                $q = trim($q);
                if ($q) $pdo->exec($q);
            }

            // Create admin user
            $hash = password_hash($adminPass, PASSWORD_BCRYPT, ['cost' => 12]);
            $stmt = $pdo->prepare("INSERT INTO admins (name, email, password, role) VALUES ('Administrator', :email, :pass, 'super') ON DUPLICATE KEY UPDATE password = :pass2");
            $stmt->execute([':email' => $adminEmail, ':pass' => $hash, ':pass2' => $hash]);

            // Write config.php
            $jwtSecret = bin2hex(random_bytes(32));
            $configContent = file_get_contents($configFile);
            $configContent = preg_replace("/define\('DB_HOST',\s*'[^']*'\)/", "define('DB_HOST', '{$dbHost}')", $configContent);
            $configContent = preg_replace("/define\('DB_NAME',\s*'[^']*'\)/", "define('DB_NAME', '{$dbName}')", $configContent);
            $configContent = preg_replace("/define\('DB_USER',\s*'[^']*'\)/", "define('DB_USER', '{$dbUser}')", $configContent);
            $configContent = preg_replace("/define\('DB_PASS',\s*'[^']*'\)/", "define('DB_PASS', '{$dbPass}')", $configContent);
            $configContent = preg_replace("/define\('APP_URL',\s*'[^']*'\)/",  "define('APP_URL', '{$appUrl}')",  $configContent);
            $configContent = preg_replace("/define\('JWT_SECRET',\s*'[^']*'\)/", "define('JWT_SECRET', '{$jwtSecret}')", $configContent);
            file_put_contents($configFile, $configContent);

            // Lock installer
            file_put_contents($lockFile, date('Y-m-d H:i:s'));
            $success = true;

        } catch (PDOException $e) {
            $errors[] = 'Database error: ' . $e->getMessage();
        }
    }
}
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Installer — Mowe-Ibafo X Community</title>
<style>
  * { box-sizing: border-box; } body { background: #0B0B0B; color: #fff; font-family: 'Segoe UI', sans-serif; padding: 20px; }
  .container { max-width: 700px; margin: 40px auto; }
  h1 { font-size: 26px; color: #22C55E; margin-bottom: 4px; } h2 { font-size: 18px; color: #22C55E; margin: 24px 0 12px; }
  p { color: #aaa; font-size: 14px; margin-bottom: 20px; }
  .card { background: #141414; border: 1px solid #1f1f1f; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
  .check-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #1f1f1f; font-size: 14px; }
  .check-row:last-child { border-bottom: none; }
  .pass { color: #22C55E; font-weight: 700; } .fail { color: #ef4444; font-weight: 700; }
  label { display: block; color: #aaa; font-size: 13px; margin-bottom: 6px; margin-top: 14px; }
  input { width: 100%; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; color: #fff; padding: 10px 14px; font-size: 14px; }
  input:focus { outline: none; border-color: #22C55E; }
  button { background: #22C55E; color: #0B0B0B; border: none; padding: 13px 28px; border-radius: 30px; font-weight: 800; font-size: 15px; cursor: pointer; margin-top: 20px; width: 100%; }
  button:hover { background: #16a34a; }
  .alert-error { background: rgba(239,68,68,0.1); border: 1px solid #ef4444; border-radius: 8px; padding: 12px 16px; color: #ef4444; font-size: 14px; margin-bottom: 16px; }
  .success { text-align: center; padding: 40px 0; }
  .success h2 { font-size: 28px; color: #22C55E; } .success p { font-size: 16px; color: #aaa; }
  .cred-box { background: #0d1f11; border: 1px solid #22C55E; border-radius: 10px; padding: 16px; margin: 20px 0; text-align: left; }
  .cred-box p { color: #22C55E; margin: 4px 0; font-size: 14px; }
  .info-tag { color: #555; font-size: 12px; }
</style>
</head>
<body>
<div class="container">
  <h1>🏃 Installer</h1>
  <p>Mowe-Ibafo X Community Fitness Walk 2026 — Event Management System</p>

  <?php if ($success): ?>
    <div class="success">
      <div style="font-size:70px;">🎉</div>
      <h2>Installation Complete!</h2>
      <p>Your system is ready. Admin panel is at <strong>/admin/</strong>.</p>
      <div class="cred-box">
        <p>🔑 Login with the email and password you entered.</p>
        <p>🗑️ Delete the <code>install/</code> directory from your server for security.</p>
        <p>🌐 API is live at <strong><?= htmlspecialchars($_POST['app_url'] ?? '') ?>/api/</strong></p>
      </div>
    </div>
  <?php else: ?>

    <div class="card">
      <h2>System Checks</h2>
      <?php foreach ($checks as $check): ?>
        <div class="check-row">
          <span class="<?= $check['pass'] ? 'pass' : 'fail' ?>"><?= $check['pass'] ? '✓' : '✗' ?></span>
          <span style="flex:1"><?= $check['label'] ?></span>
          <?php if ($check['info']): ?><span class="info-tag"><?= htmlspecialchars($check['info']) ?></span><?php endif; ?>
        </div>
      <?php endforeach; ?>
      <?php if (!$allChecksPass): ?>
        <p style="color:#ef4444;margin-top:14px;">⚠ Fix the failed checks before continuing.</p>
      <?php endif; ?>
    </div>

    <?php if (!empty($errors)): ?>
      <div class="alert-error"><?= implode('<br>', array_map('htmlspecialchars', $errors)) ?></div>
    <?php endif; ?>

    <div class="card">
      <h2>Configuration</h2>
      <form method="POST">
        <label>Database Host</label>
        <input name="db_host" value="<?= htmlspecialchars($_POST['db_host'] ?? 'localhost') ?>" placeholder="localhost">
        <label>Database Name</label>
        <input name="db_name" value="<?= htmlspecialchars($_POST['db_name'] ?? 'whitehal_mixc') ?>" placeholder="whitehal_mixc">
        <label>Database Username</label>
        <input name="db_user" value="<?= htmlspecialchars($_POST['db_user'] ?? 'whitehal_user') ?>" placeholder="whitehal_user">
        <label>Database Password</label>
        <input name="db_pass" type="password" placeholder="••••••••">
        <label>Backend API URL (no trailing slash)</label>
        <input name="app_url" value="<?= htmlspecialchars($_POST['app_url'] ?? 'https://api.whitehallpavilionmotel.com') ?>" placeholder="https://api.whitehallpavilionmotel.com">
        <label>Admin Email</label>
        <input name="admin_email" type="email" value="<?= htmlspecialchars($_POST['admin_email'] ?? '') ?>" placeholder="admin@yourdomain.com">
        <label>Admin Password (min 8 chars)</label>
        <input name="admin_pass" type="password" placeholder="••••••••">
        <button type="submit" <?= !$allChecksPass ? 'disabled' : '' ?>>🚀 Install Now</button>
      </form>
    </div>

  <?php endif; ?>
</div>
</body>
</html>
