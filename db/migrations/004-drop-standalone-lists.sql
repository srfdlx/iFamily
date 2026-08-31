-- 004 – Eigenständige Sammellisten entfernen
--
-- ACHTUNG: OPTIONAL UND UNWIDERRUFLICH.
--
-- Die eigenständigen Sammellisten gibt es in der App nicht mehr; Einkaufsartikel
-- werden nur noch direkt in einer Aufgabe geführt (Kategorie "Einkauf").
-- Die App funktioniert auch, wenn diese beiden Tabellen einfach stehen bleiben –
-- sie werden schlicht nicht mehr angefasst.
--
-- Führe dieses Skript NUR aus, wenn du die alten Listendaten wirklich löschen
-- willst. Alles darin ist danach weg. Vorher am besten in phpMyAdmin unter
-- "Exportieren" eine Sicherung der beiden Tabellen ziehen.

DROP TABLE IF EXISTS list_items;
DROP TABLE IF EXISTS lists;
