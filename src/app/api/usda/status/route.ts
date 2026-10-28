import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/server/require-user";
import { usdaEnabled } from "@/lib/server/usda";

export async function GET() {
  if (!(await requireUserId())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ enabled: usdaEnabled() });
}
