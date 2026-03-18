# jarvis-web

Next.js web interface for Jarvis — browser-based chat with the command center.

## Quick Reference

```bash
npm install
cp .env.example .env
npm run dev        # http://localhost:7722
npm run build      # Production build
```

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **React 19** + TanStack Query (server state)
- **Tailwind CSS v4** (dark theme, matches jarvis-admin)
- **Axios** (API client with token refresh interceptor)
- **Lucide React** (icons)
- **Sonner** (toasts)

## Architecture

```
app/
├── layout.tsx              # Root layout + providers
├── providers.tsx           # QueryClient + AuthProvider + Toaster
├── page.tsx                # Redirect to /chat or /login
├── login/page.tsx          # Login form
└── chat/page.tsx           # Main chat interface
hooks/
├── useAuth.tsx             # Auth context (login, refresh, localStorage)
└── useChat.ts              # Chat state (messages, SSE streaming, warmup)
components/
├── chat/
│   ├── ChatBubble.tsx      # Message bubbles with action buttons
│   ├── ChatInput.tsx       # Text input with Enter-to-send
│   └── QuickActions.tsx    # Suggestion chips (empty state)
└── layout/
    └── Sidebar.tsx         # Navigation sidebar
lib/
├── api.ts                  # Auth + Chat API client, SSE streaming, types
└── utils.ts                # cn() utility (clsx + tailwind-merge)
```

## API Proxy

Next.js rewrites proxy API calls to backend services:

| Frontend path | Backend destination |
|---|---|
| `/api/auth/*` | `AUTH_URL/auth/*` (jarvis-auth) |
| `/api/cc/*` | `COMMAND_CENTER_URL/api/v0/*` (jarvis-command-center) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 7722 | Dev server port |
| `COMMAND_CENTER_URL` | http://localhost:7703 | Command center backend |
| `AUTH_URL` | http://localhost:7701 | Auth service backend |

## Features

- **SSE streaming** — Real-time response streaming via `ReadableStream`
- **Node selector** — Pick which Pi node to talk to
- **Conversation warmup** — Preemptive tool registration for fast first response
- **Quick action chips** — Suggestion buttons on empty state
- **Action buttons** — Interactive buttons (Send/Cancel for email, etc.)
- **Token refresh** — Automatic 401 retry with refresh token

## Dependencies

**Service Dependencies:**
- ✅ **Required**: `jarvis-auth` (7701) — User login
- ✅ **Required**: `jarvis-command-center` (7703) — Chat API, node tools, warmup

**Used By:**
- End users (web browser)

**Impact if Down:**
- ⚠️ No web chat interface
- ✅ Mobile app and Pi nodes continue to work
- ✅ All backend services continue to work
