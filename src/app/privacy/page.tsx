import Link from "next/link";
import { Logo } from "@/components/logo";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Privacy notice" };

// Plain-language notice for a small private beta among friends. The app owner should review
// and edit it (contact details, hosting region) before sharing the link.
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/login" aria-label={`${APP_NAME} sign in`}>
        <Logo className="text-lg" />
      </Link>
      <article className="mt-6 space-y-4 text-sm leading-6 text-text/90 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text">
        <h1 className="text-2xl font-bold text-text">Privacy notice</h1>
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

        <h2>Who can see it</h2>
        <p>
          Only you. Each account is isolated by database access rules, and other users cannot read or change your data.
          The app owner has administrator access to the database for maintenance and will not look at, share, or sell your
          data.
        </p>

        <h2>Where it lives</h2>
        <p>
          Data is stored with Supabase (database and sign-in) and the app is served by a hosting provider. Both run on
          their free plans, which do not include automatic backups, so keep your own copy of anything important.
        </p>

        <h2>No tracking or ads</h2>
        <p>There are no ads, analytics trackers, or third-party data sales.</p>

        <h2>Deleting your data</h2>
        <p>
          You can delete your account at any time from Profile → Delete account. This permanently removes your account and
          all data you logged.
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
