# iFamily

Familien-Aufgabenplaner: Aufgaben zuweisen, Erinnerungen erhalten, gemeinsame Sammellisten führen – als installierbare Web-App (PWA), auch für iOS, ohne App Store.

## Funktionsumfang (MVP)

- **Aufgaben zuweisen** an ein Familienmitglied, mit Titel, Notiz und optionalem Fälligkeitsdatum
- **Erinnerungen** per Push-Benachrichtigung: entweder zu einer festen Uhrzeit oder mit Vorlaufzeit vor der Fälligkeit
- **Wiederkehrende Aufgaben** (täglich / wöchentlich / monatlich) – beim Abhaken wird automatisch die nächste Aufgabe erzeugt
- **Sammellisten** (z. B. Einkaufsliste), die alle Familienmitglieder gemeinsam befüllen und abhaken können
- **Login per Magic Link** (E-Mail, kein Passwort), danach eine langlebige Sitzung (kein wiederholtes Einloggen nötig)
- **Familien-Beitritt** über einen Einladungscode – beliebig viele Mitglieder möglich

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
    routes/         Route-Handler (auth, family, tasks, lists, push)
  .htaccess         Leitet /api/* an api/index.php, schützt .env/vendor/cron
cron/
  dispatch-reminders.php   CLI-Skript für fällige Erinnerungen (per Cron aufrufen)
db/schema.sql       MySQL-Datenbankschema
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
9. `https://<deine-subdomain>` im Browser öffnen. Auf dem iPhone: Safari → Teilen-Symbol → „Zum Home-Bildschirm“. Push-Benachrichtigungen funktionieren auf iOS erst ab iOS 16.4 und nur, wenn die App so installiert wurde (nicht im normalen Safari-Tab).

## Offene Punkte für den produktiven Einsatz

- Platzhalter-Icons (`public/icons/`) durch ein echtes Logo ersetzen (`node scripts/generate-icons.js` als Ausgangspunkt)
- Rate-Limiting für `/api/auth/request-link` ergänzen, bevor die App öffentlich erreichbar ist
- Regelmässiges Datenbank-Backup auf metanet.ch einrichten
