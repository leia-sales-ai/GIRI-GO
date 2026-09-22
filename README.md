# GIRI Go

Leichtgewichtige Web-App für Video-/Foto-Arbeitsanleitungen: aufnehmen (3–5 s pro Schritt), annotieren, freigeben, per Link/QR ausführen, als SOP-PDF exportieren.

## Setup (einmalig, ca. 10 Minuten)

### 1. Supabase-Schema anlegen
1. supabase.com → Projekt öffnen → **SQL Editor** → **New query**
2. Inhalt von `supabase/schema.sql` einfügen → **Run**
3. Ergebnis: Tabellen `profiles`, `instructions`, `runs`, Storage-Bucket `media`, alle Policies, Realtime.

### 2. Auth konfigurieren (Magic Link)
1. **Authentication → URL Configuration**
   - Site URL: `https://leia-sales-ai.github.io/GIRI-GO/`
   - Redirect URLs: `https://leia-sales-ai.github.io/GIRI-GO/**` hinzufügen
2. **Authentication → Providers → Email**: Enabled, „Confirm email" darf an bleiben (Magic Link bestätigt automatisch).
3. Optional, aber für den Team-Einsatz nötig: **Project Settings → Auth → SMTP Settings** eigenen Mailserver eintragen (z. B. Resend, Postmark). Der eingebaute Mailversand ist auf wenige Mails pro Stunde begrenzt.

### 3. GitHub Pages aktivieren
1. Alle Dateien dieses Ordners ins Repo hochladen (Drag & Drop im Browser: „Add file → Upload files"), `index.html` muss im Root liegen.
2. Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch `main`, Ordner `/ (root)` → Save.
3. Nach 1–2 Minuten erreichbar unter `https://leia-sales-ai.github.io/GIRI-GO/`

### 4. Erster Login
- App öffnen → E-Mail + Name eingeben → Link in der Mail antippen.
- Beim ersten Login legt die App eine Beispiel-Anleitung im Workspace an.
- Rolle (Creator / Prüfer / Betrachter) oben rechts über den Namen ändern.
- Workspace = E-Mail-Domain: alle mit `@ar-giri.com` sehen dieselben Anleitungen.

## Konfiguration
Supabase-URL und Publishable Key stehen oben in `index.html` unter `window.GIRI_CONFIG`. Das sind öffentliche Frontend-Keys; die Sicherheit liegt in den Row-Level-Security-Policies.

## Datenmodell
- `instructions` – eine Zeile pro Anleitung, Schritte/Kapitel/Symbole/Freigaben als JSON in `data`
- `runs` – eine Zeile pro Checklisten-Durchführung (Werker, Zeitstempel je Schritt, Nicht-OK-Notizen + Beweisfoto)
- Storage `media/<workspace>/<anleitung>/<id>.mp4|jpg` – Clips und Fotos; `media/runs/<run>/…` – Beweisfotos
- Clips werden erst lokal (IndexedDB) gespeichert und dann im Hintergrund hochgeladen (Fortschritt oben in der App).

## Auf dem Handy installieren
Safari/Chrome → Teilen → „Zum Home-Bildschirm" – läuft dann als App im Vollbild.
