# jarvis-web

Next.js 16 (App Router) browser client for Jarvis. **A thin frontend** — every API call is a Next.js rewrite to a backend service. No DB, no business logic, no API routes of its own.

> **Identity rule:** if you find yourself writing logic in this codebase, you're probably in the wrong place. Add it to the backend service the rewrite points at, and call it from here.

---

## Topology

```
Browser
   │
   ▼
┌──────────────────────────┐
│  jarvis-web :7722        │   Next.js (App Router, RSC, standalone)
│  - app/login             │
│  - app/register          │
│  - app/chat              │   Main UX
│  - app/inbox             │
│  - app/devices           │   Nodes
│  - app/settings          │   Household settings
│  - app/pantry            │   Package store
└────┬─────────────────────┘
     │ next.config.ts rewrites
     │
     ├──▶ /api/auth/*       → jarvis-auth /auth/*                (7701)
     ├──▶ /api/households/* → jarvis-auth /households/*          (7701)
     ├──▶ /api/invites/*    → jarvis-auth /invites/*             (7701)
     ├──▶ /api/inbox/*      → jarvis-notifications /api/v0/inbox (7712)
     ├──▶ /api/pantry/*     → jarvis-pantry /v1/*                (7721)
     └──▶ /api/cc/*         → jarvis-command-center /api/v0/*    (7703)
```

---

## Quick Reference

```bash
npm install
cp .env.example .env       # Set the *_URL env vars if not all on localhost
npm run dev                # http://localhost:7722
npm run build && npm start # Production (standalone output)
npm test                   # Jest
```

---

## Dependency graph

**Upstream (web depends on, via rewrites):**
- **jarvis-auth** (7701) — login, registration, household management, invites
- **jarvis-command-center** (7703) — chat (`/voice/command`), warmup, node listing
- **jarvis-notifications** (7712) — inbox
- **jarvis-pantry** (7721) — browse / install / Forge

**Downstream:** browser users.

**Impact if down:**
- No web chat or web inbox; mobile app and Pi nodes unaffected.

---

## Pages

