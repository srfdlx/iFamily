-- Migration 001: Login-Code + Status "in Arbeit"
-- Fuer bestehende Installationen: in phpMyAdmin unter "SQL" ausfuehren.
-- Neuinstallationen brauchen das nicht, db/schema.sql enthaelt es bereits.

-- 1) Sechsstelliger Login-Code zusaetzlich zum Magic Link.
--    Noetig, weil auf iOS der Link aus der Mail immer in Safari oeffnet,
--    die installierte Homescreen-App aber einen eigenen Speicher hat und
--    deshalb nicht mit angemeldet wird.
ALTER TABLE magic_links ADD COLUMN code_hash CHAR(64) NULL AFTER token_hash;
ALTER TABLE magic_links ADD COLUMN attempts TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER code_hash;
ALTER TABLE magic_links ADD INDEX idx_magic_links_code (code_hash);

-- 2) Dritter Aufgaben-Status zwischen offen und erledigt.
ALTER TABLE tasks MODIFY COLUMN status ENUM('offen', 'in_arbeit', 'erledigt') NOT NULL DEFAULT 'offen';

-- 3) Wer eine Aufgabe uebernommen hat und wann.
ALTER TABLE tasks ADD COLUMN started_at DATETIME NULL AFTER status;
ALTER TABLE tasks ADD COLUMN started_by INT UNSIGNED NULL AFTER started_at;
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_started_by FOREIGN KEY (started_by) REFERENCES users(id) ON DELETE SET NULL;
