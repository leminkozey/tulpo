# Bestehende Alternativen — Warum sie alle scheitern

Kontext: [[01 - Warum Leute Discord verlassen]] | Features: [[07 - Discord Feature-Breakdown]] | Unser Scope: [[08 - Unser Feature-Scope]]

---

## Matrix / Element
**Was es ist:** Dezentrales Protokoll mit Element als Haupt-Client
**Upside:** Federation, E2EE, Open Source, am feature-reichsten
**Warum es scheitert:**
- "The clients are hot garbage" [234 Upvotes]
- Verschlüsselung bricht regelmäßig — "Unable to decrypt message" x5 [10 Upvotes, aber iconic]
- Setup ist ein Albtraum (Synapse braucht viel RAM, Config ist komplex)
- Federation ist verwirrend für User UND Admins
- Voice/Video ist "finicky" — funktioniert, aber nicht zuverlässig
- Onboarding-Experience ist schlecht
- Notifications verschwinden manchmal
- Message Read Indicators sind "wonky"
- Threads sind "inconvenient"
- "It has a lot of small issues that keep popping up... None is a big deterrent on its own, but it all adds up" [591 Upvotes]
- Element-Team sagt explizit: "Our efforts are prioritised on our target markets which currently does not include being a Discord replacement" [64 Upvotes]
- Fehlende Features: Keine Voice Channels (nur Calls), kein Drop-in Voice

**Learnings:**
- Federation klingt cool, aber verwirrt Normies
- E2EE muss EINFACH sein oder es bricht
- Der Client macht oder bricht alles

## TeamSpeak
**Was es ist:** OG Voice Chat, jetzt mit TS6
**Upside:** Stabil, bewährt, low-latency Voice
**Warum es scheitert:**
- "I hate that teamspeak did nothing. Like nothing." [6827 Upvotes]
- UX ist veraltet
- TS6 sollte auf Matrix basieren, Development ist "basically dead"
- Kaum Text-Features, keine moderne Chat-Experience
- Nicht user-friendly für Normies

**Learnings:**
- Voice-Qualität ist das was Leute an TS schätzen
- Text/Chat muss gleichwertig zu Voice sein

## Revolt
**Was es ist:** Open-Source Discord-Klon
**Upside:** Sieht aus wie Discord, kostenlose Emojis
**Warum es scheitert:**
- Kaum erwähnt in den großen Threads
- Niemand nutzt es — Network-Effect-Problem
- "The issue with alternatives is that noone uses those"

## Mattermost
**Was es ist:** Slack-Alternative, self-hosted
**Upside:** Professionell, gut für Teams
**Warum es scheitert:**
- Voice-Features hinter Paywall
- Lizenz-Probleme (nicht wirklich FOSS)
- Fühlt sich eher wie Slack als wie Discord an

## Rocket.Chat
**Was es ist:** Self-hosted Chat-Platform
**Upside:** Feature-reich
**Warum es scheitert:**
- Free Tier auf 50 User begrenzt
- Fühlt sich wie Enterprise-Software an

## Mumble
**Was es ist:** FOSS Voice-Chat
**Upside:** Extrem low-latency, leichtgewichtig
**Warum es scheitert:**
- Nur Voice, kein Text
- Kein moderner Client
- Aber: "the core tech is solid" — könnte als Voice-Backend dienen

## Stoat
**Was es ist:** Neuerer Discord-Klon
**Upside:** Open Source, vielversprechend
**Warum es scheitert:**
- "Still immature, the flood of sign ups they got is crushing them"
- Zu neu, zu instabil

## Sharkord
**Was es ist:** Self-hosted, TS-Philosophie + Discord-Features
**Upside:** Self-hosted, philosophisch richtig
**Warum es scheitert:**
- Sehr früh in der Entwicklung
- Kaum bekannt

## Spacebar.chat
**Was es ist:** Reimplementation des Discord-Protokolls
**Upside:** Kompatibel mit Discord-Clients
**Warum es scheitert:**
- Nischenprodukt, kaum Aufmerksamkeit

## Steam Chat
**Was es ist:** Valve's integrierter Chat
**Upside:** Bare bones, kein BS, jeder Gamer hat's
**Warum es scheitert:**
- Zu minimalistisch
- Keine Noise Suppression
- Kein Ökosystem außerhalb von Gaming

---

## Zusammenfassung: Die Lücke im Markt

| Feature | Matrix | TS | Revolt | Mumble | Stoat |
|---------|--------|----|--------|--------|-------|
| Einfaches Setup | ❌ | ✅ | ✅ | ✅ | ✅ |
| Schöne UI | ❌ | ❌ | ✅ | ❌ | ✅ |
| Voice | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| Video/Screen | ⚠️ | ❌ | ⚠️ | ❌ | ❌ |
| Mobile | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ |
| Self-Hosted | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Normie-friendly | ❌ | ❌ | ✅ | ❌ | ⚠️ |
| E2EE | ✅ | ❌ | ❌ | ❌ | ❌ |
| Stabil | ❌ | ✅ | ⚠️ | ✅ | ❌ |

**Niemand hat alles.** Die Opportunity ist real.

---

## Siehe auch
- [[01 - Warum Leute Discord verlassen]] — Warum Leute überhaupt wechseln wollen
- [[07 - Discord Feature-Breakdown]] — Was Discord alles kann (vollständige Referenz)
- [[08 - Unser Feature-Scope]] — Was wir besser machen
- [[09 - Der große Plan]] — Wie wir es umsetzen
