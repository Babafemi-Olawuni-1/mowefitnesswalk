-- =============================================================
-- Admin authentication seed
-- =============================================================
-- This file is designed to be executed against the live database
-- before the app is used. It creates/updates the admin account
-- that the API login endpoint validates.

CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('super','admin') NOT NULL DEFAULT 'admin',
  `last_login` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Admin credential:
-- Email: admin@mxcommunity.com
-- Password: Admin@2026
-- Password hash generated using PHP password_hash(..., PASSWORD_BCRYPT, ['cost' => 12])
INSERT INTO `admins` (`name`, `email`, `password`, `role`)
VALUES (
  'Super Admin',
  'admin@mxcommunity.com',
  '$2y$12$oyhJZMNF/8CnnALoApooouH/YpprmCSEJsdVNV6t.QhE.wUibxo/a',
  'super'
)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `password` = VALUES(`password`),
  `role` = VALUES(`role`);

-- Lock this down: no admin CRUD route is defined in the frontend/backend router
-- for editing admins through the API surface. The admin account is therefore
-- not writable from the admin UI pages that exist in this project.
