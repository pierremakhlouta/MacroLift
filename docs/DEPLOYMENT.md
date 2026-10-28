# Deployment notes (Vercel Hobby + Supabase Free)

These are the steps for the app owner to run by hand. Nothing in this repository deploys,
creates accounts, or enters billing details automatically. Every service below can be used without a
payment method; if any screen asks for one, stop: a paid feature has been selected by mistake.

## Free-tier facts this setup relies on

Checked on **2026-10-27**. Plans change, so re-check the linked pages before going live.

| Provider | What we rely on | Source |
| --- | --- | --- |
| Supabase Free | 2 projects, 500 MB database, 50,000 monthly active users, Google sign-in included. **Pauses after 1 week without activity. No automatic backups.** | https://supabase.com/pricing |
| Supabase built-in email | Only delivers to members of your Supabase organisation (since 26 Sep 2024), so friends can't receive confirmation emails without custom SMTP. | https://supabase.com/docs/guides/auth/auth-smtp |
| Supabase email templates | New free projects can't edit templates (changelog, June 2026). The default templates work with this app's `/auth/callback` (PKCE) flow, so no edits are needed. | https://supabase.com/changelog |
| Vercel Hobby | $0, **personal and non-commercial use only**. | https://vercel.com/pricing |
| Brevo Free | 300 emails per day over SMTP. | https://www.brevo.com/pricing/ |
| USDA FoodData Central (optional) | Free API key, 1,000 requests per hour per IP, public-domain (CC0) data. | https://fdc.nal.usda.gov/api-guide |

## 1. Create the Supabase project

1. At https://supabase.com/dashboard, create a project on the **Free** plan. Pick the region closest
   to your users and save the database password in a password manager.
2. From this repo, link it and apply the migrations (this is the only way the schema and security rules
   get created; don't create tables by hand):
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push          # applies everything in supabase/migrations/
   ```
3. Check: **Database → Tables** shows every table with the "RLS enabled" badge.
4. **Project Settings → API Keys**: copy the project URL and the **publishable** key (`sb_publishable_…`).
   Never copy the secret key anywhere in this project; the app doesn't use it.

## 2. Auth settings (mirror `supabase/config.toml`)

Under **Authentication**:

- **Sign In / Providers → Email**: email provider on, **Confirm email** on, **Secure password change** on.
- **Password requirements**: minimum length **8**, **letters and digits**. (The app's form checks match this.)
- **URL Configuration**:
  - Site URL: `https://<your-app>.vercel.app`
  - Redirect URLs: `https://<your-app>.vercel.app/**` (add `http://localhost:3000/**` only if you
    point local dev at the hosted project). Don't add a wildcard for every Vercel preview URL.

## 3. Email via Brevo SMTP (needed for sign-up confirmations and password resets)

1. Create a free Brevo account at https://www.brevo.com.
2. **Senders, Domains & Dedicated IPs → Senders**: add the address emails will come from and confirm
   the verification email.
   > **Not yet verified by me:** whether a free Gmail address works reliably as a sender. Other
   > sources say Brevo accepts a verified single sender without a custom domain, but mail "from"
   > `@gmail.com` sent through a third party may be filtered to spam because of Gmail's DMARC
   > policy. Send yourself a test before inviting anyone. A custom domain fixes this but costs
   > money, so it's out of scope.
3. **SMTP & API → SMTP**: note the server (`smtp-relay.brevo.com`), port `587` and your SMTP
   login, then **Generate a new SMTP key** (Standard variant, longest expiry). Treat the key as a password.
   > **The key expires** on its expiry date (max 1 year) and also after **90 days without any email
   > sent**. When it does, sign-up and password-reset emails silently stop. Fix: generate a new key and
   > paste it into Supabase's SMTP password field. Put a calendar reminder a few weeks before the expiry date.
4. In Supabase, **Authentication → Emails → SMTP Settings**, turn on custom SMTP:
   - Sender email: the verified sender. Sender name: `MacroLift`.
   - Host `smtp-relay.brevo.com`, port `587`, username = Brevo SMTP login, password = the SMTP key.
5. **Authentication → Rate Limits**: after custom SMTP is on, the email limit can be raised. Keep it well
   under Brevo's 300/day (for example 30 per hour).
6. Test: sign up with a second address of your own, confirm, then try **Forgot password**.

## 4. Google sign-in (optional)

1. In Google Cloud Console (https://console.cloud.google.com), create a project. No billing account is
   needed for OAuth.
2. **Google Auth Platform → Branding / Audience**: user type **External**, publishing status
   **Testing**, and add each beta tester's Google address as a test user (up to 100). Scopes: `email`,
   `profile`, `openid` only.
3. **Clients → Create client → Web application**:
   - Authorized JavaScript origins: `https://<your-app>.vercel.app`
   - Authorized redirect URIs: `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. In Supabase, **Authentication → Sign In / Providers → Google**: enable it, then paste the client ID and secret.
5. Set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` in Vercel (step 5) so the Google button appears.

## 5. Deploy on Vercel Hobby

1. At https://vercel.com, sign in with GitHub and **Add New → Project → Import** `MacroLift`.
   Framework preset: Next.js; leave the build settings at their defaults.
2. **Environment Variables** (Production):

   | Name | Value | Browser-visible? |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | yes (safe) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | yes (safe; RLS protects data) |
   | `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | `true` or `false` | yes |
   | `FDC_API_KEY` | your USDA key (optional) | **no**, server-only; never prefix with `NEXT_PUBLIC_` |

   The app refuses to start if a `sb_secret_…` key is put in the public key variable.
3. Deploy, then put the final `*.vercel.app` URL into the Supabase Site URL and Redirect URLs, and into the
   Google origins, if you hadn't already.
4. Smoke test on a phone: sign up, confirm the email, finish onboarding, log a set, log a food, log a
   weight, then sign out and back in.

## 6. USDA food search (optional)

Request a free key at https://fdc.nal.usda.gov/api-key-signup and add it as `FDC_API_KEY` in Vercel.
Without it, the USDA tab is hidden and everything else works. Searches go from the server to USDA with
only the search text; no user identity is sent.

## 7. Running it on free tiers

- **Pausing:** a project with no activity for a week is paused. Restore it from the Supabase dashboard
  (data is kept). Regular use by testers prevents this.
- **Backups:** there are none on Free. Take your own periodically (it asks for the database password):
  ```bash
  npx supabase db dump --linked -f backup-schema.sql
  npx supabase db dump --linked --data-only -f backup-data.sql
  ```
  Keep the dumps somewhere private: they contain everyone's data.
- **Schema changes:** add a migration, test locally (`npm run db:reset && npm run test:db`), then
  `npx supabase db push`.
- **Usage:** check **Organization → Usage** in Supabase and **Usage** in Vercel now and then. Hobby and
  Free stop or throttle at their limits instead of charging.
