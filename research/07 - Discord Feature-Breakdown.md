# Discord Feature-Breakdown — Vollständige Referenz

Alles was Discord kann. Als Referenz um zu entscheiden was wir brauchen → [[08 - Unser Feature-Scope]].

---

## 1. Server-Struktur

### Server (Guild)
- Erstellen, beitreten, verlassen
- Server Icon, Banner, Beschreibung
- Server Discovery (öffentliche Server finden)
- Vanity URL (z.B. discord.gg/gaming)
- Server Templates (vorgefertigte Channel-Strukturen)
- Member Cap: bis zu 25M Members (Stand Sept 2025)
- Community Server Mode (aktiviert Extra-Features)

### Kategorien
- Gruppierung von Channels
- Collapsible (auf-/zuklappbar)
- Kategorie-weite Permissions

### Text Channels
- Unbegrenzt pro Server (praktisch)
- Channel-Beschreibung, Topic
- Slowmode (Rate Limiting pro User)
- NSFW-Markierung
- Channel-spezifische Permissions

### Voice Channels
- Drop-In/Drop-Out (persistent, immer offen)
- Kein "Call starten" nötig — einfach reinklicken
- User Limit pro Channel einstellbar
- Bitrate einstellbar (64-384 kbps, höher mit Boosts)
- Region Override

### Forum Channels
- Jeder Post ist ein eigener Thread
- Tags zum Kategorisieren
- Sortierung (Latest Activity, Creation Date)
- Default Reaction
- Post Guidelines
- **Wichtig:** Das ist Discord's Antwort auf "wir vermissen Foren" — aber es ist halbherzig implementiert

### Stage Channels
- Speaker + Audience Modell (wie Clubhouse/Twitter Spaces)
- Hand Raise Feature
- Moderation Tools für Speakers
- Für: AMAs, Townhalls, Talks, Events

### Threads
- Temporäre Sub-Conversations innerhalb eines Channels
- Auto-Archive nach Inaktivität (1h, 24h, 3d, 7d)
- Private Threads (Nitro/Boost Feature)

### Announcement Channels
- Cross-Server Publishing
- Follower können Announcements in eigenen Server pullen

---

## 2. Messaging

### Text
- Markdown Support (bold, italic, code, spoiler, headers, lists)
- Inline Code + Code Blocks mit Syntax Highlighting
- Mentions (@user, @role, @everyone, @here)
- Emoji (Custom Server Emoji, Animated mit Nitro)
- Stickers (Nitro Feature)
- Reactions (auch Custom Emoji als Reactions)
- Super Reactions (Nitro, animiert)
- Reply/Quote
- Message Editing & Deletion
- Pins (bis zu 250 pro Channel, war 50)
- Embeds (URL Previews, Rich Embeds von Bots)
- Spoiler Tags (Text + Bilder)
- Slash Commands (/giphy, /tts, etc.)
- Message Search (mit Filtern: from, in, has, before, after)

### File Sharing
- Upload Limit: 10MB (Free), 25MB (Nitro Basic), 500MB (Nitro)
- Bilder, Videos, Audio, Dokumente
- Inline Image/Video Preview
- AV1 Video Support (seit Juli 2025)

### GIFs
- Integrierter GIF Picker (Tenor API)
- ⚠️ Tenor entfernt API — Discord muss Alternative finden

---

## 3. Voice & Video

### Voice
- Low-Latency Voice Chat
- Noise Suppression (Krisp Integration)
- Echo Cancellation
- Push-to-Talk
- Voice Activity Detection
- Per-User Volume Control
- Server Mute / Server Deafen
- Priority Speaker Mode
- Soundboard (6 Default Sounds, Custom mit Boosts)

### Video
- Webcam in Voice Channels
- Bis zu 25 Teilnehmer
- Auflösung einstellbar

### Screensharing / Go Live
- Application Window oder ganzer Screen
- Audio-Sharing beim Screensharing
- Auflösung bis 4K/60fps (Nitro) / 720p/30fps (Free)
- Zoom & Pan mit Scrollrad (neu 2025)
- "Stats for Nerds" (Codec/Bitrate Info)
- ⚠️ Bekannte Probleme: GPU Usage Spikes, Lag bei Fullscreen

### E2EE (DAVE Protokoll)
- End-to-End Encryption für alle Voice/Video ab März 2026
- DMs, Group DMs, Voice Channels, Go Live
- Clients ohne DAVE-Support können nicht mehr teilnehmen

---

## 4. User System

