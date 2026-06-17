# jarvis-web

Browser chat client for [Jarvis](https://github.com/alexberardi/jarvis), the self-hosted private voice assistant.

A **thin Next.js frontend** (App Router, standalone output). It holds no business logic and no database — every API call is a Next.js rewrite to a backend service. If you find yourself writing logic here, it probably belongs in the backend the rewrite points at.

## What it does

Provides the web UX for Jarvis: chat (SSE-streamed responses), inbox, device/node management, household settings, and the package store (pantry). All requests are proxied to backend services via `next.config.ts` rewrites:

| Path | Rewrites to | Service |
|---|---|---|
| `/api/auth/*` | `${AUTH_URL}/auth/*` | jarvis-auth |
| `/api/households/*` | `${AUTH_URL}/households/*` | jarvis-auth |
| `/api/invites/*` | `${AUTH_URL}/invites/*` | jarvis-auth |
| `/api/cc/*` | `${COMMAND_CENTER_URL}/api/v0/*` | jarvis-command-center |
| `/api/inbox/*` | `${NOTIFICATIONS_URL}/api/v0/inbox/*` | jarvis-notifications |
| `/api/pantry/*` | `${PANTRY_URL}/v1/*` | jarvis-pantry |

## Getting started

```bash
npm install
cp .env.example .env        # then edit the *_URL values if your backends aren't all on localhost
npm run dev                 # http://localhost:7722
```

Other scripts:

```bash
npm run build && npm start  # production build (standalone output)
npm test                    # Jest
npm run lint                # ESLint
```

## Environment variables

All optional — each falls back to a localhost default. Set them when a backend service runs on a different host or port. See `.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `7722` | Dev/prod server port |
| `AUTH_URL` | `http://localhost:7701` | jarvis-auth target for rewrites |
| `COMMAND_CENTER_URL` | `http://localhost:7703` | jarvis-command-center target |
| `NOTIFICATIONS_URL` | `http://localhost:7712` | jarvis-notifications target |
| `PANTRY_URL` | `http://localhost:7721` | jarvis-pantry target |

## Tech stack

- **Next.js 16** (App Router, standalone output, TypeScript)
- **React 19** + TanStack Query
- **Tailwind CSS v4** (dark theme)
- **Axios** with auth interceptor + token refresh
- **Jest** for tests

## License

See [LICENSE](LICENSE) (AGPL-3.0).
