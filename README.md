# GIRI Go

Leichtgewichtige Web-App für Video-/Foto-Arbeitsanleitungen: aufnehmen (3–5 s pro Schritt), annotieren, freigeben, per Link/QR ausführen, als SOP-PDF exportieren.

## v0.21 – Feedback-Runde
- **Papierkorb:** Gelöschte Anleitungen landen 30 Tage im Papierkorb (Dashboard → Papierkorb): wiederherstellen oder endgültig löschen; öffentliche Links gelöschter Anleitungen sind sofort tot. Gelöschte **Schritte** liegen unten in der Schrittliste unter „Papierkorb“ (Medien bleiben erhalten) – zurückholen oder endgültig löschen. Backend: Spalte `deleted_at`, angepasste Policy und `open_instr` (bereits im Projekt), `purge_trash()` als Reserve.
- **Login-Link auf dem Handy:** Nach dem Klick auf den Link geht es sofort weiter – kein Tippen mehr nötig.
- **Auf anderem Gerät geändert:** Die geöffnete Anleitung aktualisiert sich automatisch, wenn gerade nichts getippt wird; sonst blauer Banner mit „Aktualisieren“. Beim Zurückkehren in den Tab wird zusätzlich geprüft, ob die Anleitung woanders weiterbearbeitet wurde (Websockets sterben in Hintergrund-Tabs). Projektseiten, Statistik und Papierkorb aktualisieren sich ebenfalls.
- **Editor:** Kopfzeile der Schrittliste ohne Importieren/Kapitel – beides sitzt in der Karte „Schritt hinzufügen“ (Aufnehmen · Bilder/Videos wählen · Kapitel). Der markierte Schritt hat ein Papierkorb-Symbol direkt in der Zeile. Das Kapitel des markierten Schritts ist immer aufgeklappt (z. B. nach der Aufnahme).
- **Aufnahme:** nur noch ein Ausgang (grüner Haken), kein Import-Knopf mehr; im „Schritt N ersetzen“-Balken gibt es Löschen.
- **Feedback:** Auf dem PC nur „Foto / Video wählen“; Aufnehmen-Knöpfe erscheinen nur auf Geräten mit Kamera-Aufruf.
- **Logo:** Endseite der Anleitung mit großem Logo ohne Rahmen (heller Schein auf dunklem Hintergrund), Startkarte und Kopfzeile etwas größer; PDF: Logo größer auf dem Deckblatt und klein in jeder Kopfzeile.
- Versionsnummer auch auf dem Handy in der Kopfzeile.

## Entwicklung & Release (ab v0.20)
- Der Code ist in **ES-Module** aufgeteilt (`src/`, siehe `src/README.md`) und wird mit **Vite** zu einer statischen Seite gebaut: `index.html` + `assets/` im Repo-Root. Diese beiden sind **generiert** – nicht von Hand ändern; Änderungen in `app/index.html` bzw. `src/`.
- Lokal: `npm install` → `npm run dev` (Live-Server) → `npm run build` (schreibt `index.html` + `assets/`) → `npm test` (Playwright-Suite gegen den gebauten Stand, Supabase gemockt; braucht ein installiertes Chromium, Pfad über `GG_CHROME=`).
- **Version hochzählen:** nur in `app/index.html` (`window.APP_VERSION = '…'`) – die App zeigt sie an und die Auto-Update-Prüfung vergleicht genau diese Zeile.
- **Release:** `npm run build`, dann alles außer `node_modules/` und `index3.html` ins Repo-Root laden (GitHub Pages liefert `index.html` + `assets/` aus). Alte Dateien in `assets/` dürfen liegen bleiben.
- Rückweg: jede ältere Version (z. B. das v0.19-ZIP) kann jederzeit wieder ins Root geladen werden – Datenbank und Speicher sind vom Code unabhängig.

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
3. Für den Team-Einsatz nötig: **Authentication → Emails → SMTP Settings** eigenen Mailserver eintragen (aktuell Resend: Host `smtp.resend.com`, Port 465, User `resend`, Passwort = Resend-API-Key, Absender `giri-go@ar-giri.de`, „Minimum interval per user“ 60). Der eingebaute Mailversand ist auf wenige Mails pro Stunde begrenzt.
   - Damit die Mails schnell ankommen: In Resend die Domain `ar-giri.de` verifizieren (DNS: SPF, DKIM, DMARC – Status „Verified“). Ohne Verifizierung landen die Mails verzögert oder im Spam.
   - **Neue Nutzer bekommen die Mail „Confirm your email address“** (Supabase-Vorlage „Confirm sign up“, englisch, ohne Code), solange „Confirm email“ aktiv ist. Entweder in Authentication → Providers → Email „Confirm email“ **ausschalten** (dann bekommt jeder die GIRI-Vorlage mit Code) oder unter Authentication → Emails → Templates → „Confirm sign up“ den Inhalt von `supabase/email-magic-link.html` mit Betreff „GIRI Go: Dein Login-Link“ eintragen.
   - Fehler „Error sending magic link email“ beim Login = Supabase kommt nicht bei Resend rein. Ursache in den Supabase-Logs (Authentication → Logs): `535 Authentication credentials invalid` heißt Passwort/Username stimmen nicht exakt (Key ohne Leerzeichen einfügen, Username genau `resend`). Absenderadresse muss auf der verifizierten Domain liegen.
   - Diagnose bei Verzögerung: Resend → Emails zeigt pro Mail „sent“ → „delivered“ mit Zeitstempel. Meldet Resend sofort „delivered“, hängt die Mail im empfangenden Postfach (Google Workspace: Admin-Konsole → E-Mail-Protokollsuche).
   - Supabase → Authentication → Rate Limits: „Rate limit for sending emails“ bei eigenem SMTP z. B. auf 100/Stunde setzen.
   - Wer sich per Google/Microsoft anmeldet, braucht die Mail gar nicht (2b/2c).

