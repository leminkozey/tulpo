# Der große Plan

Das ist der Master-Plan. Wie wir von "Idee" zu "Produkt das Leute nutzen" kommen.

---

## Die Story in einem Satz

> Discord hat seine User verraten. Wir bauen die Alternative die **einfach zu hosten**, **schön zu nutzen**, und **unmöglich zu enshitifien** ist — weil sie dir gehört.

---

## Tech Stack (Vorschlag)

### Backend
- **Runtime:** Bun (schnell, TypeScript-native, SQLite eingebaut)
- **Framework:** Hono oder Elysia (leichtgewichtig, schnell)
- **Datenbank:** SQLite (Bun hat native SQLite — zero extra dependencies)
- **Realtime:** WebSockets (Bun native, kein Socket.io overhead nötig)
- **Voice/Video:** WebRTC + Mediasoup/Pion als SFU (Selective Forwarding Unit)
- **File Storage:** Lokales Filesystem (S3-kompatibel optional)
- **Auth:** Eigenes Session-System oder Lucia Auth

### Frontend
- **Framework:** SvelteKit oder SolidJS (schnell, leichtgewichtig)
- **Styling:** Tailwind CSS
- **State:** Zustand/Signals + WebSocket Events
- **Voice UI:** WebRTC API
- **PWA:** Service Worker für Offline + Push Notifications

### Infrastructure
- **Container:** Single Docker Image (Backend + Frontend)
- **Reverse Proxy:** Caddy oder Traefik (automatisches HTTPS)
- **Push Notifications:** Web Push API (VAPID) + optional eigener Push Relay

### Warum dieser Stack?
- **Bun + SQLite:** Ein Binary, keine externen Dependencies. `docker run` und es läuft.
- **WebSockets native:** Kein Socket.io Overhead, Bun's WS ist extrem schnell
- **SvelteKit/Solid:** Kleines Bundle, schnelle UI, kein React-Bloat
- **Kein Postgres/MySQL nötig:** SQLite reicht für 90% der Self-Hosted-Instanzen. Postgres als optionales Upgrade für große Deployments.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Client (PWA)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Chat UI  │ │ Voice UI │ │ Screen Share │ │
│  └────┬─────┘ └────┬─────┘ └──────┬───────┘ │
│       │             │              │         │
│  WebSocket      WebRTC         WebRTC        │
└───────┼─────────────┼──────────────┼─────────┘
        │             │              │
