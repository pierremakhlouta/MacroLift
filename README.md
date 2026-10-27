# MacroLift

A phone-first web app for strength training, body-weight tracking, and nutrition logging.
Each person has their own private account. Built with Next.js 16, TypeScript, Tailwind CSS 4,
Supabase Auth and PostgreSQL (free tiers only).

## Local development

Prerequisites: Node 22+, Docker Desktop running.

```bash
npm install
npm run db:start              # starts local Supabase (Postgres, Auth, Mailpit) in Docker
cp .env.example .env.local    # then paste API_URL and PUBLISHABLE_KEY from `npx supabase status`
npm run dev                   # http://localhost:3000
```

Local emails (sign-up confirmation, password reset) are caught by Mailpit at http://127.0.0.1:54324.
Supabase Studio is at http://127.0.0.1:54323.

## Tests

| Command | What it covers |
| --- | --- |
| `npm test` | Unit tests: unit conversion, parsing, dates, validation, redirect safety |
| `npm run test:db` | pgTAP: RLS cross-account isolation for every table, constraints, snapshots, account deletion |
| `npm run test:integration` | Real API calls with two signed-in users: isolation, auth, profile, idempotent upserts |
| `npm run test:e2e` | Playwright: sign-up + email confirm, onboarding, password reset, delete account, sign-out data clearing, axe accessibility, 360/768/1280 px layouts, keyboard |
| `npm run db:reset` | Rebuilds the local DB from an empty state by applying all migrations |

Integration and E2E tests require the local Supabase stack and refuse to run against a non-local URL.

## Architecture notes

- **Security boundary is the database.** The browser talks to Supabase with the publishable key; Row
  Level Security restricts every row to `auth.uid()`. Child tables also check the parent's owner and use
  composite foreign keys `(parent_id, user_id)`. No service-role/secret key is used by the app.
- `src/proxy.ts` (Next 16's renamed middleware) refreshes the session cookie and does optimistic redirects.
- `/auth/callback` completes Google OAuth, email confirmation, and password-recovery links (PKCE).
- Values are stored in kg/cm and converted for display (`src/lib/units.ts`). `NULL` nutrients mean unknown.
- Workout and diary history store snapshots, so editing an exercise, routine, or food never rewrites the past.
- Account deletion (`delete_my_account()`) deletes the auth user; every personal row cascades.

## Database changes

Add a new file in `supabase/migrations/`, then `npm run db:reset && npm run db:types && npm run test:db`.
