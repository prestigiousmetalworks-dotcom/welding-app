# DimeVision — Tech Stack & Architecture

## Stack

| Layer | Technology | Purpose |
|---|---|---|
| Mobile | React Native (Expo) + TypeScript | iOS and Android app |
| Navigation | Expo Router | File-based routing |
| Styling | NativeWind (Tailwind for RN) | Brand-consistent UI |
| Backend / DB | Supabase | Postgres, auth, storage, edge functions |
| AI Vision | Anthropic Claude API | Weld photo analysis |
| Scoring Engine | Python (Supabase Edge Function) | 1–100 score calculation |
| Media Storage | Supabase Storage | Weld photo/video uploads |
| Auth | Supabase Auth | Email, Apple, Google sign-in |

---

## How the pieces connect

```
┌─────────────────────────────────────────┐
│            Mobile App (Expo)            │
│                                         │
│  Analyze  Machine  Progress  Community  │
│  ───────  ───────  ────────  ─────────  │
│     │        │        │          │      │
└─────┼────────┼────────┼──────────┼──────┘
      │        │        │          │
      ▼        ▼        ▼          ▼
┌─────────────────────────────────────────┐
│         Supabase (Backend)              │
│                                         │
│  Auth ──── Postgres DB ──── Storage     │
│              │                │         │
│         Edge Functions    Weld photos   │
│              │            & videos      │
│              ▼                          │
│       Claude API (Anthropic)            │
│       Weld vision + scoring             │
└─────────────────────────────────────────┘
```

---

## Request flow — weld analysis

```
1. User taps Analyze, captures photo
2. App uploads photo → Supabase Storage
3. App calls Edge Function: analyze_weld(session_id)
4. Edge Function:
     a. Fetches photo URL from Storage
     b. Calls Claude API with CWI rubric prompt
     c. Claude returns raw_scores + defects + process_detection
     d. Scoring engine calculates 1–100 total
     e. Writes weld_session + weld_score + weld_score_dimension
        + weld_defect_finding rows to Postgres
5. App polls / subscribes (Supabase Realtime) for scored status
6. Score screen renders with total, grade, dimension breakdown, defects
```

---

## Project folder structure

```
welding-app/
├── mobile/                  # Expo React Native app
│   ├── app/                 # Expo Router screens
│   │   ├── (tabs)/
│   │   │   ├── analyze.tsx
│   │   │   ├── machine.tsx
│   │   │   ├── progress.tsx
│   │   │   └── community.tsx
│   │   ├── weld/[id].tsx    # Weld detail view
│   │   ├── profile/[id].tsx
│   │   └── _layout.tsx
│   ├── components/          # Shared UI components
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client
│   │   └── api.ts           # Typed API calls
│   └── assets/              # Fonts, icons, brand assets
│
├── supabase/
│   ├── functions/           # Edge Functions (Deno / TypeScript)
│   │   ├── analyze-weld/    # Vision + scoring pipeline
│   │   └── machine-settings/ # Settings assistant
│   └── migrations/          # DB migrations (schema files go here)
│
├── scoring/                 # Python scoring engine (source of truth)
│   ├── engine.py
│   ├── vision.py
│   └── analyze.py
│
└── db/
    └── schema_weld_scoring.sql
```

---

## Auth flows

| Method | iOS | Android |
|---|---|---|
| Email / password | Yes | Yes |
| Sign in with Apple | Yes (required for App Store) | No |
| Sign in with Google | Yes | Yes |

Supabase Auth handles all three. The mobile app uses `@supabase/supabase-js` with Expo's secure storage for session tokens.

---

## Environment variables

```
# Mobile app (.env)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# Supabase Edge Functions (set in Supabase dashboard)
ANTHROPIC_API_KEY=
```

---

## Scaling path

| Phase | Trigger | Change |
|---|---|---|
| Launch | 0–10k users | Supabase free tier, Claude for vision |
| Growth | 10k–100k users | Upgrade Supabase plan, add caching |
| Scale | 100k+ users | Fine-tune custom vision model, swap out Claude |

The scoring engine output contract stays the same through all phases —
`engine.py` is untouched when the vision model is swapped.
