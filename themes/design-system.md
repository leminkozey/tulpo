# Design System

Das definitive Design-Referenzdokument. Alle Frontend-Komponenten muessen sich daran halten.

---

## Fonts

| Verwendung | Font | Weights |
|-----------|------|---------|
| UI Text | Plus Jakarta Sans | 400, 500, 600, 700, 800 |
| Code / Mono | JetBrains Mono | 400, 500 |

---

## Farbpalette — Dark Mode (Default)

### Backgrounds
| Token | Hex | Verwendung |
|-------|-----|------------|
| `--bg-primary` | `#0c0d11` | App-Hintergrund |
| `--bg-secondary` | `#14151b` | Cards, Panels, Code Blocks |
| `--bg-tertiary` | `#1c1d25` | Inputs, erhöhte Flächen |
| `--bg-hover` | `#24252e` | Hover-States |
| `--bg-active` | `#2c2d38` | Active/Pressed-States, Inline Code |

### Text
| Token | Hex | Verwendung |
|-------|-----|------------|
| `--text-primary` | `#e8e9ef` | Headings, wichtiger Text |
| `--text-secondary` | `#8b8d9e` | Body Text, Beschreibungen |
| `--text-muted` | `#4e5064` | Timestamps, Captions, Placeholder |

### Accent & Status
| Token | Hex | Verwendung |
|-------|-----|------------|
| `--accent` | `#14b8a6` | Primary Buttons, aktive Elemente |
| `--accent-hover` | `#2dd4bf` | Hover auf Accent, Inline Code Text, Username-Farbe |
| `--accent-muted` | `rgba(20, 184, 166, 0.1)` | Avatar-Backgrounds, Tag-Backgrounds |
| `--danger` | `#ef4444` | Danger Buttons, Error |
| `--success` | `#22c55e` | Online, Connected |
| `--warning` | `#f59e0b` | Idle, Warnungen |

### Borders
| Token | Hex | Verwendung |
|-------|-----|------------|
| `--border` | `#1e1f28` | Standard Borders, Dividers |

---

## Border Radius

| Token | Wert | Verwendung |
|-------|------|------------|
| `--radius-sm` | `6px` | Small Buttons, Tags-Ecken, Code Inline |
| `--radius-md` | `10px` | Buttons, Inputs, Messages, Code Blocks |
| `--radius-lg` | `14px` | Cards, Panels, Large Buttons |
| Pill | `20px` | Tags |
| Circle | `50%` | Avatare |

---

## Typography Scale

| Element | Size | Weight | Letter-Spacing | Color |
|---------|------|--------|----------------|-------|
| H1 | 32px | 800 | -0.8px | `--text-primary` |
| H2 | 22px | 700 | -0.3px | `--text-primary` |
| H3 | 14px | 700 | 0 | `--text-secondary` |
| Body | 15px | 400 | 0 | `--text-secondary` |
| Body Small | 14px-14.5px | 400 | 0 | `--text-secondary` |
| Caption | 13px | 400 | 0 | `--text-muted` |
| Timestamp | 11px | 400 | 0 | `--text-muted` |
| Code Inline | 13px | 400 (Mono) | 0 | `--accent-hover` |
| Code Block | 13px | 400 (Mono) | 0 | `--text-primary` |

---

## Buttons

### Varianten
| Typ | Background | Text | Border |
|-----|-----------|------|--------|
| Primary | `--accent` | `#0c0d11` (dark) | none |
| Secondary | `--bg-tertiary` | `--text-primary` | 1px `--border` |
| Ghost | transparent | `--text-secondary` | none |
| Danger | transparent | `--danger` | 1px `rgba(239,68,68,0.3)` |

### Sizes
| Size | Padding | Font-Size | Radius |
|------|---------|-----------|--------|
| Small | 6px 14px | 13px | `--radius-sm` |
| Medium | 10px 20px | 14px | `--radius-md` |
| Large | 14px 28px | 16px (weight 700) | `--radius-lg` |

