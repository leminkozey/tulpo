# Roadmap — Von Null zum Launch und darüber hinaus

Übersicht: [[00 - Projektübersicht]] | Features: [[08 - Unser Feature-Scope]] | Plan: [[09 - Der große Plan]]

---

## Stage 0 — Fundament
> "Bevor du ein Haus baust, gieß das Fundament."

### Ziel
Projekt existiert, Architecture steht, ein User kann sich einloggen.

### Tasks
- [ ] Name + Domain sichern
- [ ] Git Repo + Monorepo-Struktur aufsetzen
- [ ] Bun Backend scaffolden (Hono/Elysia)
- [ ] Frontend scaffolden (SvelteKit oder Solid)
- [ ] Datenbank-Schema designen
  - Users, Sessions
  - Servers (Guilds), Members
  - Channels, Categories
  - Messages, Attachments
  - Roles, Permissions
  - Invites
  - Friends, DMs
- [ ] Auth System (Register, Login, Logout, Sessions)
- [ ] WebSocket-Layer aufsetzen (Connection Pool, Auth, Heartbeat)
- [ ] Docker Setup (Single Container: Backend + Frontend)
- [ ] Basic CI (Lint, Typecheck, Build)
- [ ] Design System Grundlage (Farben, Typography, Spacing, Components)

### Ergebnis
```
User öffnet App → Registrierung → Login → Leerer Homescreen → WebSocket connected
```

### Abhängigkeiten
Keine — das ist der Start.