| Path | Purpose | Backend it reads |
|---|---|---|
| `/` | Redirects to `/chat` or `/login` | — |
| `/login` | Email + password login | auth `/auth/login` |
| `/register` | New account + auto-login | auth `/auth/register` |
| `/chat` | **Main chat UX** — SSE-streamed responses, node selector, action buttons | CC `/voice/command(/stream)`, `/conversation/start` |
| `/inbox` | Inbox list + detail view | notifications `/inbox` |
| `/inbox/[id]` | Single inbox item with actions (Send / Cancel / etc.) | notifications + CC for action dispatch |
| `/devices` | Manage Pi Zero nodes | CC `/admin/nodes` (forwarded with JWT) |
| `/settings` | Household-level settings (mirrors what the admin portal does, but scoped to the logged-in user's household) | config-service gateway via CC proxy, or auth `/settings/*` |
| `/settings/household` | Household member + role management | auth `/households/*` |
| `/pantry` | Browse community packages | pantry `/v1/commands` |
| `/pantry/[name]` | Package detail + install | pantry |

All pages are **client components** (`"use client"`) except the layouts. No RSC data fetching today — easier auth-token-in-header pattern via Axios.

---

## Architecture

```
app/
├── layout.tsx              # Root + <Providers>
├── providers.tsx           # QueryClient, AuthProvider, Sonner Toaster
├── page.tsx                # Auth-aware redirect
├── login/        register/        chat/        inbox/        devices/        settings/        pantry/
hooks/
├── useAuth.tsx             # AuthContext — login, refresh, logout, localStorage tokens
└── useChat.ts              # Chat state machine — messages, SSE stream, warmup, tool action dispatch
components/
├── chat/
│   ├── ChatBubble.tsx      # User + assistant message rendering, action buttons
│   ├── ChatInput.tsx       # Composer with Enter-to-send
│   └── QuickActions.tsx    # Empty-state suggestion chips
└── layout/Sidebar.tsx
lib/
├── api.ts                  # Axios instance, auth interceptor, SSE helper, response types
└── utils.ts                # cn() — clsx + tailwind-merge
next.config.ts              # The rewrite map — single source of truth for backend wiring
```

---

## "How to..." recipes

### Add a new page

1. Create `app/<page>/page.tsx` (client component).
2. Add a sidebar link in `components/layout/Sidebar.tsx`.
3. If the page needs auth, wrap with `useAuth()` — the hook handles redirect to `/login` automatically when unauthenticated.

### Hit a new backend service

1. Add a rewrite in `next.config.ts` (`/api/<service>/:path*` → `<SERVICE_URL>/:path*`).
2. Add the env var to `.env.example` with the localhost default.
3. Call from the client via `axios.get('/api/<service>/...')`. The Axios instance in `lib/api.ts` already attaches the JWT.

### Add a new chat feature (e.g. voice recording)

The chat state machine is `hooks/useChat.ts`. It handles:
- `/conversation/start` (warmup)
- `/voice/command` (sync JSON) or `/voice/command/stream` (SSE → reconstruct messages)
- Inbox action dispatch (when an assistant message contains action buttons, clicking POSTs to the relevant CC endpoint)

Add new state transitions there, not in components. The components render from `useChat()` output.

### Style adjustments

Tailwind v4 with CSS custom properties for the dark theme. Tokens match jarvis-admin so the two look consistent. Use `cn()` from `lib/utils.ts` for conditional class merging.

---

## Invariants & gotchas

1. **No backend logic here.** Every business decision lives in a backend service. If you find yourself reaching for `fetch()` to an external API (other than the rewrites), that logic belongs in a backend.
2. **No Next.js API routes today.** All `/api/*` paths are rewrites in `next.config.ts`. If you add a real API route, document why — the convention is to push logic backward.
3. **JWT lives in localStorage, attached via Axios interceptor.** Same pattern as jarvis-admin. The interceptor refreshes on 401 with the refresh token; if that fails, redirect to `/login`. Don't roll your own token storage.
4. **SSE streaming uses `ReadableStream`, not `EventSource`.** EventSource doesn't support custom headers (auth). We need the JWT header, so we use fetch's streaming response body and parse SSE manually. See `lib/api.ts:streamChat`.
5. **`output: "standalone"`** in `next.config.ts` is required for the Docker production build to bundle dependencies. Don't remove.
6. **Tests are Jest** (not Vitest). Be careful with mock paths — `__tests__/__mocks__/` is where global mocks live. Don't mix testing frameworks.
7. **Pantry browsing is unauthenticated** on the backend (rate-limited by IP). Web doesn't need to attach a JWT to `/api/pantry/*` calls — the interceptor still does it harmlessly because pantry ignores unknown headers.
8. **Inbox + chat both consume from notifications.** The chat shows inline action buttons for the *most recent* tool result; the inbox shows the durable record. Keep them in sync — when an inbox action is dispatched from chat, the inbox item should reflect the new status.

---

## Config surface (env)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `7722` | Dev server port |
| `AUTH_URL` | `http://localhost:7701` | jarvis-auth target for rewrites |
| `COMMAND_CENTER_URL` | `http://localhost:7703` | jarvis-command-center target |
| `NOTIFICATIONS_URL` | `http://localhost:7712` | jarvis-notifications target |
| `PANTRY_URL` | `http://localhost:7721` | jarvis-pantry target |

No DB. No settings. Add new URL env vars only when adding a new rewrite.

---

## Tech stack

- **Next.js 16** (App Router, standalone output, TypeScript)
- **React 19** + TanStack Query for server-state caching
- **Tailwind CSS v4** (dark theme, tokens matched to jarvis-admin)
- **Axios** with auth interceptor + token refresh
- **Lucide React** icons, **Sonner** toasts
- **Jest** for tests

---

## Testing

```bash
npm test
```

Tests under `__tests__/`. Mocks in `__tests__/__mocks__/`. Coverage is partial — chat state machine and auth flow are tested; pantry/inbox/devices pages are mostly untested.

---

## Failure modes

| Failure | Behavior |
|---|---|
| Any backend rewrite target down | Calls to that path fail; UI surfaces an error toast; rest of app works |
| Auth down | All authed pages fail; user gets redirected to login (which also fails) |
| CC down | Chat fails; everything else (inbox, pantry, devices, settings) still works |
| JWT expired | Auto-refresh once; if refresh fails, redirect to login |
| SSE stream broken mid-message | Chat shows partial message + error; user can retry |
| LocalStorage cleared | Acts like a fresh login |

---

## Out of scope / explicitly not here

- **Server-side rendering of authenticated content.** All authed pages are client components; auth is checked in `useAuth`.
- **API route logic.** Use rewrites to backend services.
- **State persistence beyond localStorage** (no IndexedDB, no SW caching today).
- **Push notifications in browser.** Push is delivered via the Expo Push flow to the mobile app; the web inbox is poll-based.
- **Offline mode.** Requires a backend; full offline is a non-goal for now.