### 2b. Google-Login (ab v0.14)
1. Google Cloud Console → APIs & Dienste → Anmeldedaten → **OAuth-Client-ID** (Webanwendung). Autorisierte Weiterleitungs-URI: `https://goorpzgcxhtjbaothluv.supabase.co/auth/v1/callback`. OAuth-Zustimmungsseite: „Extern“ + **In Produktion** (für die Scopes E-Mail/Profil ist keine Google-Prüfung nötig); solange sie auf „Testing“ steht, können sich nur eingetragene Testnutzer anmelden.
2. Supabase → **Authentication → Sign In / Providers → Google** → Enabled, Client-ID + Client-Secret eintragen → Save.
3. Fertig – der Button „Mit Google anmelden“ erscheint auf der Login-Seite automatisch, sobald der Provider aktiv ist (die App fragt `/auth/v1/settings` ab). Name kommt aus dem Google-Profil.

### 2c. Microsoft-Login (ab v0.15.1, für Kunden mit Microsoft 365)
1. Azure-Portal / Entra Admin Center → App-Registrierungen → **Neue Registrierung**: Name „GIRI Go“, unterstützte Kontotypen „Konten in einem beliebigen Organisationsverzeichnis und persönliche Microsoft-Konten“, Redirect-URI (Web): `https://goorpzgcxhtjbaothluv.supabase.co/auth/v1/callback`.
2. Zertifikate & Geheimnisse → **Neuer geheimer Clientschlüssel** (Wert kopieren, wird nur einmal angezeigt). API-Berechtigungen: `email`, `openid`, `profile`, `User.Read` (Standard).
3. Supabase → **Authentication → Providers → Azure** → Enabled, Anwendungs-ID (Client) + Secret, Azure Tenant URL `https://login.microsoftonline.com/common` → Save. Button „Mit Microsoft anmelden“ erscheint automatisch.

### 2d. Workspace-Zuordnung bei SSO
- Firmen-Adresse (z. B. `@kunde.de`) → Workspace = Domain, wie beim Magic Link.
- Öffentliche Anbieter (gmail.com, outlook.com, gmx, web.de, icloud …) → persönlicher Workspace pro Adresse, damit fremde Gmail-Nutzer nie im selben Workspace landen.

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
- **Link-Passwort (ab v0.14):** Pro Projekt (Projektseite → „Passwort“) und/oder pro Team (Admin-Panel → Team → „Passwort“). Gesetzt = wer den öffentlichen Link öffnet, muss das Passwort einmal pro Gerät eingeben (Projekt-Passwort oder Passwort eines zugeordneten Teams). Standard: aus. Gespeichert wird nur ein Salted-SHA-256-Hash; geschützte Anleitungen sind für Anonyme auch per API nicht lesbar (`open_instr`-RPC prüft serverseitig). Hinweis: Die Medien-Dateien selbst liegen im öffentlichen Storage-Bucket und sind bei Kenntnis der Datei-URL weiterhin abrufbar.
- Ab v0.13 lassen sich auch einzelne Anleitungen Teams zuordnen (Editor → „Freigabe & Einstellungen“ → „Zugriff (Teams)“ oder Admin-Panel → „Zugriff (Teams)“). Die Team-Zuordnung der Anleitung gilt zusätzlich zu den Teams des Projekts; nichts angehakt = wie das Projekt.

