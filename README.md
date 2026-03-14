# Tulpo

A self-hosted Discord alternative built for privacy and control. Real-time messaging with servers, channels, direct messages, and WebSocket-powered live updates.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Backend | [Hono](https://hono.dev) (Web Standard API) |
| Frontend | [SvelteKit](https://svelte.dev) (Svelte 5, Runes, SPA) |
| Database | SQLite (Bun native, WAL mode) |
| Styling | Tailwind CSS v4 |
| WebSocket | Bun native WebSocket |
| Auth | Argon2id + Pepper + Session Tokens |

## Project Structure

```
packages/
  backend/     Hono API server, WebSocket handler, auth
  frontend/    SvelteKit SPA, Tailwind, design system
  shared/      TypeScript types, Zod validators, constants
  db/          SQLite connection, migrations
```

## Quick Start

```bash
# Install dependencies
bun install

# Run database migrations
bun run db:migrate

# Start development (backend + frontend)
bun run dev:backend   # Terminal 1 — API on :3000
bun run dev:frontend  # Terminal 2 — UI on :5173

# Open http://localhost:5173
```

## Docker

```bash
docker compose up --build
# App available at http://localhost:3000
```

## Environment Variables

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `TULPO_PORT` | `3000` | Server port |
| `TULPO_DB_PATH` | `./data/tulpo.db` | SQLite database path |
| `TULPO_SESSION_SECRET` | `dev-secret-change-me` | Session secret (change in prod) |
| `TULPO_PEPPER` | `tulpo-default-pepper-change-me` | Password pepper (change in prod!) |
| `NODE_ENV` | — | Set to `production` for prod mode |

**Important:** In production, always set `TULPO_SESSION_SECRET` and `TULPO_PEPPER` to long, random strings. The pepper is appended to passwords before Argon2id hashing — changing it invalidates all existing passwords.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev:backend` | Start backend with hot reload |
| `bun run dev:frontend` | Start frontend dev server |
| `bun run db:migrate` | Run database migrations |
| `bun run build` | Build all packages |
| `bun run check` | TypeScript type checking |

## Architecture

See `architecture.html` for an interactive overview of the system architecture, data flow, security model, and database schema.

## Security

- **Argon2id** with pepper, timeCost: 5, memoryCost: 64 MiB
- **Rate limiting** on auth routes (20 req/min per IP)
- **Brute force protection** with escalating lockouts (5 fails → 15min, 10 → 1h, 20 → 24h)
- **Parameterized queries** everywhere (no SQL injection)
- **Bearer token auth** (no CSRF risk)

## License

See [LICENSE](LICENSE) for details. Personal use permitted, no public hosting.
