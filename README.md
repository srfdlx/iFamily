# iFamily

Familien-Aufgabenplaner: Aufgaben zuweisen, Erinnerungen erhalten, Einkäufe direkt in der Aufgabe sammeln – als installierbare Web-App (PWA), auch für iOS, ohne App Store.

## Funktionsumfang (MVP)

- **Aufgaben zuweisen** an ein Familienmitglied, mit Titel, Beschreibung, Priorität (Hoch/Mittel/Niedrig), Kategorie (Allgemein/Einkauf/Haushalt/Persönlich) und optionalem Fälligkeitsdatum
- **Einkaufsliste in der Aufgabe**: Kategorie „Einkauf“ wählen, dann lassen sich Artikel direkt in der Aufgabe erfassen und abhaken. Die Karte zeigt den Fortschritt (z. B. 1/5).
- **Suchen, filtern, sortieren** nach Status, Zuweisung, Priorität und Kategorie
- **Hell- und Dunkelmodus**, umschaltbar in der Kopfzeile, Einstellung wird gespeichert
- **Kalender-Export** aller Aufgaben mit Fälligkeitsdatum als `.ics` (inkl. Wiederholung und Erinnerung)
- **Drei Status wie am Kanban-Board**: Zu erledigen → In Arbeit → Erledigt. Bei „In Arbeit“ wird festgehalten, wer übernommen hat („Mami ist dran“), damit niemand doppelt anfängt. Tippen auf den Kreis schaltet weiter.
- **Aufgaben bearbeiten und löschen**: Tippen auf eine Aufgabe öffnet alle Felder
- **Erinnerungen** per Push-Benachrichtigung: entweder zu einer festen Uhrzeit oder mit Vorlaufzeit vor der Fälligkeit
- **Wiederkehrende Aufgaben** (täglich / wöchentlich / monatlich) – beim Abhaken wird automatisch die nächste Aufgabe erzeugt
- **Login nur mit E-Mail-Adresse** (kein Passwort, kein Name, keine Registrierung), danach eine langlebige Sitzung
- **Feste Zulassungsliste**: nur die in `ALLOWED_USERS` hinterlegten Adressen bekommen überhaupt einen Code. Beim ersten Login wird der Zugang automatisch angelegt.
- **Automatischer Abgleich** zwischen Geräten: Änderungen der anderen Person erscheinen nach wenigen Sekunden von selbst, ohne Neuladen
- **Wöchentliche Erinnerungsmail** mit den offenen Aufgaben je Person

### Warum ein sechsstelliger Code statt nur eines Links

Auf iOS öffnet ein Link aus der Mail-App immer Safari – und eine über „Zum Home-Bildschirm“
installierte PWA hat einen **eigenen, von Safari getrennten Speicher**. Über den Link wäre man
also in Safari angemeldet, während die App auf dem Home-Bildschirm ausgeloggt bleibt. Deshalb
enthält jede Anmeldemail zusätzlich einen sechsstelligen Code, den man direkt in der App eingibt.
Der Code ist an die E-Mail-Adresse gebunden, nur einmal verwendbar, läuft nach 15 Minuten ab und
wird nach fünf Fehlversuchen gesperrt.

## Technik-Stack

- Backend: PHP 8+ (kein Framework, schlanker eigener Router), MySQL/MariaDB (PDO)
- Frontend: PWA ohne Build-Schritt (reines HTML/CSS/JS), installierbar auf iOS via „Zum Home-Bildschirm“
- Push-Benachrichtigungen: Web Push (VAPID) über `minishlink/web-push`, kein Drittanbieter nötig
- E-Mail-Versand (Magic Link): SMTP über `phpmailer/phpmailer`
- Erinnerungsversand: PHP-CLI-Skript, per Cron/„Geplante Aufgaben“ ausgelöst

Gewählt, weil das Ziel-Hosting (metanet.ch, Shared-Hosting-Plan) PHP + MySQL + Composer + Cron bereitstellt, aber keine Node.js-Runtime.