### Profile
- Avatar (animiert mit Nitro)
- Banner
- About Me / Bio
- Custom Status (Text + Emoji)
- Server-spezifische Avatare (Nitro)
- Server-spezifische Banner
- Pronouns
- Connected Accounts (Spotify, GitHub, Steam, etc.)
- Profile Effects (Nitro Shop)
- Game Activity Display ("Playing...", "Streaming...")
- Recently Played Games Board (neu 2025)

### Social
- Friend Requests
- DMs (1:1)
- Group DMs (bis 10 Personen)
- Block / Ignore
- ⚠️ Block ist kaputt — "1 ignored message" wird trotzdem angezeigt [2165 Upvotes Complaint]

### Presence
- Online, Idle, DND, Invisible
- Custom Status mit Ablaufdatum
- Mobile-Indikator

---

## 5. Rollen & Permissions

### Rollen-System
- Hierarchisch (höhere Rolle > niedrigere Rolle)
- Farbig (Rollenfarbe = Username-Farbe)
- Hoistable (separate Gruppe in Memberliste)
- Mentionable
- Role Icons

### Permissions (Auszug der wichtigsten)
**Server-Level:**
- Administrator (Alle Rechte)
- Manage Server, Manage Channels, Manage Roles
- Kick/Ban Members
- Manage Webhooks, Manage Emojis
- View Audit Log

**Channel-Level:**
- View Channel
- Send Messages, Send Messages in Threads
- Embed Links, Attach Files
- Add Reactions
- Manage Messages, Manage Threads
- Pin Messages (eigene Permission seit Feb 2026)
- Connect (Voice), Speak, Video, Stream

**Besonderheiten:**
- Permission Overwrites pro Channel
- Kategorie-Permissions vererben sich an Channels
- @everyone als Default-Rolle
- ⚠️ Community-Kritik: Nur vertikale Hierarchie, keine horizontalen Permissions

---

## 6. Moderation

- Kick & Ban
- Timeout (Temporärer Mute)
- Audit Log
- Auto-Mod (Keyword Filter, Spam Detection, Mention Limits)
- Verification Levels (None → Phone Verified)
- Content Filter (Explicit Media Scanning)
- Slowmode pro Channel
- ⚠️ Community will: Bessere Anti-Raid Tools, IP-Bans, besseres Logging

---

## 7. Bots & Integrations

### Bot API
- REST API + WebSocket Gateway
- Slash Commands
- Message Components (Buttons, Select Menus, Modals)
- Webhooks (Incoming)
- OAuth2 für Bot-Auth
- Rate Limiting

### Activities
- HTML5 Apps die IN Voice Channels laufen
- Spiele, Tools, Watch-Together
- Seit 2025 aus Experimental raus

### Integrations
- YouTube, Twitch Notifications
- GitHub, Jira Webhooks
- Zapier, IFTTT Support
- Spotify Listen Along

---

## 8. Monetarisierung (Discord's Modell)

### Nitro ($9.99/mo)
- Animated Avatar/Banner
- Custom Themes (5 Farben, Gradients)
- 500MB Upload
- 4K/60fps Streaming
- Custom Emoji überall nutzen
- 2 Server Boosts inklusive
- Server-spezifische Avatare
- Profile Effects, Stickers, Super Reactions
- Priority Support

### Nitro Basic ($2.99/mo)
- 50MB Upload
- Custom Emoji überall
- Custom Themes

### Server Boosts ($4.99/mo pro Boost)
- Level 1 (2 Boosts): +50 Emoji Slots, 128kbps Audio, Custom Stickers
- Level 2 (7 Boosts): 256kbps Audio, Server Banner, 50MB Upload für alle
- Level 3 (14 Boosts): 384kbps Audio, Vanity URL, Animated Icon

### Server Subscriptions
- Creator-Feature: Gated Content hinter Paywall
- 90/10 Revenue Split (Creator bekommt 90%)

### Shop
- Digitale Güter (Avatare, Profile Effects)
- Quests (Belohnungen für Streaming bestimmter Spiele)

### Revenue
- $561M Revenue in 2025
- Nitro ist Haupt-Revenue-Treiber
- Ads kommen (Quests + native Commerce mit Spielen)

---

## Siehe auch
- [[03 - Feature-Anforderungen aus der Community]] — Was die Community davon will
- [[08 - Unser Feature-Scope]] — Was wir davon bauen
- [[01 - Warum Leute Discord verlassen]] — Was davon Leute nervt
