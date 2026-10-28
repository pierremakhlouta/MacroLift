import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { searchUsda, usdaEnabled, UsdaError } = await import("./usda");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("searchUsda", () => {
  it("is disabled without a key and never calls the API", async () => {
    vi.stubEnv("FDC_API_KEY", "");
    const fetchMock = vi.fn();
    expect(usdaEnabled()).toBe(false);
    await expect(searchUsda("rice", "generic", fetchMock)).rejects.toBeInstanceOf(UsdaError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries generic data types and maps the results", async () => {
    vi.stubEnv("FDC_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ foods: [{ fdcId: 7, description: "RICE, WHITE, COOKED", dataType: "SR Legacy", foodNutrients: [{ nutrientId: 1008, unitName: "KCAL", value: 130 }] }] })),
    );
    const foods = await searchUsda("rice", "generic", fetchMock);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("api_key=test-key");
    expect(JSON.parse(init.body)).toMatchObject({ query: "rice", dataType: ["Foundation", "SR Legacy"] });
    expect(foods[0]).toMatchObject({ fdcId: "7", name: "Rice, White, Cooked", calories_kcal: 130, serving_size: 100 });
  });

  it("reports rate limiting and outages as friendly errors", async () => {
    vi.stubEnv("FDC_API_KEY", "k");
    await expect(searchUsda("x", "branded", vi.fn().mockResolvedValue(new Response("", { status: 429 })))).rejects.toMatchObject({ status: 429 });
    await expect(searchUsda("x", "branded", vi.fn().mockResolvedValue(new Response("", { status: 500 })))).rejects.toMatchObject({ status: 502 });
  });
});