## QR-Poster pro Projekt (v0.19)
- Projektseite → „QR-Poster“ (auch im „…“-Menü neben Umbenennen / Link-Passwort / Löschen): ein DIN-A4-PDF mit Kopfzeile in der Akzentfarbe (Logo, Firma, Projektname) und pro Anleitung einer Kachel: erstes Bild, Titel, großer QR-Code, Schritte/Version. Bis 4 Anleitungen groß in 2 Spalten, ab 5 in 3 Spalten, weitere Seiten automatisch.
- Optionen: nur veröffentlichte Anleitungen (Standard), mit/ohne Bild, mit/ohne Firma/Logo. Entwürfe und Anleitungen in Prüfung werden – falls mitgedruckt – als solche markiert (ihre Links funktionieren erst nach Veröffentlichung).
- Menü „…“ auf der Projektseite ersetzt die einzelnen Knöpfe für Passwort und Löschen.

## Werker-Feedback (v0.18)
- v0.18.1: Im Feedback-Dialog drei Wege für Medien – **Foto aufnehmen**, **Video aufnehmen**, **Aus Mediathek** (Bild oder Video importieren). Der separate „Anmerkung“-Knopf pro Schritt ist weg – ein Mechanismus pro Schritt (Feedback); Notiz + Foto gibt es weiterhin bei „Nicht OK“ im Job-Done-Protokoll.
- v0.18.1 Editor: Link/QR · PDF · Statistik stehen rechts neben den Reitern „Schritte / Freigabe & Einstellungen“; Reihenfolge in den Einstellungen: Checkliste → Modus → Feedback erlauben; „Zugriff (Teams)“ ist eingeklappt; bei den Übersetzungen steht, dass „PDF“ neben der Sprache das PDF in dieser Sprache lädt. Ein PDF in einer anderen Sprache schaltet die Oberfläche nicht mehr um.
- In jeder veröffentlichten Anleitung steht unter jedem Schritt und am Ende ein Feedback-Knopf (Sprechblase). Der Werker wählt **Anleitung verbessern** oder **Prozess verbessern**, schreibt einen Hinweis, hängt optional ein **Foto oder Video** an (Handy-Kamera) und schickt ab – ohne Login.
- Der Creator sieht offene Rückmeldungen als blaue Sprechblasen-Zahl auf der Anleitungs-Karte, als Banner im Editor und in der Statistik unter dem Reiter **Feedback** (mit Bild/Video-Vorschau).
- **Als Schritt übernehmen:** Foto oder Video aus dem Feedback wird direkt als neuer Schritt hinter dem Schritt eingefügt, auf den sich das Feedback bezieht (Text des Werkers als Beschreibung). Danach ist das Feedback automatisch „erledigt“. Ohne Medium: „Zum Schritt“ springt in den Editor. Außerdem „Erledigt“ / „Verwerfen“.
- Abschaltbar pro Anleitung: Freigabe & Einstellungen → „Feedback von Werkern erlauben“ (Standard: an).
- Backend: Tabelle `feedback` (Schema in `supabase/schema.sql`, bereits im Projekt angelegt), Medien im Bucket `media` unter `runs/fb/…` (gleiche Regel wie Beweisfotos).

