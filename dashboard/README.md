# Watch Guard — Mission Control Dashboard (Next.js)

## Overview
Real-time fleet monitoring dashboard for the Watch Guard lab system.
Built with **Next.js 15 App Router**, **Tailwind CSS**, and **Supabase Realtime**.

## Architecture
```
dashboard/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── layout.tsx        # Root layout (Inter font, metadata)
│   │   ├── page.tsx          # / → Fleet dashboard
│   │   └── globals.css       # Global styles + Tailwind directives
│   ├── components/
│   │   ├── MachineCard.tsx   # Per-machine status card with flash state
│   │   ├── StatusBadge.tsx   # Semantic status pill
│   │   ├── AnomalyOverlay.tsx# Canvas bounding-box renderer
│   │   ├── FleetGrid.tsx     # Adaptive responsive grid
│   │   ├── ConnectionBanner.tsx # Reconnecting / offline banner
│   │   └── SummaryBar.tsx    # Fleet totals header row
│   ├── hooks/
│   │   ├── useRealtimeFleet.ts  # Supabase channel subscription
│   │   └── useWebSocket.ts      # Fallback: direct WS to backend
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client singleton
│   │   └── utils.ts          # cn(), formatters
│   └── types/
│       └── machine.ts        # Shared TypeScript interfaces
```

## Setup

### 1. Install dependencies
```bash
cd dashboard
pnpm install
```

### 2. Configure environment
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
# Supabase (create project at https://supabase.com)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Watch Guard backend (default: localhost:3001)
NEXT_PUBLIC_WG_WS_URL=ws://localhost:3001
NEXT_PUBLIC_WG_API_URL=http://localhost:3001
```

### 3. Run dev server
```bash
pnpm dev        # → http://localhost:3030
```

### 4. Production (Vercel)
Push the `dashboard/` directory as the Vercel root, or configure:
```
Root Directory: dashboard
Build Command:  pnpm build
Output:         .next
```

## Realtime Strategy
- **Primary:** Supabase Realtime `channel` subscription.
  The backend broadcasts to table `machine_events` via Postgres triggers.
- **Fallback:** Direct WebSocket to `ws://localhost:3001` (the existing `ws` server).
  The hook auto-switches when Supabase is unconfigured.

## Alert Logic
A card enters **flashing red state** when `confirmation_streak >= confirmation_target`
(default: 3 consecutive `needs_attention` frames). The state is automatically
cleared when `machine_status` returns to `idle` or `printing`.

