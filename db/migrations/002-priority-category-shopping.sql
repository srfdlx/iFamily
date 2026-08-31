-- Migration 002: Prioritaet, Kategorie und Einkaufsartikel je Aufgabe
-- Fuer bestehende Installationen: in phpMyAdmin unter "SQL" ausfuehren.
-- Neuinstallationen brauchen das nicht, db/schema.sql enthaelt es bereits.

ALTER TABLE tasks ADD COLUMN priority ENUM('hoch', 'mittel', 'niedrig') NOT NULL DEFAULT 'mittel' AFTER status;
ALTER TABLE tasks ADD COLUMN category ENUM('allgemein', 'einkauf', 'haushalt', 'persoenlich') NOT NULL DEFAULT 'allgemein' AFTER priority;
ALTER TABLE tasks ADD INDEX idx_tasks_priority (priority);
ALTER TABLE tasks ADD INDEX idx_tasks_category (category);

-- Einkaufsartikel, die direkt an einer Aufgabe haengen (Kategorie "einkauf").
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
