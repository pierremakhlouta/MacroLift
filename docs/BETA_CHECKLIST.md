# Private-beta readiness checklist

✅ = done and verified in the repo. ☐ = for the app owner to do (needs a dashboard, an account or a decision).

## Security and privacy
- ✅ Row Level Security on every table; cross-account isolation tested in pgTAP (`npm run test:db`) and
  against the real API with two users (`npm run test:integration`).
- ✅ Anonymous users have no table grants; built-in exercises are read-only for everyone.
- ✅ No secret or service-role key in the app; the browser uses the publishable key only, and a secret key
  in the public variable is rejected at startup.
- ✅ `FDC_API_KEY` is read only on the server; USDA routes require a signed-in user.
- ✅ `.env*` files are git-ignored; `.env.example` holds placeholders only.
- ✅ Security headers: frame blocking, `nosniff`, referrer policy, permissions policy, no `X-Powered-By`.
- ✅ Account deletion removes the auth user and cascades every personal row (tested).
- ✅ Sign-out clears locally cached data; an unsynced workout survives an expired session for the same user.
- ☐ Review `/privacy`: add your contact details and hosting region (marked in the page source).
- ☐ Turn on **Confirm email**, password rules and **Secure password change** in the hosted project
  (see `docs/DEPLOYMENT.md` §2).

## Data integrity
- ✅ Values stored canonically (kg, cm); unit switching never rewrites data.
- ✅ Diary entries and workout sets store snapshots; editing foods, exercises or routines never changes history.
- ✅ Targets are effective-dated; a new target keeps past days' comparisons, and editing an older one warns first.
- ✅ The maintenance estimate is display-only: no code path writes it to targets (tested).
- ✅ Unknown nutrients stay unknown; partial totals are marked "≥".
- ✅ Workout logging keeps working offline, syncs idempotently, and surfaces conflicts instead of overwriting.
- ☐ Decide on a backup routine (Free has none): `docs/DEPLOYMENT.md` §7.

## Accessibility and devices (WCAG 2.2 AA target)
- ✅ axe checks (WCAG 2.0/2.1/2.2 A and AA rules) pass on every page and the main dialogs, at 360, 768 and 1280 px.
- ✅ No horizontal scrolling at 360 px; touch targets ≥ 44 px on primary controls.
- ✅ Skip link, visible focus, labelled fields, errors tied to fields, status not shown by colour alone.
- ✅ Chart has keyboard reading and a full table alternative.
- ☐ Manual pass with VoiceOver on an iPhone and TalkBack on Android. Automated checks can't catch everything.
- ☐ Try 200% text zoom on a phone.

## Email and sign-in
- ☐ Brevo SMTP configured and a confirmation and reset email received in Gmail **and** another provider,
  checking spam folders (§3).
- ☐ Google OAuth app in **Testing** mode with each tester added (§4), or leave Google off.
- ☐ Supabase Site URL and redirect URLs point at the production URL only.

## Operations
- ☐ Migrations applied with `npx supabase db push`; all tables show RLS enabled.
- ☐ Vercel environment variables set (§5); `FDC_API_KEY` is not prefixed `NEXT_PUBLIC_`.
- ☐ Phone smoke test after deploy (sign up → onboarding → workout → food → weight → sign out).
- ☐ Tell testers: it's a hobby project on free plans, there are no backups, and it isn't medical advice.
- ☐ Keep the beta small and non-commercial (Vercel Hobby terms).

## Known limitations to tell testers
- No data export yet; ask the owner for a copy.
- Workout recovery covers a lost connection or a closed tab on the same device and browser, not another device.
- USDA search depends on a shared hourly limit; foods you add are copied, so the diary never depends on it.
- A paused Supabase project (after a week without use) needs a manual restore before it works again.