## 3D-Symbole, Animation, Schritte importieren (v0.17)
- v0.18: Pfeile nochmals dünner (auch gedreht), Neigen/Drehen bis ±70°, „Hüpfen“ beim Pfeil zieht sich vom Ziel zurück und schnellt wieder auf den Punkt – die Spitze landet immer dort, wo sie gesetzt wurde.
- Symbole sind schlanker (dünnere Pfeile, Ringe, Rahmen, weniger Tiefe) – wirken filigraner, bleiben aber gut lesbar.
- **3D:** Symbol antippen → unter dem Chip erscheinen die Regler **Neigen** (kippt nach vorn/hinten) und **Drehen** (dreht nach links/rechts, ±60°). Der Pfeil dreht sich um seine Spitze, alles andere um die Mitte; die Seitenwand folgt der echten Perspektive. „Flach“ setzt zurück. Gilt für Pfeil, Kreis, Rechteck, Text, Warnschilder und eigene Symbole; Nummern/Häkchen/Kreuz (Kugeln) und Emojis bleiben rund.
- **Animation** pro Symbol: Keine · Pulsieren (atmet) · Hüpfen (zwei kurze Hüpfer Richtung Ziel, dann Pause) · Blinken (zweimal, dann Pause). Läuft im Editor und in der Anleitung (auch wenn das Video für die Symbole anhält); im PDF steht das Symbol still.
- **Schritt hinzufügen:** Am Ende der Schrittliste steht eine Karte mit „Aufnehmen“ und „Bilder / Videos wählen“ (Handy: Fotomediathek, mehrere auf einmal). Jede Datei wird ein Schritt, angehängt am Ende. Am PC weiterhin: Dateien auf die Seite ziehen (Einfügen nach dem markierten Schritt).
- Gespeichert wird pro Symbol `tx`/`ty` (Grad) und `anim` – ältere Anleitungen bleiben unverändert (flach, ohne Animation).

## Design & Bedienung (v0.16)
- Dashboard: Kennzahlen als ruhige Zeile statt vier Kacheln; Projekte als Cover-Karten (Bilder der Anleitungen, Name und Anzahl im Bild, Schloss bei Link-Passwort); Anleitungs-Karten mit drei klaren Aktionen (Bearbeiten · Nächsten Schritt aufnehmen · Link/QR) und „…“-Menü für Vorschau, PDF, Statistik, Verschieben, Löschen. Klick auf die Karte öffnet die Anleitung.
- Kopfzeile: Avatar mit Initialen statt Name+Rolle; Profil-Sheet zeigt Name, E-Mail, Rolle, Version. Abmelden liegt im Profil.
- Aufnahme: Zeit und Bewertung („Perfekt“ · „Wird lang …“ · „Zu lang“) stehen als Pille **über** dem Auslöser, nicht mehr darunter – bleibt beim Halten lesbar.
- Editor: unscharfer Bildhintergrund hinter Querformat-Medien wie im Viewer; Kapitelnamen in der Liste mit Auslassungspunkten.
- Kleinigkeiten: Escape schließt jeden Dialog, Seiten blenden weich ein, Ein-/Mehrzahl bei „1 Schritt“/„2 Schritte“, Kapitel-Kacheln mit Fortschrittsbalken sobald eine Checkliste aktiv ist.

## Design & Bedienung (v0.15)
- Komplett überarbeitetes Stylesheet (ein Designsystem statt gewachsener Schichten): ruhigere Flächen, Hairline-Karten, 12-px-Radien, konsistente Buttons (Mint = die eine „Los“-Aktion, Blau = Primäraktion, Weiß = sekundär), lesbare Kontraste im Viewer, unscharfer Bildhintergrund statt schwarzer Balken bei Querformat-Medien auf dem Handy.
- Editor: Werkzeuge als gruppierter Block (Markieren · Status · Sicherheit · Bilder), nie mehr seitlich scrollen; Formatleisten stehen unter den Textfeldern; Titel des Schritts und Anleitung in voller Breite.
- Symbole in Pseudo-3D: Pfeile und Rahmen als Blöcke mit Tiefe, Nummern/Häkchen/Kreuze als glänzende Kugeln, Warnschilder mit Kante – in Bild, Video, Viewer und PDF identisch.
- Login: nach „Loslegen“ ein Warte-Screen mit Code-Eingabe und Countdown für „Erneut senden“ (90 s) – ein neuer Link macht den alten ungültig, deshalb wird nicht mehr sofort nachgefordert. Google-Login erscheint automatisch, sobald der Provider in Supabase aktiv ist.

## Titel formatieren (ab v0.14)
- Schritt-Titel haben eine Mini-Leiste: **B** (fett), 🔗 (Link), 🔒 (nicht übersetzen). `==M6==`, `**fett**` und Links funktionieren in Schritt-, Kapitel- und Anleitungstiteln (Viewer, Listen, PDF als Klartext).

## Video-Symbole (ab v0.14)
- Jedes Symbol gehört zu genau einem Zeitpunkt (grüne Marke auf der Zeitleiste, weiß = ausgewählt). Im Editor ist es nur sichtbar, wenn der Abspielkopf ±0,3 s daneben steht; wer den Abspielkopf wegzieht, sieht es nicht mehr – so wie später der Werker (Video hält dort 1 s).

