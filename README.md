# MacroLift

A phone-first web app for strength training, body tracking, and nutrition logging. Each person has a
private account. Built with Next.js 16, TypeScript, Tailwind CSS 4, and Supabase Auth and PostgreSQL,
on free tiers only.

## Features

- **Workouts:** a library of 81 built-in exercises plus your own, live search, and routines with target sets and
  rep ranges. Cardio (treadmill, bike, rowing…) is logged as distance and time instead of weight and reps. Active-workout logging autosaves on the device, works through dropped connections,
  resumes after a closed tab, and syncs with conflict detection. History shows sets, reps and volume.
- **Nutrition:**
  - A daily diary by meal, with saved foods (or optional USDA FoodData Central search) and saved meals.
  - Quick add and an undo after deletes.
  - Unknown nutrients stay *unknown* (never counted as 0), and partial totals are marked "≥".
- **Targets:** your own calorie and macro targets, effective-dated so past days keep the target they had.
  Exercise calories are never added to or subtracted from the budget.
- **Maintenance estimate:** Mifflin–St Jeor × activity factor, with every input and step shown.
  - The male (+5) or female (−161) coefficient is an explicit choice, never inferred.
  - It is display-only and never sets a target.
- **Progress:** weigh-ins and body measurements, an accessible trend chart (keyboard and table) and period changes. No BMI.
- Metric or imperial units (stored canonically in kg/cm), dark theme, and WCAG 2.2 AA checks at 360, 768 and 1280 px.

## Local development

Prerequisites: Node 22+, Docker Desktop running.

```bash
npm install
npm run db:start              # local Supabase (Postgres, Auth, Mailpit) in Docker
cp .env.example .env.local    # then paste API_URL and PUBLISHABLE_KEY from `npx supabase status`
npm run dev                   # http://localhost:3000
```

Local emails (sign-up confirmation, password reset) are caught by Mailpit at http://127.0.0.1:54324.
Supabase Studio is at http://127.0.0.1:54323.

## Tests

| Command | What it covers |
| --- | --- |
| `npm test` | Unit tests: units, parsing, dates, validation, nutrition totals, maintenance formula, workout sync, chart ticks |
| `npm run test:db` | pgTAP: RLS cross-account isolation for every table, constraints, snapshots, sync and diary RPCs, account deletion |
| `npm run test:integration` | Real API calls with two signed-in users: isolation, auth, idempotent sync, snapshots |
| `npm run test:e2e` | Playwright on phone, tablet and desktop: every user flow, axe accessibility checks, layout, keyboard, security headers |
| `npm run db:reset` | Rebuilds the local DB from empty by applying all migrations |

Integration and E2E tests require the local Supabase stack and refuse to run against a non-local URL.
After `npm run db:reset`, give the services a few seconds (until `npx supabase status` responds)
before running integration tests, or the first requests can fail while the API reloads.

## Architecture notes

- **The database is the security boundary.**
  - The browser talks to Supabase with the publishable key, and Row Level Security restricts every row to `auth.uid()`.
  - Child tables also check the parent's owner and use composite foreign keys `(parent_id, user_id)`.
  - The app uses no service-role or secret key.
- Multi-row writes go through `SECURITY INVOKER` functions, so RLS still applies: `save_routine`,
  `sync_workout` (revision-checked), `add_diary_entries` (server-side snapshots) and `save_meal_template`.
- `src/proxy.ts` (Next 16's renamed middleware) refreshes the session cookie and does optimistic redirects.
- `/auth/callback` completes Google OAuth, email confirmation and password-recovery links (PKCE).
- Workout and diary history store snapshots, so editing an exercise, routine or food never rewrites the past.
- Account deletion (`delete_my_account()`) deletes the auth user, and every personal row cascades.

## Docs

- [Deployment notes](docs/DEPLOYMENT.md): Vercel Hobby, Supabase Free, Brevo SMTP, Google OAuth, USDA key, and free-tier facts with sources
- [Private-beta checklist](docs/BETA_CHECKLIST.md)

## Database changes

Add a new file in `supabase/migrations/`, then run `npm run db:reset && npm run db:types && npm run test:db`.
