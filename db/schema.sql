-- iFamily Datenbankschema (MySQL / MariaDB)
-- Import: mysql -u USER -p DBNAME < db/schema.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS families (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  invite_code VARCHAR(12) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  family_id INT UNSIGNED NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(80) NOT NULL,
  digest_sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_family FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS magic_links (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  code_hash CHAR(64) NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_magic_links_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_magic_links_token (token_hash),
  INDEX idx_magic_links_code (code_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_token (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  family_id INT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  notes VARCHAR(2000) NULL,
  created_by INT UNSIGNED NOT NULL,
  assigned_to INT UNSIGNED NULL,
  status ENUM('offen', 'in_arbeit', 'erledigt') NOT NULL DEFAULT 'offen',
  priority ENUM('hoch', 'mittel', 'niedrig') NOT NULL DEFAULT 'mittel',
  category ENUM('allgemein', 'einkauf', 'haushalt', 'persoenlich') NOT NULL DEFAULT 'allgemein',
  started_at DATETIME NULL,
  started_by INT UNSIGNED NULL,
  due_at DATETIME NULL,
  remind_mode ENUM('fest', 'vorlauf') NULL,
  remind_at DATETIME NULL,
  remind_lead_minutes INT UNSIGNED NULL,
  reminder_sent_at DATETIME NULL,
  recurrence_rule ENUM('taeglich', 'woechentlich', 'monatlich') NULL,
  recurrence_interval INT UNSIGNED NOT NULL DEFAULT 1,
  parent_task_id INT UNSIGNED NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_family FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_started_by FOREIGN KEY (started_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_parent FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  INDEX idx_tasks_family (family_id),
  INDEX idx_tasks_remind_at (remind_at, reminder_sent_at),
  INDEX idx_tasks_priority (priority),
  INDEX idx_tasks_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS task_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_id INT UNSIGNED NOT NULL,
  text VARCHAR(300) NOT NULL,
  checked TINYINT(1) NOT NULL DEFAULT 0,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_items_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  INDEX idx_task_items_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lists (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  family_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lists_family FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  CONSTRAINT fk_lists_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_lists_family (family_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS list_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  list_id INT UNSIGNED NOT NULL,
  text VARCHAR(300) NOT NULL,
  checked TINYINT(1) NOT NULL DEFAULT 0,
  added_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_list_items_list FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
  CONSTRAINT fk_list_items_added_by FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_list_items_list (list_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_push_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_endpoint (endpoint(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
