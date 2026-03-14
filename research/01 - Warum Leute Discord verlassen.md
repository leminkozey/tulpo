# Warum Leute Discord verlassen wollen

Kontext: [[04 - Marktanalyse & Timing]] | Quellen: [[05 - Reddit Threads & Quellen]] | Zitate: [[06 - Zitate & Stimmung]]

---

## Der Auslöser: Facial ID Verification
- Discord führt globale Gesichtserkennung als Pflicht ein
- Bereits **70.000 Government IDs** bei einem Hack gestohlen (Quelle: Ars Technica, Okt 2025)
- User verlieren Vertrauen: "Wer garantiert, dass meine Gesichtsdaten sicher sind?"
- YouTube hatte ähnliche Backlash ("youtube made me do this shit just to view fireship videos")
- Rollout auf zweite Hälfte 2026 verschoben wegen Backlash, aber es kommt

## Die tieferen Probleme (schon länger)

### Privacy & Sicherheit
- Nachrichten sind **nicht verschlüsselt** — Klartext in Discord's Datenbank
- Alles was du je geschrieben hast, ist querybar
- Mit Facial ID wird deine reale Identität an alle Nachrichten gelinkt
- Discord hat E2EE für Voice/Video eingeführt (DAVE Protokoll, März 2026), aber **Text bleibt Klartext**
- Siehe [[07 - Discord Feature-Breakdown#E2EE DAVE Protokoll]]

### Enshittification
- Nitro wird aggressiv gepusht [774 Upvotes]
- Immer mehr "cosmetic BS" (Super Reactions, Sticker, Profile Effects) statt Verbesserungen an Core-Features
- 10MB File Upload Limit [310 Upvotes] — siehe [[07 - Discord Feature-Breakdown#File Sharing]]
- Nitro Classic wurde ausgehöhlt — nur noch Animated Avatars übrig [1118 Upvotes]
- Nitro Preiserhöhung in Vorbereitung [1698 Upvotes]
- Revenue $561M in 2025, Ads kommen (Quests, native Commerce)

### Walled Garden / Wissensvernichtung
- **Top-Kommentar mit 2664 Upvotes**: Wissen eingesperrt in nicht-durchsuchbaren Chats
- **Top-Kommentar mit 7527 Upvotes**: Discord als schlechter Wiki/Forum-Ersatz
- **2861 Upvotes**: "I definitely miss proper forums"
- → Unser [[08 - Unser Feature-Scope#Phase 2 — Differentiators|Forum-Channel Feature]] adressiert genau das

### Feature-Regression & Bugs
- Voice/Video Qualität sinkt
- Screenshare laggt bei Fullscreen-Content → [[07 - Discord Feature-Breakdown#Screensharing Go Live]]
- GPU Usage Spikes beim Screensharing
- Android UI-Updates brechen bestehende Workflows
- Korean Search ist seit JAHREN kaputt [28 Upvotes]
- Block/Ignore zeigt trotzdem "1 ignored message" [2165 Upvotes]
- GIF Picker in Gefahr (Tenor entfernt API) [3542 Upvotes]
- Ressourcen-Hunger wächst — ältere PCs können Discord nicht mehr nutzen [3098 Upvotes]

### Performance
- Discord wird immer schwerer
- "Discord alone is taking up so many resources" [3098 Upvotes]
- Electron-App = Chrome-Browser für eine Chat-App
- → Unser Vorteil: Leichtgewichtiger Client, kein Electron

## Was Leute VERMISSEN

### Von Discord gewünscht (aber nicht geliefert):
- **Voice Channel exklusive Chats** → [[08 - Unser Feature-Scope#Phase 2 — Differentiators|Wir bauen das]]
- **Bessere Screenshare-Qualität** ohne Nitro-Paywall
- **Subcategories/Microcategories** für Channel-Organisation
- **Bessere Suchfunktion** → [[08 - Unser Feature-Scope#Phase 2 — Differentiators|Wir bauen das]]
- **Größere File Uploads** → Unser Ansatz: Kein künstliches Limit
- **Echtes Block** — Person komplett unsichtbar, kein "1 ignored message"

### Was Leute generell wollen:
- Zurück zu **Foren-Kultur** — tiefe Diskussionen statt Chat-Spam [2861 Upvotes]
- **Verschlüsselung** — E2EE als Standard (nicht nur Voice)
- **Keine Vendor Lock-in** — Daten gehören dem User
- **Federation** — wie Matrix, aber benutzbar
- **Leichtgewichtiger Client** — kein Electron-Bloat
- **Valve/Steam Chat** als Vorbild für Einfachheit [399 Upvotes]

---

## Siehe auch
- [[02 - Bestehende Alternativen — Analyse]] — Was die Konkurrenz falsch macht
- [[03 - Feature-Anforderungen aus der Community]] — Daraus abgeleitete Features
- [[08 - Unser Feature-Scope]] — Was wir davon umsetzen
