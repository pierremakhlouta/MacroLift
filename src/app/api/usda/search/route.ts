import { NextResponse, type NextRequest } from "next/server";
import { requireUserId } from "@/lib/server/require-user";
import { searchUsda, UsdaError } from "@/lib/server/usda";

// Signed-in users only, so this can't be used as an open proxy for the shared API key.
export async function GET(request: NextRequest) {
  if (!(await requireUserId())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const kind = request.nextUrl.searchParams.get("kind") === "branded" ? "branded" : "generic";
  if (q.length < 2 || q.length > 100) {
    return NextResponse.json({ error: "Enter 2–100 characters" }, { status: 400 });
  }

  try {
    const foods = await searchUsda(q, kind);
    return NextResponse.json({ foods }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    if (e instanceof UsdaError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "USDA search is unavailable right now." }, { status: 502 });
  }
}