## Projektstruktur

```
public/             Document Root – hierhin zeigt die Domain/Subdomain
  index.html, css/, js/app.js, manifest.json, service-worker.js, icons/, auth/verify.html   PWA-Frontend
  api/              PHP-Backend
    index.php       Front-Controller/Router
    config.php, db.php, auth.php, mailer.php, push.php, helpers.php, env.php
    routes/         Route-Handler (auth, family, tasks, push, sync)
  .htaccess         Leitet /api/* an api/index.php, schützt .env/vendor/cron
cron/
  dispatch-reminders.php   CLI-Skript für fällige Erinnerungen (per Cron aufrufen)
db/schema.sql       MySQL-Datenbankschema (Neuinstallation)
db/migrations/      Änderungen am Schema für bestehende Installationen
scripts/
  generate-icons.js       Platzhalter-App-Icons erzeugen (Node, keine Abhängigkeiten)
  generate-vapid.php      VAPID-Schlüsselpaar für Web Push erzeugen
composer.json       PHP-Abhängigkeiten (web-push, phpmailer)
```

`vendor/`, `.env` und `cron/` liegen bewusst **ausserhalb** von `public/` (dem Document Root) und sind damit vom Browser aus nicht erreichbar.

## Lokales Setup

```bash
composer install
cp .env.example .env
# .env ausfüllen (siehe unten)

# Datenbank anlegen und Schema importieren
mysql -u root -p -e "CREATE DATABASE ifamily CHARACTER SET utf8mb4;"
mysql -u root -p ifamily < db/schema.sql

# VAPID-Schlüssel für Web Push erzeugen und in .env eintragen
php scripts/generate-vapid.php

# Lokalen PHP-Server im Document Root starten
php -S localhost:3000 -t public
```

Die App läuft danach auf `http://localhost:3000`. Für die Erinnerungen lokal testen:
`php cron/dispatch-reminders.php` manuell aufrufen (auf dem Server übernimmt das ein Cron-Job, siehe unten).

### Wichtige `.env`-Variablen

| Variable | Bedeutung |
|---|---|
| `APP_URL` | Öffentliche URL der App (wird in Magic-Link-E-Mails verwendet) |
| `ALLOWED_USERS` | Wer sich anmelden darf, z. B. `a@x.ch:Oliver, b@x.ch:Sandra`. Andere Adressen werden abgewiesen. |
| `DB_*` | MySQL-Zugangsdaten |
| `SMTP_*`, `MAIL_FROM` | SMTP-Zugang für den Versand der Login-E-Mails |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Schlüsselpaar für Web Push (`php scripts/generate-vapid.php`) |
| `SESSION_TTL_DAYS` | Wie lange ein Login gültig bleibt (Standard: 90 Tage) |

Ohne SMTP-Konfiguration wird der Magic Link stattdessen ins PHP-Error-Log geschrieben (praktisch zum lokalen Testen).

## Deployment auf metanet.ch (Plesk, ohne SSH)

1. **Datenbank anlegen:** *Websites & Domains* → *Datenbanken* → *Datenbank hinzufügen*. Zugriffssteuerung: „Nur lokale Verbindungen zulassen“ (App und Datenbank laufen auf demselben Server). Name/Nutzer/Passwort notieren.
2. **Schema importieren:** bei der Datenbank auf *phpMyAdmin* → Tab *SQL* → Inhalt von `db/schema.sql` einfügen → ausführen.
3. **Code auf den Server bringen:**
   - **Git-Erweiterung** (falls unter „Entwicklertools“ vorhanden): Repository hinzufügen → `https://github.com/srfdlx/iFamily.git`. Bei privatem Repo verlangt Plesk Zugangsdaten dafür (z. B. einen GitHub Personal Access Token); alternativ das Repo kurzzeitig auf „öffentlich“ stellen (`.env` ist nicht im Repo, es enthält keine echten Zugangsdaten).
   - **Oder ZIP-Upload**: auf GitHub *Code* → *Download ZIP*, im Plesk-*Dateimanager* in den Domain-Ordner hochladen und entpacken.
