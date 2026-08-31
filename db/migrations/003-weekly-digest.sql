-- Migration 003: Merker fuer die woechentliche Erinnerungsmail
-- Fuer bestehende Installationen: in phpMyAdmin unter "SQL" ausfuehren.

-- Haelt fest, wann der letzte Wochenueberblick verschickt wurde, damit ein
-- zweiter Cron-Lauf am selben Tag nicht nochmal eine Mail ausloest.
ALTER TABLE users ADD COLUMN digest_sent_at DATETIME NULL AFTER display_name;