### Risiken
- Falscher Tech Stack führt zu Rewrites → Deshalb jetzt gut entscheiden, siehe [[09 - Der große Plan#Tech Stack Vorschlag]]
- Overengineering beim Schema → YAGNI. Nur was Phase 1 braucht.

---

## Stage 1 — Chat
> "Zwei Leute können sich Nachrichten schicken. Das ist das Produkt."

### Ziel
Funktionierender Echtzeit-Chat mit Servern, Channels, und DMs.

### Tasks

#### Server & Channels
- [ ] Server erstellen (Name, Icon)
- [ ] Server beitreten / verlassen
- [ ] Kategorien erstellen, sortieren, auf-/zuklappen
- [ ] Text Channels erstellen (Name, Topic, Beschreibung)
- [ ] Channel Sortierung (Drag & Drop)
- [ ] Server Settings Page

#### Messaging Core
- [ ] Nachrichten senden + empfangen (Echtzeit via WebSocket)
- [ ] Markdown Rendering (bold, italic, code, codeblock, lists, headers, links)
- [ ] Nachricht bearbeiten
- [ ] Nachricht löschen
- [ ] Reply / Quote
- [ ] Emoji Reactions
- [ ] Mentions (@user, @role, @everyone)
- [ ] Typing Indicator ("User tippt...")
- [ ] Unread Indicators (Channel-Level)
- [ ] Message History laden (Pagination / Infinite Scroll)
- [ ] Pins

#### File Sharing
- [ ] File Upload (Drag & Drop + Button)
- [ ] Inline Preview (Bilder, Videos, Audio)
- [ ] Kein künstliches Size-Limit (Server-Storage = Limit)
- [ ] Download Button

#### Invites
- [ ] Invite Link generieren
- [ ] Ablaufdatum + Max Uses konfigurierbar
- [ ] Join via Invite Link

#### DMs
- [ ] 1:1 Direct Messages
- [ ] Group DMs (bis 10 Personen)
- [ ] DM-Liste in Sidebar

#### User Profiles
- [ ] Avatar Upload
- [ ] Display Name + Username
- [ ] Status (Text)
- [ ] Bio / About Me
- [ ] Online / Offline / Idle / DND Presence
- [ ] Friend Requests (senden, annehmen, ablehnen)
- [ ] User Profile Popup

#### UI
- [ ] Server-Liste (links, vertikal, Icons)
- [ ] Channel-Sidebar (Kategorien + Channels)
- [ ] Message Area (Hauptbereich)
- [ ] Member List (rechts, collapsible)
- [ ] User Info Bar (unten links: Avatar, Name, Settings)
- [ ] Settings Pages (User, Server, Channel)
- [ ] Responsive Breakpoints (Desktop, Tablet, Mobile)

### Ergebnis
```
User erstellt Server → Lädt Freunde ein → Channels anlegen → Echtzeit-Chat mit Markdown, Files, Reactions → DMs funktionieren
```

### Abhängigkeiten
- [[#Stage 0 — Fundament]] muss fertig sein

### Meilenstein
**Hier entscheidet sich ob das Projekt fliegt.** Wenn der Chat sich gut anfühlt — schnell, schön, responsive — dann ist das Fundament für alles Weitere gelegt. Wenn nicht, hier fixen bevor weiter gebaut wird.

---

## Stage 2 — Rollen, Permissions & Moderation
> "Ohne Rechte-System ist es ein Gruppenchat, kein Server."

### Ziel
Server-Admins können ihren Server verwalten, moderieren, und Rechte vergeben.

### Tasks

#### Rollen
- [ ] Rollen erstellen, bearbeiten, löschen
- [ ] Rollennamen + Farbe
- [ ] Rollen-Hierarchie (Drag & Drop Sortierung)
- [ ] Rollen an User zuweisen / entziehen
- [ ] @everyone als Default-Rolle
- [ ] Rollen in Memberliste gruppieren (Hoist)

#### Permissions
- [ ] Server-weite Permissions pro Rolle
  - Administrator
  - Manage Server / Channels / Roles
  - Kick Members / Ban Members
  - Send Messages / Embed Links / Attach Files
  - Add Reactions
  - Manage Messages (löschen von anderen)
  - Mention Everyone
  - Connect (Voice) / Speak / Video / Stream
- [ ] Channel-spezifische Permission Overwrites
- [ ] Kategorie-Permissions (vererben an Channels)
- [ ] Permission Calculator (UI zeigt effektive Permissions)

#### Moderation
- [ ] Kick (mit Grund)
- [ ] Ban (mit Grund, optional: Delete Message History)
- [ ] Timeout / Mute (temporär, Dauer wählbar)
- [ ] Audit Log (wer hat was wann getan)
- [ ] Message Bulk Delete (Mod-Feature)
- [ ] Slowmode pro Channel
- [ ] Auto-Mod Basics (Keyword Filter, Spam Detection)

### Ergebnis
```
Admin erstellt Rollen (Admin, Mod, Member) → Weist Permissions zu → Mod kann kicken/bannen → Channels haben individuelle Rechte → Audit Log zeigt alle Aktionen
```

### Abhängigkeiten
- [[#Stage 1 — Chat]] muss fertig sein

---

## Stage 3 — Voice
> "Der Grund warum Discord TeamSpeak getötet hat."

### Ziel
Drop-In Voice Channels die sich wie Discord anfühlen — oder besser.

### Tasks

#### WebRTC Setup
- [ ] STUN/TURN Server konfigurieren (Coturn)
- [ ] SFU aufsetzen (Mediasoup oder Pion)
- [ ] Signaling über bestehende WebSocket-Verbindung

#### Voice Channels
- [ ] Voice Channel erstellen (in Kategorien)
- [ ] Drop-In / Drop-Out (Join/Leave Button)
- [ ] Kein "Anruf starten" — Channel ist immer offen
- [ ] User Limit pro Channel (optional)
- [ ] Bitrate konfigurierbar

#### Voice Features
- [ ] Per-User Volume Slider → [[03 - Feature-Anforderungen aus der Community|Explizit gewünscht]]
- [ ] Push-to-Talk (konfigurierbarer Hotkey)
- [ ] Voice Activity Detection (Threshold einstellbar)
- [ ] Noise Suppression (RNNoise)
- [ ] Echo Cancellation
- [ ] Server Mute / Server Deafen (Mod-Feature)
- [ ] Self Mute / Self Deafen

#### UI
- [ ] Voice Channel zeigt verbundene User
- [ ] Voice-Status-Bar (unten: Connected to..., Mute/Deafen Buttons)
- [ ] Speaking Indicator (grüner Ring um Avatar)
- [ ] Voice Channel Info Panel
- [ ] Disconnect Button

### Ergebnis
```
User klickt auf Voice Channel → Sofort verbunden → Sieht wer drin ist → Kann Volume pro Person regeln → Push-to-Talk oder Voice Activity → Noise Suppression → Einfach rausgehen
```

### Abhängigkeiten
- [[#Stage 2 — Rollen Permissions & Moderation]] für Voice-Permissions (Connect, Speak, Mute Others)

### Risiken
- WebRTC ist komplex → Mediasoup/Pion als bewährte Libraries nutzen
- NAT Traversal Probleme → TURN Server als Fallback
- Latenz → SFU statt Peer-to-Peer für Gruppen >4 User

---

## Stage 4 — Screensharing & Video
> "Zeig mir was du siehst."

### Ziel
Screensharing und optional Video in Voice Channels.

### Tasks

#### Screensharing
- [ ] Screen/Window Picker (getDisplayMedia API)
- [ ] Screen Share starten/stoppen in Voice Channels
- [ ] Audio-Sharing beim Screenshare (getDisplayMedia mit Audio)
- [ ] Stream-Viewer UI (großes Bild, kleine Avatare)
- [ ] Qualitäts-Settings (Auflösung, Framerate)
- [ ] KEIN künstliches Quality-Gate (kein Nitro-Equivalent)
- [ ] Zoom & Pan im Stream Viewer
- [ ] Multi-Stream Support (mehrere Leute sharen gleichzeitig)

#### Video Calls
- [ ] Webcam aktivieren in Voice Channels
- [ ] Webcam in DMs
- [ ] Grid View für mehrere Webcams
- [ ] Kamera Auswahl

### Ergebnis
```
User ist im Voice Channel → Klickt "Share Screen" → Wählt Fenster/Screen → Alle im Channel sehen den Stream in voller Qualität → Audio kommt mit durch
```

### Abhängigkeiten
- [[#Stage 3 — Voice]] muss fertig sein (gleiche WebRTC Infrastruktur)

---

## Stage 5 — Mobile & PWA
> "Wenn es nicht auf dem Handy geht, existiert es nicht."

### Ziel
Die App funktioniert vollständig auf Smartphones — ohne App Store.

### Tasks

#### PWA
- [ ] Web App Manifest (Name, Icons, Theme Color)
- [ ] Service Worker (Offline-Fähigkeit, Caching)
- [ ] "Add to Homescreen" Prompt
- [ ] Splash Screen

#### Push Notifications
- [ ] Web Push API (VAPID Keys)
- [ ] Notification-Einstellungen pro Server / Channel
- [ ] Push Relay Service (für Self-Hoster)
- [ ] Badge Count auf App Icon

#### Mobile UI
- [ ] Touch-optimierte Navigation (Swipe für Sidebars)
- [ ] Mobile-spezifisches Layout (Server-Liste → Channel-Liste → Chat)
- [ ] Bottom Navigation Bar
- [ ] Compact Message Layout
- [ ] Mobile Voice Controls
- [ ] Mobile-optimierter File Upload (Kamera, Galerie)

#### Performance
- [ ] Lazy Loading für Message History
- [ ] Image Thumbnails (statt Full-Size auf Mobile)
- [ ] Reduzierter WebSocket Traffic auf Mobile
- [ ] Battery-schonender Voice Mode

### Ergebnis
```
User öffnet PWA auf dem Handy → Vollständige Chat-Experience → Push Notifications bei neuen Nachrichten → Voice funktioniert → Screenshare ansehen (nicht starten) → Fühlt sich wie native App an
```

### Abhängigkeiten
- [[#Stage 4 — Screensharing & Video]] sollte fertig sein (aber Mobile kann parallel zu Stage 4 starten, UI ist unabhängig)

### Risiken
- iOS PWA Limitations (kein Push bis iOS 16.4+, kein Background Audio)
- Push Notifications auf Self-Hosted sind technisch tricky → Eigener Relay Service als optionaler Managed Service, siehe [[04 - Marktanalyse & Timing#Monetarisierung]]

---

## Stage 6 — Die Differentiators
> "Warum WIR und nicht Discord oder Matrix."

### Ziel
Features bauen die Discord nicht hat oder schlecht macht. Das ist unser Moat.

### Tasks

#### Forum Channels → [[06 - Zitate & Stimmung|7527 + 2861 + 2664 Upvotes]]
- [ ] Neuer Channel-Typ: Forum
- [ ] Posts mit Titel + Body + Tags
- [ ] Post-Liste mit Sortierung (Newest, Most Active, Most Upvoted)
- [ ] Upvote/Downvote System
- [ ] Threaded Replies pro Post
- [ ] Optional: Public/SEO-indexierbar (Wissen nicht eingesperrt!)
- [ ] Post Guidelines / Regeln
- [ ] Pinned Posts
- [ ] Solved/Unsolved Markierung (für Support-Foren)

#### Voice Channel Chat → [[03 - Feature-Anforderungen aus der Community|Explizit gewünscht]]
- [ ] Chat der NUR für im Voice Channel verbundene User sichtbar ist
- [ ] Automatisch archiviert/verschwindet wenn Channel leer
- [ ] Shared Links/Files bleiben erhalten
- [ ] Separate Message History

#### File Browser
- [ ] Alle geteilten Files pro Channel/Server
- [ ] Grid + List View
- [ ] Filter: Typ, Datum, User
- [ ] Suche
- [ ] Preview (Bilder, PDFs, Code)
- [ ] Kein "scroll durch Monate an Chat-History um ein File zu finden"

#### Erweiterte Suche
- [ ] Volltext-Suche über alle Channels
- [ ] Filter: User, Channel, Datum, Has (File, Link, Embed)
- [ ] Search Highlighting
- [ ] Jump to Message
- [ ] Multi-Language Support (kein kaputtes Korean Search)
- [ ] Suchindex der tatsächlich schnell ist

#### Echtes Block/Ignore
- [ ] Geblockte Person ist KOMPLETT unsichtbar
- [ ] Keine "1 ignored message" Anzeige → [[01 - Warum Leute Discord verlassen|2165 Upvotes Complaint]]
- [ ] Kein Trace dass die Person existiert

### Ergebnis
```
Server hat Forum Channels → Durchsuchbar, sortierbar, votebar → Wissen geht nicht verloren
Voice Channel hat eigenen temporären Chat → Nur Leute im Call sehen ihn
Files sind organisiert findbar → File Browser zeigt alles auf einen Blick
Suche funktioniert tatsächlich
```

### Abhängigkeiten
- [[#Stage 3 — Voice]] für Voice Channel Chat
- [[#Stage 1 — Chat]] für alles andere

---

## Stage 7 — Bot API & Integrations
> "Das Ökosystem entscheidet ob die Plattform lebt oder stirbt."

### Ziel
Entwickler können Bots bauen und externe Services integrieren.

### Tasks

#### REST API
- [ ] Vollständige CRUD API für alle Ressourcen
- [ ] API Docs (OpenAPI/Swagger)
- [ ] Rate Limiting
- [ ] API Tokens / Bot Tokens

#### WebSocket Gateway (für Bots)
- [ ] Event-basiert (Message Create, Member Join, etc.)
- [ ] Intent System (Bot wählt welche Events er will)
- [ ] Heartbeat + Reconnect

#### Webhooks
- [ ] Incoming Webhooks (externe Services → Chat)
- [ ] Outgoing Webhooks (Chat Events → externe URL)
- [ ] Webhook Management UI

#### Bot Features
- [ ] Bot Accounts (kein User-Account nötig)
- [ ] Slash Commands
- [ ] Message Components (Buttons, Select Menus)
- [ ] Modals/Popups
- [ ] Bot Permissions (granular)

#### SDK
- [ ] JavaScript/TypeScript SDK (npm Package)
- [ ] Python SDK (pip Package)
- [ ] Beispiel-Bots (Moderation, Music, Utility)

### Ergebnis
```
Entwickler erstellt Bot → Registriert bei API → Reagiert auf Events → Slash Commands funktionieren → GitHub/Jira Webhooks posten in Channels
```

### Abhängigkeiten
- [[#Stage 2 — Rollen Permissions & Moderation]] für Bot Permissions
- [[#Stage 1 — Chat]] für Message Events

---

## Stage 8 — Polish, Security & Launch
> "Erste Eindrücke zählen. Besonders bei Open Source."

### Ziel
Production-Ready. Sicher. Dokumentiert. Launchbar.

### Tasks

#### Security
- [ ] Rate Limiting auf allen Endpoints
- [ ] Input Sanitization (XSS, SQL Injection)
- [ ] CSRF Protection
- [ ] Content Security Policy
- [ ] Optional E2EE für DMs
- [ ] Security Audit / Pen Testing
- [ ] Responsible Disclosure Policy

#### Performance
- [ ] Load Testing (wie viele gleichzeitige User?)
- [ ] Database Optimierung (Indexes, Query Tuning)
- [ ] WebSocket Connection Pooling
- [ ] CDN-Ready Static Assets
- [ ] Lazy Loading überall

#### Docker & Deployment
- [ ] Optimiertes Docker Image (multi-stage build, klein)
- [ ] Docker Compose für erweiterte Setups (mit Postgres, Redis)
- [ ] Automatische Datenbank-Migrations
- [ ] Health Check Endpoint
- [ ] Backup/Restore Script
- [ ] `docker run corvox/server` funktioniert out of the box

#### Dokumentation
- [ ] README mit One-Liner Setup
- [ ] Self-Hosting Guide (Docker, Bare Metal, Raspberry Pi)
- [ ] Configuration Reference
- [ ] API Documentation
- [ ] Contributing Guide
- [ ] Architecture Overview

#### Landing Page
- [ ] Produktwebsite mit Features, Screenshots, Demo
- [ ] Vergleichstabelle mit Discord/Matrix/TS
- [ ] One-Click Demo Server zum Testen
- [ ] GitHub Link prominent

#### Launch
- [ ] GitHub Repo public stellen
- [ ] r/selfhosted Post (KEIN AI-Slop! → [[04 - Marktanalyse & Timing#Risiken]])
- [ ] r/opensource Post
- [ ] Hacker News "Show HN" Post
- [ ] r/pcmasterrace (im richtigen Kontext)
- [ ] YouTube-Video (Demo + Setup)
- [ ] Product Hunt Launch
- [ ] Discord Server (ja, ironisch) für Community/Support

### Ergebnis
```
Jemand findet das Projekt → Liest README → docker run → Server läuft → Lädt Freunde ein → Es funktioniert → Starred auf GitHub → Erzählt es weiter
```

### Abhängigkeiten
- Alles vorher

---

## Stage 9 — Post-Launch & Growth
> "Launch ist nicht das Ende. Es ist der Anfang."

### Ziel
Community aufbauen, Feedback einarbeiten, Monetarisierung starten.

### Tasks

#### Community
- [ ] Issue Tracker pflegen
- [ ] PR Reviews
- [ ] Community Calls / AMAs
- [ ] Roadmap öffentlich machen
- [ ] Contributor Guide + "Good First Issues"

#### Managed Hosting
- [ ] SaaS-Infrastruktur aufsetzen
- [ ] Pricing Page ($5/10/15 Tiers)
- [ ] Onboarding Flow
- [ ] Billing (Stripe)
- [ ] Automated Provisioning (Server per Knopfdruck)
- [ ] Managed Push Notification Relay

#### Iteration
- [ ] User Feedback sammeln + priorisieren
- [ ] Performance Monitoring (Sentry, Uptime)
- [ ] A/B Testing für UX-Entscheidungen
- [ ] Regelmäßige Releases (Changelog, Versioning)

#### Zukünftige Features
- [ ] Federation (Server-zu-Server, optional)
- [ ] Stage Channels (Speaker/Audience)
- [ ] Scheduled Events + RSVP
- [ ] Threads innerhalb von Channels
- [ ] Custom Emoji / Sticker (free, nicht paywalled)
- [ ] Soundboard
- [ ] Activities / Embedded Apps
- [ ] Desktop App (Tauri statt Electron → leichtgewichtig)
- [ ] Native Mobile Apps (React Native oder Flutter, falls PWA nicht reicht)

---

## Timeline-Überblick

```
Stage 0  ██░░░░░░░░░░░░░░░░░░░░░░░░░░  Fundament
Stage 1  ░░██████░░░░░░░░░░░░░░░░░░░░  Chat
Stage 2  ░░░░░░████░░░░░░░░░░░░░░░░░░  Rollen & Moderation
Stage 3  ░░░░░░░░░░████░░░░░░░░░░░░░░  Voice
Stage 4  ░░░░░░░░░░░░░░██░░░░░░░░░░░░  Screenshare & Video
Stage 5  ░░░░░░░░░░░░░░░░██░░░░░░░░░░  Mobile & PWA
Stage 6  ░░░░░░░░░░░░░░░░░░████░░░░░░  Differentiators
Stage 7  ░░░░░░░░░░░░░░░░░░░░░░██░░░░  Bot API
Stage 8  ░░░░░░░░░░░░░░░░░░░░░░░░██░░  Polish & Launch
Stage 9  ░░░░░░░░░░░░░░░░░░░░░░░░░░██  Post-Launch
         ─────────────────────────────
         Monat 1   2   3   4   5   6+
```

---

## Entscheidungen die JETZT getroffen werden müssen

Bevor Stage 0 startet:

1. **Name** → Beeinflusst Domain, Repo, Branding, alles
2. **Frontend Framework** → SvelteKit vs SolidStart vs React (bitte nicht)
3. **Voice SFU** → Mediasoup (Node/C++) vs Pion (Go) vs LiveKit (gehostet)
4. **Monorepo vs Polyrepo** → Empfehlung: Monorepo (Turborepo/Bun Workspaces)
5. **Design Direction** → Dunkel wie Discord? Eigene Identität? Welche Farben?

---

## Siehe auch
- [[09 - Der große Plan]] — Tech Stack & Architecture Details
- [[08 - Unser Feature-Scope]] — Feature-Checkliste pro Phase
- [[07 - Discord Feature-Breakdown]] — Discord als Referenz
- [[04 - Marktanalyse & Timing]] — Markt & Monetarisierung
- [[02 - Bestehende Alternativen — Analyse]] — Was die Konkurrenz falsch macht
