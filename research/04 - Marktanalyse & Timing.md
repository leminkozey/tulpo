# Marktanalyse & Timing

Übersicht: [[00 - Projektübersicht]] | Quellen: [[05 - Reddit Threads & Quellen]] | Plan: [[09 - Der große Plan]]

---

## Warum der Zeitpunkt perfekt ist

### Die Zahlen
- **"Discord alternatives"** Suchanfragen: +10.000% über Nacht (Quelle: r/pcmasterrace, 10k+ Upvotes)
- **TeamSpeak**: "Incredible surge of new users" (12k Upvotes auf r/pcmasterrace)
- **r/selfhosted Discord-Thread**: 5.000+ Upvotes in wenigen Tagen
- **r/pcmasterrace Thread**: 16.500+ Upvotes — "Time to find a proper Discord alternative"

### Der Trigger
Discord Facial ID Verification ist der Katalysator, aber die Frustration ist seit Jahren gewachsen:
- Nitro-Pushing
- Enshittification
- Privacy-Bedenken
- File Size Limits
- Walled Garden Problem

### Historische Parallele
- Discord hat TeamSpeak + Skype ersetzt weil es **einfacher und schöner** war
- Die gleiche Opportunity existiert jetzt für Discord selbst
- "It did everything TeamSpeak did but better and for free, in a much more user friendly way" [Original Post, 16k Upvotes]

## Zielgruppen (in Prioritätsreihenfolge)

### 1. Homelab / Self-Hosting Community
- Technisch versiert, hostet sowieso schon alles selbst
- Starke Meinungen über Privacy
- Bereit, neue Tools auszuprobieren
- Multiplikatoren — empfehlen Tools aktiv weiter
- **Erreichbar über:** r/selfhosted, r/homelab, YouTube (TechnoTim, NetworkChuck, etc.)

### 2. Gaming Communities (klein bis mittel)
- 5-50 Leute die zusammen zocken
- Voice ist King
- Wollen was das "einfach funktioniert"
- Discord war für sie gemacht — jetzt fühlen sie sich verraten
- **Erreichbar über:** r/pcmasterrace, Gaming-Foren, Steam

### 3. Open Source / Dev Communities
- Nutzen Discord als "poor man's Slack"
- Hassen dass Wissen in Discord verschwindet
- Wollen durchsuchbare, öffentliche Diskussionen
- **Erreichbar über:** GitHub, Hacker News, Dev.to

### 4. Privacy-Bewusste User
- Post-Snowden, Post-GDPR Mindset
- Wollen Kontrolle über ihre Daten
- Oft auch in der Self-Hosting Community
- **Erreichbar über:** r/privacy, r/degoogle

## Monetarisierung

### Open Source + Hosted Version (bewährtes Modell)
- **Self-Hosted: Kostenlos** — Open Source, Docker, eigener Server
- **Managed Hosting: $5-15/Monat** — Wir hosten für dich
- Beispiele die das erfolgreich machen: Plausible, Umami, Bitwarden, GitLab

### Warum das funktioniert:
- Self-Hosted User sind die besten Evangelisten
- Sie empfehlen das Tool, ihre weniger-technischen Freunde zahlen für Hosting
- Open Source baut Vertrauen auf (besonders nach Discord's Vertrauensbruch)
- Keine künstlichen Limits — das volle Produkt ist free

### Zusätzliche Revenue-Streams (später)
- Premium Support für Unternehmen
- Custom Domain / Branding
- Managed Push Notification Service (das größte Self-Hosting-Problem)

## Risiken

### 1. Network Effect
- "The issue with alternatives is that noone uses those" [398 Upvotes]
- Discord's größter Moat ist nicht die Software, sondern die User
- **Mitigation:** Nicht versuchen ALLE zu migrieren, sondern **kleine Gruppen** die aktiv weg wollen

### 2. Feature Parity
- Discord hatte 10+ Jahre Development
- **Mitigation:** MVP mit den wichtigsten Features, nicht Feature Parity anstreben

### 3. Mobile Push Notifications
- Self-hosted Push Notifications sind technisch schwierig
- Zulip hat das gleiche Problem — nutzt SaaS-Komponente dafür
- **Mitigation:** Eigener Push-Service als optionaler Managed Service

### 4. Vibe-Coding Backlash
- r/selfhosted hasst aktuell "AI slop" Apps [3000+ Upvotes]
- "Fully remove every 'I created a selfhosted app' claude slop" [3065 Upvotes]
- **Mitigation:** Handwerk zeigen. Clean Code, kein Slop. Und ehrlich kommunizieren.

### 5. Fragmentierung
- "Instead of efforts being concentrated towards a few great projects, it just dilutes resources" [9 Upvotes aber valider Punkt]
- **Mitigation:** Klar kommunizieren was anders ist, warum es existiert
