# Unser Feature-Scope — Was wir bauen

Basierend auf [[07 - Discord Feature-Breakdown|Discord's Features]], [[03 - Feature-Anforderungen aus der Community|Community-Anforderungen]] und [[02 - Bestehende Alternativen — Analyse|was die Konkurrenz verkackt]].

---

## Grundprinzipien

1. **Kein Feature-Parity-Wahn** — Wir bauen nicht Discord nach. Wir bauen was Besseres, Fokussierteres.
2. **Core muss perfekt sein** — Chat + Voice + Screenshare müssen am Tag 1 bombenfest sein.
3. **Einfachheit schlägt Features** — Lieber 10 Features die perfekt funktionieren als 50 die halbgar sind.
4. **Self-Hosted First** — Alles muss mit einem Docker-Command laufen.
5. **Anti-Enshittification** — Keine künstlichen Limits, keine Paywalls für Basic-Features.

---

## Phase 1 — MVP ("Es funktioniert")

### Server & Channels
- [ ] Server erstellen/beitreten/verlassen
- [ ] Server Icon + Name + Beschreibung
- [ ] Kategorien (collapsible)
- [ ] Text Channels mit Topic/Beschreibung
- [ ] Voice Channels (Drop-In, persistent)
- [ ] Channel-Sortierung (Drag & Drop)

### Messaging
- [ ] Echtzeit-Text-Chat (WebSocket)
- [ ] Markdown Support (bold, italic, code, lists, headers)
- [ ] Mentions (@user, @role, @everyone)
- [ ] Emoji Reactions
- [ ] Reply/Quote
- [ ] Message Edit & Delete
- [ ] Inline Image/Video Preview
- [ ] File Upload (Limit = dein Server-Storage, kein künstliches Limit)
- [ ] Message Search (basic: Volltext)
- [ ] Pins

### Voice
- [ ] WebRTC Voice Chat
- [ ] Drop-In/Drop-Out Voice Channels
- [ ] Per-User Volume Control
- [ ] Push-to-Talk + Voice Activity
- [ ] Noise Suppression (RNNoise oder ähnlich)
- [ ] Server Mute / Deafen

### Screensharing
- [ ] Screen/Window Share in Voice Channels
- [ ] Audio-Sharing beim Screenshare
- [ ] Keine künstliche Qualitätsbegrenzung

### User System
- [ ] Registration / Login (Email + Password)
- [ ] Avatar + Status + Bio
- [ ] Online/Offline/Idle/DND Presence
- [ ] Friend Requests
- [ ] DMs (1:1)
- [ ] Group DMs

### Rollen & Permissions
- [ ] Rollen erstellen/bearbeiten/löschen
- [ ] Rollenfarben
- [ ] Hierarchie
- [ ] Basic Permissions: Admin, Manage Channels, Manage Roles, Kick, Ban, Send Messages, Connect, Speak
- [ ] Channel-spezifische Permission Overwrites

### Server Invites
- [ ] Invite Links generieren
- [ ] Ablaufdatum + Max Uses
- [ ] Invite Tracking (wer hat wen eingeladen)

### Moderation (Basic)
- [ ] Kick & Ban
- [ ] Timeout / Mute
- [ ] Message Delete (Mod)
- [ ] Audit Log (basic)

### Mobile
- [ ] Responsive Web App (PWA)
- [ ] Push Notifications (über eigenen Push Service oder optional Managed)
- [ ] Touch-optimierte UI

### Self-Hosting
- [ ] Ein Docker-Command: `docker run corvox/server`
- [ ] SQLite als Default (keine extra DB nötig)
- [ ] Umgebungsvariablen für Config
- [ ] Automatische HTTPS mit Let's Encrypt (optional)
- [ ] Admin Panel (Web UI für Server-Config)

---

## Phase 2 — Differentiators ("Warum wir, nicht Discord")

### Forum Channels (BESSER als Discord)
- [ ] Echte Forum-Threads mit Titel, Body, Tags
- [ ] Sortierung: Newest, Most Active, Most Voted
- [ ] Upvote/Downvote auf Posts
- [ ] Durchsuchbar + SEO-indexierbar (optional public)
- [ ] → Das ist der [[06 - Zitate & Stimmung|#1 Community-Wunsch]] mit 7527+2664 Upvotes

### Voice Channel Chat
- [ ] Chat der NUR für Leute im Voice Channel sichtbar ist
- [ ] Verschwindet/archiviert sich wenn alle den Channel verlassen
- [ ] → Explizit von der Community gewünscht, Discord hat es verkackt

### File Browser
- [ ] Alle geteilten Files pro Channel/Server auf einen Blick
- [ ] Sortierung, Suche, Preview
- [ ] Kein "scroll durch 3 Monate Chat um das PDF zu finden"

### Erweiterte Suche
- [ ] Volltextsuche über alle Channels
- [ ] Filter: User, Channel, Datum, Dateityp
- [ ] Suche die FUNKTIONIERT (Discord's ist notorisch schlecht)
- [ ] Multi-Language Support (kein kaputtes Korean Search)

### E2EE (Optional)
- [ ] E2EE für DMs als Default
- [ ] Optionale E2EE für Channels
- [ ] Einfach. Kein Key-Management-Horror wie Matrix.

### Größere File Uploads
- [ ] Kein künstliches Limit — dein Server, dein Storage
- [ ] Optional: Quota pro User/Rolle konfigurierbar

---

## Phase 3 — Ökosystem ("Es lebt")

### Bot/API System
- [ ] REST API
- [ ] WebSocket Events
- [ ] Webhooks (Incoming + Outgoing)
- [ ] Bot Accounts
- [ ] Slash Commands
- [ ] Message Components (Buttons, Select Menus)
- [ ] OAuth2

### Themes & Customization
- [ ] Dark/Light Mode
- [ ] Custom CSS pro Server (Admin-Feature)
- [ ] Server Branding (Logo, Farben, Banner)

### Federation (Optional)
- [ ] Server-zu-Server Kommunikation
- [ ] Cross-Server DMs
- [ ] Shared Channels zwischen Servern
- [ ] **NICHT als Pflicht** — Einfachheit zuerst

### Stage Channels
- [ ] Speaker/Audience Modell
- [ ] Hand Raise
- [ ] Moderation

### Scheduled Events
- [ ] Events erstellen mit Datum/Zeit
- [ ] RSVP / "Interested"
- [ ] Reminder Notifications

### Video Calls
- [ ] Webcam Support in Voice Channels
- [ ] 1:1 Video in DMs

### Activities
- [ ] Eingebettete HTML5 Apps in Voice Channels
- [ ] Watch Together
- [ ] Plugin System

---

## ANTI-Features (was wir NIEMALS bauen)

Siehe auch [[03 - Feature-Anforderungen aus der Community#ANTI-Features was wir NICHT machen]]

- ❌ **Nitro / Paywalled Features** — Alles ist free. Self-hosted = dein Server.
- ❌ **Facial ID / KYC** — Der ganze Grund warum dieses Projekt existiert
- ❌ **Telemetry / Tracking** — Zero. Nada.
- ❌ **Werbung / Quests / Sponsored Content** — Niemals
- ❌ **Künstliche Upload-Limits** — Dein Storage, dein Limit
- ❌ **AI-Bullshit Features** — Keine AI-Zusammenfassungen, keine AI-Sticker
- ❌ **Server Discovery (öffentlich)** — Kein Marketplace. Server werden per Invite geteilt.
- ❌ **Super Reactions / Sticker Packs** — Cosmetic Bloat den niemand braucht

---

## Siehe auch
- [[07 - Discord Feature-Breakdown]] — Vollständige Discord-Feature-Referenz
- [[03 - Feature-Anforderungen aus der Community]] — Community-Wünsche
- [[09 - Der große Plan]] — Technische Umsetzung
