import { describe, expect, it } from "vitest";
import { matchesPath, PUBLIC_PATHS, safeNextPath } from "./routes";

describe("safeNextPath", () => {
  it("keeps same-site relative paths", () => {
    expect(safeNextPath("/workouts")).toBe("/workouts");
    expect(safeNextPath("/nutrition?date=2026-10-27")).toBe("/nutrition?date=2026-10-27");
  });

  it("rejects open-redirect attempts", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "evil.com", "javascript:alert(1)", ""]) {
      expect(safeNextPath(bad), bad).toBe("/dashboard");
    }
    expect(safeNextPath(null)).toBe("/dashboard");
  });
});

describe("matchesPath", () => {
  it("matches exact paths and sub-paths only", () => {
    expect(matchesPath("/login", PUBLIC_PATHS)).toBe(true);
    expect(matchesPath("/auth/callback", PUBLIC_PATHS)).toBe(true);
    expect(matchesPath("/loginx", PUBLIC_PATHS)).toBe(false);
    expect(matchesPath("/dashboard", PUBLIC_PATHS)).toBe(false);
  });
});
