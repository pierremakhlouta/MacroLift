import { redirect } from "next/navigation";

// The proxy normally handles "/" (signed in -> dashboard, otherwise -> login).
export default function Home() {
  redirect("/dashboard");
}
