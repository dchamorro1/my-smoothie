# my-smoothie

A plant-based smoothie recommendation app. Users log in (or continue as a guest), and the app recommends smoothie ingredients based on their active plants.

## Architecture

```
apps/
  api/      — FastAPI backend (Python)
  mobile/   — Expo React Native frontend (TypeScript)
```

**Auth:** Supabase handles all authentication (email/password + anonymous guest login). The mobile app gets a JWT from Supabase and sends it as a Bearer token on every API request.

**Backend:** FastAPI verifies the JWT via middleware (`apps/api/app/middleware/auth.py`), extracts the `user_id`, and attaches it to `request.state.user_id` for routes to use.

**Database:** Supabase (Postgres). The backend reads from it via the `supabase-py` client.

## Running locally

See [.claude/skills/run/SKILL.md](.claude/skills/run/SKILL.md) for full instructions. Short version:

- **Backend:** `cd apps/api && uvicorn main:app --reload` (port 8000)
- **Mobile:** `cd apps/mobile && npx expo start` (then press `i` / `a` or scan QR)

Run both simultaneously in two terminals.

## Key gotcha — mobile API URL

The mobile app resolves the backend URL at runtime in `apps/mobile/src/services/auth.ts`:

- Android emulator → `http://10.0.2.2:8000`
- iOS / physical device → hardcoded LAN IP `192.168.1.70:8000`

**If you're on a different machine or network**, update that IP to match your machine's LAN IP:
```bash
ipconfig getifaddr en0
```

Or set `EXPO_PUBLIC_API_URL` in a `.env` file inside `apps/mobile/`.

## Environment variables

Backend reads from `apps/api/.env`:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
```

These are not committed. Get them from the Supabase project dashboard under Project Settings → API.

## API routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth required) |
| GET | `/api/user-active-plants/` | Count of user's active plants |
| POST | `/api/recommendations/` | Get smoothie recommendations (stub — not yet implemented) |

All routes except `/health`, `/docs`, `/openapi.json`, `/redoc` require a valid Supabase JWT.

## Project structure

```
apps/api/
  main.py                          — FastAPI app entry point
  app/
    config.py                      — Pydantic settings (reads .env)
    middleware/auth.py             — JWT verification middleware
    routes/
      recommendations.py           — Recommendation endpoint (TODO: implement logic)
      user_active_plants.py        — Active plants count endpoint
    services/
      recommendations.py           — Recommendation business logic
      calculate_current_user_active_plants.py
    schemas/recommendations.py    — Pydantic request/response models
    utils/supabase.py              — Supabase client helper

apps/mobile/
  App.tsx                          — Root component, session/auth state machine
  src/
    screens/
      WelcomeScreen.tsx            — Landing page (guest or sign in)
      SignInScreen.tsx             — Email/password sign in
      MyActiveIngredients.tsx      — Main screen after login
    services/auth.ts               — Auth functions + backend API calls
    components/welcome/            — Decorative UI components for welcome screen
    i18n/                          — Internationalization setup
```