┌───────┼─────────────┼──────────────┼─────────┐
│       ▼             ▼              ▼         │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐   │
│  │  API /  │  │  SFU     │  │  Media    │   │
│  │  WS Hub │  │ (Voice)  │  │  Relay    │   │
│  └────┬────┘  └──────────┘  └───────────┘   │
│       │                                      │
│  ┌────▼────┐  ┌──────────┐                   │
│  │ SQLite  │  │  Files   │                   │
│  │   DB    │  │ Storage  │                   │
│  └─────────┘  └──────────┘                   │
│                                              │
│            Server (Docker)                   │
└──────────────────────────────────────────────┘
```

---

## Phasen-Plan

### Phase 0 — Foundation (Woche 1-2)
**Ziel:** Projekt-Setup, Core-Architecture, Auth

- [ ] Projekt-Scaffolding (Bun + Frontend Framework)
- [ ] Docker Setup
- [ ] Datenbank-Schema (Users, Servers, Channels, Messages, Roles)
- [ ] Auth System (Register, Login, Sessions)
- [ ] WebSocket Infrastructure (Connection Management, Rooms)
- [ ] Basic API Routes
- [ ] CI/CD Pipeline (GitHub Actions)

**Deliverable:** User kann sich registrieren, einloggen, und eine WebSocket-Verbindung steht.

### Phase 1 — Chat MVP (Woche 3-5)
**Ziel:** Funktionierender Echtzeit-Chat

- [ ] Server erstellen/beitreten
- [ ] Channels erstellen (Text)
- [ ] Echtzeit-Messaging (senden, empfangen, Markdown)
- [ ] Mentions, Reactions, Reply
- [ ] File Upload + Preview
- [ ] Message Edit/Delete
- [ ] Basic Rollen & Permissions
- [ ] Server Invites
- [ ] DMs
- [ ] UI: Channel-Sidebar, Message-Area, Member-List

**Deliverable:** Zwei Leute können einen Server erstellen, Channels anlegen, und in Echtzeit chatten. Sieht gut aus.

### Phase 2 — Voice (Woche 6-8)
**Ziel:** Drop-In Voice Channels

- [ ] WebRTC Setup + SFU Integration
- [ ] Voice Channels (persistent, Drop-In)
- [ ] Per-User Volume
- [ ] Push-to-Talk + Voice Activity
- [ ] Noise Suppression
- [ ] Server Mute/Deafen
- [ ] UI: Voice Channel Indicator, Connected Users, Controls

**Deliverable:** Freunde können in einem Voice Channel rumhängen wie bei Discord.

### Phase 3 — Screenshare + Mobile (Woche 9-11)
**Ziel:** Screensharing + Mobile-Ready

- [ ] Screen/Window Share (WebRTC)
- [ ] Audio-Share beim Stream
- [ ] PWA Setup (manifest, service worker)
- [ ] Push Notifications (Web Push API)
- [ ] Responsive UI für Mobile
- [ ] Touch-Optimierung

**Deliverable:** App funktioniert auf Desktop UND Handy. Screenshare läuft.

### Phase 4 — Differentiators (Woche 12-14)
**Ziel:** Die Features die uns von Discord ABHEBEN

- [ ] Forum Channels (echte Foren, nicht Discord's halbgarer Versuch)
- [ ] Voice Channel Chat (exklusiv für Leute im VC)
- [ ] File Browser (alle Files pro Channel auf einen Blick)
- [ ] Erweiterte Suche
- [ ] Moderation Tools (Kick, Ban, Timeout, Audit Log, AutoMod)
- [ ] Admin Panel (Web UI für Server-Config)

**Deliverable:** Wir haben Features die Discord nicht hat oder schlecht macht.

### Phase 5 — Polish & Launch (Woche 15-16)
**Ziel:** Launch-Ready

- [ ] Docker Image optimieren (klein, schnell)
- [ ] Dokumentation (Setup Guide, API Docs)
- [ ] Landing Page
- [ ] Open Source auf GitHub
- [ ] Demo-Server zum Testen
- [ ] Launch auf r/selfhosted, r/opensource, Hacker News
- [ ] README mit One-Liner Setup

**Deliverable:** Jemand kann `docker run` ausführen und hat einen funktionierenden Server.

---

## Name

Noch offen. Kriterien:
- Kurz (max 2 Silben)
- Kein "Chat" oder "Talk" im Namen (langweilig)
- Domain verfügbar
- Memorabel
- Kein Trademark-Konflikt

Ideen-Dump:
- Corvox
- Nexus
- Hive
- Pulse
- Signal (vergeben)
- Flux (fast vergeben — Fluxer existiert)
- Void
- Rift
- Drift
- Haven

---

## Monetarisierung

Siehe [[04 - Marktanalyse & Timing#Monetarisierung]] für Details.

**Core-Modell:**
1. **Self-Hosted: Kostenlos** — Full Features, Open Source
2. **Managed Hosting: $5-15/mo** — Wir hosten für dich
3. **Push Notification Relay: Free Tier + Paid** — Das Self-Hosting-Pain-Point als Service

---

## Risiken & Mitigations

Siehe [[04 - Marktanalyse & Timing#Risiken]] für die vollständige Analyse.

| Risiko | Mitigation |
|---|---|
| Network Effect | Kleine Gruppen targeten die aktiv weg wollen |
| Feature Parity | MVP First, nicht versuchen Discord 1:1 nachzubauen |
| Mobile Push | Eigener Push Relay Service |
| Vibe-Coding Backlash | Clean Code, kein AI-Slop, transparent kommunizieren |
| Fragmentierung | Klar kommunizieren was uns unterscheidet |
| Voice/Video Complexity | WebRTC + bewährte SFU Libraries (Mediasoup/Pion) |

---

## Inspiration & Referenzen

### Was wir von Discord klauen (die guten Teile):
- Drop-In Voice Channels (das Killer-Feature)
- Channel-basierte Struktur
- Invite-System
- Die grundlegende UX-Flow

### Was wir von Foren klauen:
- Durchsuchbare, persistente Diskussionen
- Thread-basierte Konversationen
- SEO-indexierbare Inhalte

### Was wir von Matrix lernen (Fehler vermeiden):
- Setup muss EINFACH sein
- Client muss SCHÖN sein
- E2EE darf nicht die UX ruinieren
- Federation erst NACHDEM der Core steht

### Was wir von TeamSpeak lernen:
- Voice-Qualität ist heilig
- Einfachheit > Features
- Self-Hosting muss trivial sein

---

## Siehe auch
- [[00 - Projektübersicht]] — Quick Overview
- [[08 - Unser Feature-Scope]] — Detaillierte Feature-Liste
- [[07 - Discord Feature-Breakdown]] — Discord als Referenz
- [[04 - Marktanalyse & Timing]] — Markt & Monetarisierung