## Übersetzungen
- Ein Link für alle Sprachen: Der Werker wählt oben in der Anleitung die Sprache (Flagge). Die Übersetzung läuft live über die Edge Function `translate` (DeepL, Key im Vault) und wird in der Anleitung zwischengespeichert.
- Text zwischen `==` und `==` wird nicht übersetzt (z. B. `==M6==`). `**fett**`, Listen (`- ` / `1. `) und Links `[Text](https://…)` bleiben erhalten.
- Die App-Oberfläche selbst gibt es in Deutsch und Englisch; jede weitere Sprache (FR, ES, IT, NL, PL, CS, TR, PT, RO, HU) wird beim ersten Wechsel einmal per DeepL übersetzt, serverseitig in `ui_tx` zwischengespeichert und auf dem Gerät gemerkt (Sprachmenü oben rechts, im Viewer über die Flagge).

## PDF in jeder Sprache
- PDF-Button → Sprachauswahl mit allen 13 Sprachen (inkl. Chinesisch). Fehlende Übersetzungen werden vorher per DeepL erstellt und in der Anleitung gespeichert.
- Aufbau (ab v0.13): Deckblatt (Titel, Dokumentenlenkung, Kapitelverzeichnis mit Seitenzahlen, Historie), jedes Kapitel auf einer neuen Seite, pro bestätigungspflichtigem Schritt ein Kästchen „Bestätigt“, Unterschrift nur einmal ganz am Ende, GIRI-Go-Logo oben rechts und Dokument-Nr./Seite unten auf jeder Seite, Schrift Montserrat.
- Schriften liegen im Repo unter `fonts/` (Montserrat für alle europäischen Sprachen, Noto Sans SC für Chinesisch) und werden beim ersten Export geladen.

## Checkliste
- Modus je Anleitung (Einstellungen): **Jeder Schritt**, **Nur pro Kapitel** (eine Bestätigung am Ende jedes Kapitels) oder **Nur markierte Schritte** (im Schritt „Bestätigung nötig“ ankreuzen). Zähler, Job-Done-Protokoll, Auto-Abschluss und PDF-Kästchen richten sich nach den bestätigungspflichtigen Schritten.
- Jeder Schritt hat neben „Erledigt / Nicht OK“ einen Notiz-Button: Anmerkung und Foto sind bei jedem Schritt möglich, nicht nur bei „Nicht OK“.
- Sprache lässt sich schon auf dem Start-Screen („Bereit?“) über die Flagge wählen.
- Sind alle Schritte bestätigt, wird die Durchführung beim Verlassen automatisch abgeschlossen; beim Wiedereinstieg mit allem bestätigt bietet die App direkt „Abschließen“ an.

## Kapitelübersicht & Kapitel-Links (ab v0.13)
- Hat eine Anleitung mehr als ein Kapitel, startet der Viewer mit einer Kapitelübersicht (Kacheln mit Vorschaubild, Schrittzahl, Fortschritt). Ein Kapitel → direkt in die Anleitung.
- Kapitel sind direkt verlinkbar: `…#/v/<id>/1`, `…#/v/<id>/2` usw. (auch mit Sprache: `…#/v/<id>/2/en`). Beim Scrollen aktualisiert sich die URL auf das aktuelle Kapitel; die Übersicht ist über den Titel oben oder das Menü jederzeit erreichbar.

## Eigene Symbole (ab v0.13)
- Editor → Werkzeug „Eigene“ → „Hochladen“: PNG (mit Transparenz), JPG, WebP oder SVG. Bilder werden im Browser auf 512 px verkleinert, als PNG nach `media/<workspace>/symbols/` geladen und in `workspaces.symbols` für den ganzen Workspace gespeichert (Mehrfachauswahl möglich, Löschen über das × in der Bibliothek).
- Darstellung je Symbol umschaltbar (Chip unter dem Bild): **Leuchten** (weißer Rand + farbiges Leuchten, ideal für transparente PNGs) oder **Sticker** (weiße Karte mit farbigem Rahmen, ideal für Fotos). Farbe über die Farbfelder, Größe/Drehung wie bei allen Symbolen. Gilt in Bild, Video, Viewer und PDF.

