import "server-only";

import { mapFdcFood, type FdcFood, type UsdaFood } from "@/lib/nutrition/usda";

// Server-side USDA FoodData Central client. The API key (free, from data.gov) lives only in the
// server environment as FDC_API_KEY and is never sent to the browser.
const FDC_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";

export const usdaEnabled = () => Boolean(process.env.FDC_API_KEY);

export type UsdaSearchKind = "generic" | "branded";

export class UsdaError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function searchUsda(query: string, kind: UsdaSearchKind, fetchImpl: typeof fetch = fetch): Promise<UsdaFood[]> {
  const key = process.env.FDC_API_KEY;
  if (!key) throw new UsdaError("USDA search is not configured", 503);
  const res = await fetchImpl(`${FDC_URL}?api_key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      pageSize: 20,
      dataType: kind === "branded" ? ["Branded"] : ["Foundation", "SR Legacy"],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 429) throw new UsdaError("USDA search is busy right now. Try again in a little while.", 429);
  if (!res.ok) throw new UsdaError("USDA search is unavailable right now.", 502);
  const body = (await res.json()) as { foods?: FdcFood[] };
  return (body.foods ?? []).map(mapFdcFood);
}
