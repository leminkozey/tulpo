# Feature-Anforderungen — Direkt von Reddit

Quellen: [[05 - Reddit Threads & Quellen]] | Discord-Referenz: [[07 - Discord Feature-Breakdown]] | Unser Scope: [[08 - Unser Feature-Scope]]

---

## MUST HAVE (ohne diese Features ist es DOA)

### 1. Text Chat mit Channels
- Server → Kategorien → Channels (wie Discord)
- Threads innerhalb von Channels
- Rich Text / Markdown Support
- Emoji Reactions
- File Uploads (DEUTLICH mehr als 10MB)
- Nachrichtensuche (die tatsächlich funktioniert)
- Message Editing & Deletion

### 2. Voice Channels (Drop-In)
- "Always-on" Voice Channels wo Leute rein/raus können
- **NICHT** Calls wie in Teams/Zoom — das ist fundamental anders
- Individuelle Volume Sliders pro Person [explizit gewünscht]
- Noise Cancellation / Echo Cancellation [explizit gewünscht]
- Push-to-Talk UND Voice Activity Detection

### 3. Screensharing
- Screensharing MIT Audio (nicht nur Bild)
- Muss bei Fullscreen-Content funktionieren (Discord's Achillesferse)
- Keine massive GPU Usage

### 4. Mobile Support
- "NO SIDELOADS!" [51 Upvotes] — muss im App Store / über Browser laufen
- Progressive Web App (PWA) als Minimum
- Push Notifications (das größte Problem bei Self-Hosted)

### 5. Server Management
- Rollen & Permissions
- Channel-spezifische Permissions
- Server Invites (Link → Join)
- Moderation Tools (Kick, Ban, Mute)

### 6. User Profiles
- Avatar, Status, Bio
- Friend Requests
- DMs (Direct Messages)

---

## SHOULD HAVE (Differentiators)

### 7. Voice Channel exklusiver Chat
- Chat der nur für Leute sichtbar ist, die im Voice Channel sind
- "I was massively disappointed with Discord's implementation" [explizit gewünscht]
- Discord hat das nie richtig gelöst

### 8. Durchsuchbare Inhalte / Anti-Walled-Garden
- "So much knowledge is locked behind these walled gardens" [2664 Upvotes]
- Option: Public Channels die von Suchmaschinen indexiert werden können
- Eingebautes Wiki/Knowledge-Base Feature pro Server
- Forum-Style Threads für tiefe Diskussionen [2861 Upvotes wollen Foren zurück]

### 9. File Browser / File Management
- Ein User auf r/selfhosted hat das gebaut: eingebauter File Browser pro Server
- Shared Files organisiert ansehen statt im Chat-Verlauf suchen

### 10. End-to-End Encryption (optional)
- E2EE für DMs als Standard
- Optionale E2EE für Channels
- Aber: MUSS einfach sein, kein Key-Management-Horror wie bei Matrix

### 11. Self-Hosted mit einem Command
- `docker run -d corvox/server` und fertig
- Kein Federation-Bullshit zum Setup
- Optional: Federation als Advanced Feature für Fortgeschrittene

### 12. Größere File Uploads
- Discord: 10MB (25MB mit Nitro) — absoluter Witz
- "Fucking Skype had 2GB" [310 Upvotes]
- Self-hosted = dein Storage, dein Limit

---

## NICE TO HAVE (Phase 2+)

### 13. Bots / API
- REST API für Bot-Development
- Webhook Support
- Event-System (ähnlich Discord.js)

### 14. Subcategories / Microcategories
- Tiefere Channel-Organisation als Discord erlaubt
- Horizontale Permissions (nicht nur vertikal: User < Mod < Admin)

### 15. Federation (Optional)
- Server können sich optional vernetzen
- Aber NICHT als Pflicht — Einfachheit zuerst

### 16. Video Calls
- 1:1 und Gruppen-Video
- Aber: Voice + Screensharing hat Priorität über reines Video

### 17. Themes / Customization
- Server-spezifische Themes
- Custom CSS / Branding
- Dark Mode (obviously)

---

## ANTI-Features (was wir NICHT machen)

### Bewusst weglassen:
- **Kein Nitro-Equivalent** — keine künstlichen Limits die man wegkaufen muss
- **Keine Facial ID / KYC** — das ist der ganze Punkt
- **Kein Telemetry** — Zero Tracking
- **Keine Werbung** — niemals
- **Kein "AI" Bullshit** — keine AI-generierten Zusammenfassungen die keiner braucht
- **Keine App Store Abhängigkeit** — PWA first, native Apps optional
