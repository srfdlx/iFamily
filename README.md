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

- Backend: Node.js + Express, MySQL/MariaDB (`mysql2`)
- Frontend: PWA ohne Build-Schritt (reines HTML/CSS/JS), installierbar auf iOS via „Zum Home-Bildschirm“
- Push-Benachrichtigungen: Web Push (VAPID), kein Drittanbieter nötig
- E-Mail-Versand (Magic Link): SMTP (`nodemailer`)

## Lokales Setup

```bash
npm install
cp .env.example .env
# .env ausfüllen (siehe unten)

# Datenbank anlegen und Schema importieren
mysql -u root -p -e "CREATE DATABASE ifamily CHARACTER SET utf8mb4;"
mysql -u root -p ifamily < db/schema.sql

# VAPID-Schlüssel für Web Push erzeugen und in .env eintragen
npm run generate-vapid

npm run dev
```

Die App läuft danach auf `http://localhost:3000`.

### Wichtige `.env`-Variablen

| Variable | Bedeutung |
|---|---|
| `APP_URL` | Öffentliche URL der App (wird in Magic-Link-E-Mails verwendet) |
| `DB_*` | MySQL-Zugangsdaten |
| `SMTP_*`, `MAIL_FROM` | SMTP-Zugang für den Versand der Login-E-Mails |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Schlüsselpaar für Web Push (`npm run generate-vapid`) |
| `SESSION_TTL_DAYS` | Wie lange ein Login gültig bleibt (Standard: 90 Tage) |

Ohne SMTP-Konfiguration wird der Magic Link stattdessen in die Server-Konsole geschrieben (praktisch zum lokalen Testen).

## Deployment auf metanet.ch

1. **Node.js-Runtime aktivieren** im metanet.ch-Kundencenter für die gewünschte Domain/Subdomain (z. B. `familie.deinedomain.ch`).
2. **MySQL-Datenbank anlegen** im Kundencenter, Zugangsdaten notieren.
3. Projekt per Git auf den Server bringen (metanet.ch unterstützt Git/SSH):
   ```bash
   git clone https://github.com/srfdlx/ifamily.git
   cd ifamily
   npm install --omit=dev
   ```
4. `.env` auf dem Server anlegen (siehe oben) mit den echten MySQL- und SMTP-Zugangsdaten sowie der öffentlichen `APP_URL` (https).
5. Schema importieren: `mysql -u USER -p DBNAME < db/schema.sql`
6. App über die von metanet.ch vorgesehene Node.js-Startmethode starten (z. B. `npm start`, oder gemäss deren Node.js-Hosting-Anleitung mit Passenger/PM2).
7. **HTTPS ist zwingend** für Web Push und für die iOS-Installation als PWA – auf metanet.ch per kostenlosem SSL-Zertifikat aktivieren.
8. Auf dem iPhone: Seite in Safari öffnen → Teilen-Symbol → „Zum Home-Bildschirm“. Push-Benachrichtigungen funktionieren auf iOS erst ab iOS 16.4 und nur, wenn die App so installiert wurde (nicht im normalen Safari-Tab).

## Projektstruktur

```
server/           Express-Backend (Auth, API, Scheduler)
  routes/         API-Routen (auth, family, tasks, lists, push)
db/schema.sql     MySQL-Datenbankschema
public/           PWA-Frontend (index.html, app.js, manifest, service worker)
scripts/          Hilfsskripte (Icon-Generierung)
```

## Offene Punkte für den produktiven Einsatz

- Platzhalter-Icons (`public/icons/`) durch ein echtes Logo ersetzen (`npm run generate-icons` als Ausgangspunkt)
- Rate-Limiting für `/api/auth/request-link` ergänzen, bevor die App öffentlich erreichbar ist
- Regelmässiges Datenbank-Backup auf metanet.ch einrichten
