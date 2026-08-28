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

### Deployment ohne SSH, nur über das Plesk-Kundencenter

Falls kein Terminalzugang eingerichtet ist, funktioniert es komplett über die Weboberfläche:

1. **Datenbank anlegen:** *Websites & Domains* → *Datenbanken* → *Datenbank hinzufügen*. Name, Nutzer und Passwort notieren.
2. **Schema importieren:** bei der Datenbank auf *phpMyAdmin* klicken → Tab *SQL* → Inhalt von `db/schema.sql` einfügen → *OK*.
3. **Node.js aktivieren:** *Websites & Domains* → Subdomain auswählen → Symbol *Node.js* → Node.js-Unterstützung aktivieren (Version 18 oder höher wählen).
   - *Applikationsstamm*: Ordner der Subdomain (z. B. `familie.deinedomain.ch`)
   - *Startdatei der Applikation*: `server/index.js`
4. **Code hochladen** – zwei Möglichkeiten:
   - **Git-Erweiterung** (falls in Plesk vorhanden): *Websites & Domains* → *Git* → Repository hinzufügen → `https://github.com/srfdlx/iFamily.git`. Ist das Repo privat, verlangt Plesk Zugangsdaten dafür (z. B. einen GitHub Personal Access Token); alternativ das Repo kurzzeitig auf „öffentlich“ stellen (es enthält keine echten Zugangsdaten, `.env` ist nicht im Repo).
   - **ZIP-Upload**: auf GitHub *Code* → *Download ZIP*, dann im Plesk-*Dateimanager* in den Applikationsstamm hochladen und entpacken.
5. Im Node.js-Panel auf **„NPM installieren"** klicken (entspricht `npm install`).
6. **`.env`-Datei anlegen**: im Dateimanager im Applikationsstamm eine neue Datei `.env` erstellen, Inhalt wie in `.env.example`, mit den echten Werten aus Schritt 1 sowie `APP_URL=https://<deine-subdomain>`. Für Web Push kann direkt folgendes fertig generiertes Schlüsselpaar eingetragen werden (oder ein eigenes, siehe `npm run generate-vapid`):
   ```
   VAPID_PUBLIC_KEY=BHzqbEJ-MhDQAaIec3B2uyTtTBw_qVdfCOWZPCWk9N0cDu1a4Wb3NDsHEyIhm9nIjj4xM7Zw06SMJlLkJrZ_jTk
   VAPID_PRIVATE_KEY=l_BcjmDeVlm7HHa40pfFwXWzLHwNGH3eCmXgoilDEY8
   ```
7. Im Node.js-Panel auf **„Anwendung neu starten"** klicken.
8. HTTPS/SSL für die Subdomain aktivieren (Let's-Encrypt-Button in Plesk), dann `https://<deine-subdomain>` im Browser öffnen.

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