4. **Composer-Abhängigkeiten installieren:** Icon „PHP Composer“ → `composer.json` im Domain-Ordner auswählen → *Installieren*. Das erzeugt den `vendor/`-Ordner.
5. **Dokumentenstamm auf `public` setzen:** *Hosting-Einstellungen* der Subdomain → Feld *Dokumentenstamm* auf den Unterordner `public` ändern. So bleiben `.env`, `vendor/` und `cron/` ausserhalb des öffentlich erreichbaren Bereichs. (Ist diese Option in eurer Oberfläche nicht sichtbar, greift ersatzweise der `.htaccess`-Schutz in `public/` – dann müssen alle Ordner trotzdem wie oben beschrieben ins Hosting-Wurzelverzeichnis.)
6. **`.env`-Datei anlegen:** im Dateimanager im Domain-Wurzelverzeichnis (eine Ebene über `public/`) eine neue Datei `.env` erstellen, Inhalt wie `.env.example`, mit den echten Werten aus Schritt 1, `APP_URL=https://<deine-subdomain>` sowie einem VAPID-Schlüsselpaar (`php scripts/generate-vapid.php`, z. B. über die Plesk-„Geplante Aufgaben“ einmalig ausführen, oder lokal generieren und Werte eintragen).
7. **HTTPS/SSL aktivieren:** Let's-Encrypt-Button in Plesk für die Subdomain. Zwingend nötig für Web Push und die iOS-Installation als PWA.
8. **Cron für Erinnerungen einrichten:** *Geplante Aufgaben* → neue Aufgabe → Befehl:
   ```
   php /pfad/zu/eurer/domain/cron/dispatch-reminders.php
   ```
   Intervall möglichst 1 Minute (falls vom Hosting nicht erlaubt, alle 5 Minuten – Erinnerungen kommen dann bis zu 5 Minuten später an). Den genauen Serverpfad zeigt der Plesk-Dateimanager an.

   **Zweite geplante Aufgabe für die Wochenmail**, z. B. montags um 07:00 (Cron-Stil `0 7 * * 1`):
   ```
   php /pfad/zu/eurer/domain/cron/weekly-digest.php
   ```
   Sie schickt jeder Person eine Übersicht ihrer offenen Aufgaben. Wer nichts Offenes hat, bekommt keine Mail. Ein zweiter Lauf innerhalb derselben Woche verschickt nichts doppelt.
9. `https://<deine-subdomain>` im Browser öffnen. Auf dem iPhone: Safari → Teilen-Symbol → „Zum Home-Bildschirm“. Push-Benachrichtigungen funktionieren auf iOS erst ab iOS 16.4 und nur, wenn die App so installiert wurde (nicht im normalen Safari-Tab).

## Updates einspielen (bestehende Installation)

1. In Plesk unter *Git* die neuen Commits **pullen**.
2. **Falls im Ordner `db/migrations/` neue Dateien dazugekommen sind**, diese der Reihe nach in
   phpMyAdmin unter *SQL* ausführen. Sie ändern nur die Struktur und lassen bestehende Daten
   unangetastet. Bereits eingespielte Migrationen nicht erneut ausführen.
3. Nur wenn sich `composer.json` geändert hat: Composer im Plesk-Panel erneut ausführen.
4. In der App einmal neu laden. Der Service Worker holt Dateien immer zuerst vom
   Server (Cache dient nur als Offline-Reserve), erkennt die neue Version selbst
   und lädt die Seite einmal automatisch neu.

## Offene Punkte für den produktiven Einsatz

- Platzhalter-Icons (`public/icons/`) durch ein echtes Logo ersetzen (`node scripts/generate-icons.js` als Ausgangspunkt)
- Rate-Limiting für `/api/auth/request-link` ergänzen, bevor die App öffentlich erreichbar ist
- Regelmässiges Datenbank-Backup auf metanet.ch einrichten
