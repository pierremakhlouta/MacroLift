import Link from "next/link";
import { Logo } from "@/components/logo";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Privacy notice" };

// Plain-language notice for a small private beta among friends.
// OWNER TODO before sharing: replace CONTACT and HOSTING_REGION below.
const CONTACT = "the person who invited you";
const HOSTING_REGION = "the Americas";
const LAST_UPDATED = "28 October 2026";
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/login" aria-label={`${APP_NAME} sign in`}>
        <Logo className="text-lg" />
      </Link>
      <article className="mt-6 space-y-4 text-sm leading-6 text-text/90 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text">
        <h1 className="text-2xl font-bold text-text">Privacy notice</h1>
        <p className="text-muted">Last updated {LAST_UPDATED}.</p>
        <p className="text-muted">
          {APP_NAME} is a personal hobby project shared with friends and family. It is not a commercial service and not
          a medical service.
        </p>

        <h2>What we store</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your email address and sign-in details (passwords are stored hashed by the auth provider; Google sign-in shares your name and email).</li>
          <li>What you choose to log: workouts, routines, custom exercises and foods, meals, food diary, nutrition targets, body weight and measurements.</li>
          <li>Optional estimate details: date of birth, height, activity level, and the formula coefficient you choose.</li>
          <li>While a workout is in progress, a temporary copy is kept in your browser so it can be recovered after a lost connection. It is cleared when you sign out.</li>
        </ul>

        <h2>Why we store it</h2>
        <p>
          Only to run the app for you: sign you in, save what you log, and show your history, totals, and estimates. Your
          data isn&apos;t used for anything else.
        </p>

        <h2>Who can see it</h2>
        <p>
          Only you. Each account is isolated by database access rules, and other users cannot read or change your data.
          The app owner has administrator access to the database for maintenance and will not look at, share, or sell your
          data.
        </p>

        <h2>Services involved</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Supabase</strong> stores your account and data (hosted in {HOSTING_REGION}).</li>
          <li><strong>Vercel</strong> serves the app and sees normal web request information such as IP addresses.</li>
          <li><strong>Brevo</strong> sends sign-up and password-reset emails, so it receives your email address.</li>
          <li><strong>Google</strong>, only if you choose “Continue with Google”.</li>
          <li>
            <strong>USDA FoodData Central</strong>, only if you use USDA food search: the app&apos;s server sends your search
            words, never your identity.
          </li>
        </ul>
        <p>
          All run on free plans, which don&apos;t include automatic backups, so keep your own copy of anything important.
        </p>

        <h2>Cookies and browser storage</h2>
        <p>
          Only what&apos;s needed to keep you signed in, plus browser storage for in-progress workouts.
          No advertising or analytics cookies.
        </p>

        <h2>No tracking or ads</h2>
        <p>There are no ads, analytics trackers, or third-party data sales.</p>

        <h2>Deleting your data</h2>
        <p>
          You can delete your account at any time from Profile → Delete account. This permanently removes your account and
          all data you logged. Any copy the owner made as a backup is deleted the next time backups are replaced. For a copy of
          your data or any question, contact {CONTACT}.
        </p>

        <h2>Not medical advice</h2>
        <p>
          Calorie estimates are general formula-based estimates, not medical or dietary advice. Talk to a qualified
          professional about your health.
        </p>

        <p className="pt-4">
          <Link href="/login" className="text-accent underline underline-offset-4">
            Back to {APP_NAME}
          </Link>
        </p>
      </article>
    </main>
  );
}
