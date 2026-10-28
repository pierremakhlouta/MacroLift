import { describe, expect, it } from "vitest";
import { bestSet, formatDuration, isLoggedSet, workoutDurationMs, workoutSummary } from "./summary";

describe("workoutDurationMs", () => {
  it("is completed_at minus started_at", () => {
    expect(workoutDurationMs("2026-10-28T10:00:00Z", "2026-10-28T11:05:30Z")).toBe(65.5 * 60_000);
  });

  it("handles missing, invalid and reversed timestamps", () => {
    expect(workoutDurationMs(null, "2026-10-28T11:00:00Z")).toBeNull();
    expect(workoutDurationMs("2026-10-28T10:00:00Z", null)).toBeNull();
    expect(workoutDurationMs("garbage", "2026-10-28T11:00:00Z")).toBeNull();
    expect(workoutDurationMs("2026-10-28T11:00:00Z", "2026-10-28T10:00:00Z")).toBeNull();
    expect(workoutDurationMs("2026-10-28T10:00:00Z", "2026-10-28T10:00:00Z")).toBe(0);
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(30_000)).toBe("< 1 min");
    expect(formatDuration(45 * 60_000)).toBe("45 min");
    expect(formatDuration(65 * 60_000)).toBe("1 h 05 min");
  });
});

describe("workoutSummary", () => {
  const base = { started_at: "2026-10-28T10:00:00Z", completed_at: "2026-10-28T11:00:00Z" };

  it("sums volume only where weight and reps are both known, for external loads", () => {
    const s = workoutSummary({
      ...base,
      exercises: [
        {
          load_type_snapshot: "external",
          sets: [
            { reps: 8, weight_kg: 60 },
            { reps: 8, weight_kg: 62.5 },
            { reps: 6, weight_kg: null }, // unknown weight: logged, but not in volume
            { reps: null, weight_kg: 60 }, // no reps: not logged
            { reps: 0, weight_kg: 60 }, // zero reps: not logged
          ],
        },
      ],
    });
    expect(s.volumeKg).toBe(60 * 8 + 62.5 * 8);
    expect(s.loggedSets).toBe(3);
    expect(s.totalReps).toBe(22);
    expect(s.durationMs).toBe(3_600_000);
  });

  it("never reports bodyweight or assisted work as zero volume", () => {
    const s = workoutSummary({
      ...base,
      exercises: [
        { load_type_snapshot: "bodyweight", sets: [{ reps: 10, weight_kg: null }, { reps: 8, weight_kg: 10 }] },
        { load_type_snapshot: "assisted", sets: [{ reps: 6, weight_kg: 20 }] },
      ],
    });
    expect(s.volumeKg).toBeNull();
    expect(s.bodyweightSets).toBe(3);
    expect(s.loggedSets).toBe(3);
  });

  it("excludes warm-up sets", () => {
    const s = workoutSummary({
      ...base,
      exercises: [{ load_type_snapshot: "external", sets: [{ reps: 10, weight_kg: 20, is_warmup: true }, { reps: 5, weight_kg: 100 }] }],
    });
    expect(s.volumeKg).toBe(500);
    expect(s.loggedSets).toBe(1);
  });

  it("handles an empty workout", () => {
    const s = workoutSummary({ started_at: base.started_at, completed_at: null, exercises: [] });
    expect(s).toEqual({ durationMs: null, exerciseCount: 0, loggedSets: 0, totalReps: 0, volumeKg: null, bodyweightSets: 0 });
  });
});

describe("bestSet", () => {
  it("picks the heaviest set, then most reps", () => {
    expect(bestSet({ load_type_snapshot: "external", sets: [{ reps: 10, weight_kg: 60 }, { reps: 5, weight_kg: 70 }, { reps: 6, weight_kg: 70 }] })).toEqual({ reps: 6, weight_kg: 70 });
  });

  it("picks least assistance for assisted exercises", () => {
    expect(bestSet({ load_type_snapshot: "assisted", sets: [{ reps: 8, weight_kg: 30 }, { reps: 6, weight_kg: 20 }] })).toEqual({ reps: 6, weight_kg: 20 });
  });

  it("ignores unlogged sets", () => {
    expect(bestSet({ load_type_snapshot: "external", sets: [{ reps: null, weight_kg: 100 }] })).toBeNull();
    expect(isLoggedSet({ reps: 1, weight_kg: null })).toBe(true);
  });
});