## Fotos & Videos importieren
- Editor: „Importieren“ im Schritte-Panel (Handy: Fotomediathek, Mehrfachauswahl) oder Dateien einfach auf die Seite ziehen (PC). Aufnahme-Screen: Import-Symbol oben rechts.
- Jede Datei wird ein eigener Schritt, eingefügt nach dem markierten Schritt, in Aufnahmereihenfolge (Datei-Datum). Fotos werden auf 1600 px verkleinert (JPEG), Videos unverändert übernommen (max. 80 MB, Anfangs-Trim 15 s).
- iPhone-Videos im HEVC-Format laufen nur in Safari. Für die Bearbeitung am PC in den iPhone-Einstellungen unter Kamera → Formate „Maximale Kompatibilität“ wählen.

## Als App installieren (PWA)
- Android/Chrome/Edge: Beim ersten Öffnen erscheint „Als App installieren“ (auch im Profil-Menü). iPhone/iPad: Safari → Teilen → „Zum Home-Bildschirm“.
- Dateien im Repo: `manifest.webmanifest`, `sw.js` (Service Worker: App-Shell offline, Bibliotheken gecacht, Daten immer live), `icons/`.
- Neue Version: einfach alle Dateien aus dem Release-Ordner hochladen (überschreiben). `sw.js` muss nicht angepasst werden – die App holt `index.html` immer frisch (HTTP-Cache wird umgangen).
- Ab v0.14 aktualisiert sich die installierte App selbst: Bei jedem Wechsel in die App (und alle 30 min) wird die Version geprüft; auf Startseite/Projekt/Admin/Statistik/Login und im Viewer vor dem Start wird sofort neu geladen, mitten in Editor, Aufnahme oder Checkliste erscheint der blaue Hinweis „Neue Version“ und der Reload passiert beim nächsten Wechsel zur Startseite.
- Login in der installierten App: Wird der Magic Link im Browser geöffnet (Android/Desktop teilen den Speicher mit der App), übernimmt die App die Anmeldung beim nächsten Öffnen automatisch. Auf dem iPhone sind Safari und Home-Bildschirm-App getrennt – dort den Code aus der Mail eingeben (wird bei 6 Ziffern automatisch geprüft).
- Login in der installierten App: Der Magic Link öffnet sich im Browser, nicht in der App. Deshalb gibt es im Login ein Code-Feld. Die Vorlage für die Login-Mail liegt in `supabase/email-magic-link.html` (Supabase → Authentication → Email Templates → Magic Link, Body komplett ersetzen).

## HubSpot-Sync (ab v0.14)
- Kontakt-Eigenschaften in HubSpot: `GIRIGO-ID` (Benutzer-ID), `GIRIGO-LastInstructionCreated` (Datum der neuesten Anleitung), `GIRIGO-NumberOfInstructionViews` (Aufrufe aller Anleitungen dieses Benutzers). Abgleich per E-Mail: existiert der Kontakt, werden nur diese drei Felder aktualisiert; sonst wird ein Kontakt (E-Mail, Vor-/Nachname) angelegt.
- Läuft fast in Echtzeit: Datenbank-Trigger (neues Profil, neue Anleitung, neuer Aufruf) → `pg_net` → Edge Function `hubspot-sync` → HubSpot. Die Funktion berechnet die Werte immer frisch aus der Datenbank.
- Setup: HubSpot → Private App mit Scopes `crm.objects.contacts.read/write` → Token als Vault-Secret `hubspot_token` (Supabase → Integrations → Vault). Kompletter Neuabgleich aller Benutzer: `POST …/functions/v1/hubspot-sync` mit Header `x-giri-secret` (Vault `hs_sync_secret`) und Body `{"all":true}`.
- Kontakt vorhanden (Suche per E-Mail) → nur die drei Felder werden gesetzt; nicht vorhanden → Kontakt wird angelegt. Legt HubSpot ihn in derselben Sekunde selbst an (409), wird der bestehende Kontakt aktualisiert – keine Duplikate.

## Video-Konvertierung
- Jeder Clip wird im Browser (WebCodecs) zu H.264-MP4 mit max. 1280 px und ~2 Mbit/s konvertiert: Importe sofort beim Import, Aufnahmen (z. B. WebM von Android) im Hintergrund vor dem Upload. Geht auf iOS 16.4+, Chrome, Edge, Safari; wo WebCodecs fehlt, bleibt das Original.
- `login.jpg` ist das Bild rechts auf der Login-Seite (austauschbar, ca. 1600 px breit).