### Interaktionen
- **Hover:** `translateY(-1px)` + Farbwechsel. KEIN box-shadow, KEIN glow.
  - Primary: bg wird `--accent-hover`
  - Secondary: bg wird `--bg-hover`, border wird `--text-muted`
  - Ghost: bg wird `--bg-tertiary`, text wird `--text-primary`
  - Danger: bg wird `rgba(239,68,68,0.1)`, border wird `--danger`
- **Active/Press:** `translateY(1px)` + dunklerer bg. KEIN box-shadow.
- **Transition:** `all 0.15s ease`

---

## Input

- Background: `--bg-tertiary`
- Border: 1px `--border`
- Radius: `--radius-md`
- Padding: 14px 16px
- Font: Plus Jakarta Sans, 14px
- Placeholder: `--text-muted`
- **Focus:** Border wird `--text-muted`. KEIN box-shadow, KEIN glow, KEIN Accent-Farbe.
- Transition: `border-color 0.15s ease`

---

## Chat Messages

- Layout: Avatar (40px, circle) + Content, gap 12px
- Padding: 8px 12px
- Radius: `--radius-md`
- **Hover:** bg wird `--bg-hover`. Kein border-left, kein glow.
- Transition: `background 0.1s ease`
- Author: 14px, weight 700, Rollenfarbe
- Timestamp: 11px, `--text-muted`
- Message Text: 14.5px, `--text-secondary`, line-height 1.5

---

## Code Blocks

- Background: `--bg-secondary`
- Border: 1px `--border`
- Radius: `--radius-md`
- Padding: 16px
- Font: JetBrains Mono, 13px, line-height 1.7
- Syntax Colors:
  - Keywords: `#f472b6` (pink)
  - Strings: `--accent-hover` (teal)
  - Comments: `--text-muted` (italic)

---

## Tags / Badges

- Shape: Pill (border-radius 20px)
- Padding: 4px 10px
- Font: 12px, weight 600
- Varianten: Subtiler Background (10-12% opacity) + helle Textfarbe
  - Accent: `rgba(20,184,166,0.1)` / `--accent-hover`
  - Success: `rgba(34,197,94,0.12)` / `#4ade80`
  - Warning: `rgba(245,158,11,0.12)` / `#fbbf24`
  - Danger: `rgba(239,68,68,0.12)` / `#f87171`

---

## Cards

- Background: `--bg-secondary`
- Border: 1px `--border`
- Radius: `--radius-lg`
- Padding: 20px
- **Hover:** border wird `--text-muted`, `translateY(-2px)`, `box-shadow: 0 2px 8px rgba(0,0,0,0.3)`. Kein farbiger glow.
- Transition: `all 0.15s ease`

---

## Toggle

- Track: 44x24px, radius 12px, bg `--bg-active` (off) / `--accent` (on)
- Thumb: 18x18px, circle, white, shadow `0 1px 3px rgba(0,0,0,0.2)`
- Animation: `transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)` (leichter Bounce)

---

## Globale Regeln

1. **KEIN GLOW.** Nirgends. Keine farbigen box-shadows auf Interaktionen. Einzige Ausnahme: Cards haben einen neutralen Schatten (`rgba(0,0,0,0.3)`) auf Hover.
2. **Subtile Interaktionen.** Hover = leichter Lift oder Farbwechsel. Active = leichter Press. Nichts Flashiges.
3. **Transitions:** 0.1s-0.2s ease. Nie länger. Nie bouncy (ausser Toggle-Thumb).
4. **Spacing:** Konsistent. 4px Grid-Basis. Gaps: 4px (tight), 8px (compact), 12px (default), 16px (spacious).
5. **Frost-Theme** als User-wählbare Alternative: Gleiche Komponenten, aber Indigo (#6366f1) statt Teal als Accent, Inter statt Plus Jakarta Sans.
