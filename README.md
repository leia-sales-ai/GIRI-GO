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

## Rollen, Teams, Projekte (ab v0.9)
- Rollen: **Super Admin** (alles, inkl. Admin-Panel), **Creator** (aufnehmen, bearbeiten, freigeben), **Freigeber/Approver** (freigeben), **Betrachter**. Der erste Benutzer eines Workspace ist Super Admin. Admins laden Benutzer ein (Login-Link per Mail, Rolle vorab wählbar), vergeben Rollen, legen Teams an und ordnen Projekte Teams zu (Zahnrad oben rechts oder „Admin“ auf der Startseite).
- Startseite = Projektübersicht (Karten), „Alle Anleitungen“ als flache Liste. Im Projekt werden neue Anleitungen direkt im Projekt angelegt.
- Checklisten-Durchführungen werden schon während der Arbeit gespeichert (Status „läuft“ im Job-Done-Protokoll) und beim Abschließen finalisiert.
- **Projekte** (Ordner) organisieren Anleitungen. Ohne Team-Zuordnung sehen alle im Workspace das Projekt; mit Zuordnung nur die Team-Mitglieder (Rolle im Team gilt für die Anleitungen des Projekts).
- Veröffentlichte Links/QR-Codes funktionieren immer ohne Login. Die Projekt-Sichtbarkeit wird derzeit in der App geprüft (Datenbank-Regeln pro Projekt folgen).

## Übersetzungen
- Ein Link für alle Sprachen: Der Werker wählt oben in der Anleitung die Sprache (Flagge). Die Übersetzung läuft live über die Edge Function `translate` (DeepL, Key im Vault) und wird in der Anleitung zwischengespeichert.
- Text zwischen `==` und `==` wird nicht übersetzt (z. B. `==M6==`). `**fett**`, Listen (`- ` / `1. `) und Links `[Text](https://…)` bleiben erhalten.
- Die App-Oberfläche selbst gibt es in Deutsch und Englisch; jede weitere Sprache (FR, ES, IT, NL, PL, CS, TR, PT, RO, HU) wird beim ersten Wechsel einmal per DeepL übersetzt, serverseitig in `ui_tx` zwischengespeichert und auf dem Gerät gemerkt (Sprachmenü oben rechts, im Viewer über die Flagge).

## Fotos & Videos importieren
- Editor: „Importieren“ im Schritte-Panel (Handy: Fotomediathek, Mehrfachauswahl) oder Dateien einfach auf die Seite ziehen (PC). Aufnahme-Screen: Import-Symbol oben rechts.
- Jede Datei wird ein eigener Schritt, eingefügt nach dem markierten Schritt, in Aufnahmereihenfolge (Datei-Datum). Fotos werden auf 1600 px verkleinert (JPEG), Videos unverändert übernommen (max. 80 MB, Anfangs-Trim 15 s).
- iPhone-Videos im HEVC-Format laufen nur in Safari. Für die Bearbeitung am PC in den iPhone-Einstellungen unter Kamera → Formate „Maximale Kompatibilität“ wählen.

## Als App installieren (PWA)
- Android/Chrome/Edge: Beim ersten Öffnen erscheint „Als App installieren“ (auch im Profil-Menü). iPhone/iPad: Safari → Teilen → „Zum Home-Bildschirm“.
- Dateien im Repo: `manifest.webmanifest`, `sw.js` (Service Worker: App-Shell offline, Bibliotheken gecacht, Daten immer live), `icons/`.
- Neue Version: einfach alle Dateien aus dem Release-Ordner hochladen (überschreiben). `sw.js` muss nicht angepasst werden – die App holt `index.html` immer frisch und zeigt „Neue Version verfügbar“.
- Login in der installierten App: Der Magic Link öffnet sich im Browser, nicht in der App. Deshalb gibt es im Login ein Code-Feld – dafür muss in Supabase (Authentication → Email Templates → Magic Link) der Code in die Mail: `{{ .Token }}`.

## Video-Konvertierung
- Jeder Clip wird im Browser (WebCodecs) zu H.264-MP4 mit max. 1280 px und ~2 Mbit/s konvertiert: Importe sofort beim Import, Aufnahmen (z. B. WebM von Android) im Hintergrund vor dem Upload. Geht auf iOS 16.4+, Chrome, Edge, Safari; wo WebCodecs fehlt, bleibt das Original.
- `login.jpg` ist das Bild rechts auf der Login-Seite (austauschbar, ca. 1600 px breit).

