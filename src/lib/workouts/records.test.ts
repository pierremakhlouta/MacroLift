import { describe, expect, it } from "vitest";
import { exerciseBest, type PastExercise } from "./records";

const day = (d: number) => `2026-11-0${d}T10:00:00Z`;

describe("exerciseBest", () => {
  it("is null without history", () => {
    expect(exerciseBest([], "external")).toBeNull();
  });

  it("is the heaviest set ever, from any workout, then most reps", () => {
    const past: PastExercise[] = [
      { started_at: day(5), load_type_snapshot: "external", sets: [{ reps: 8, weight_kg: 60 }, { reps: 6, weight_kg: 65 }] },
      { started_at: day(1), load_type_snapshot: "external", sets: [{ reps: 5, weight_kg: 80 }, { reps: 8, weight_kg: 70 }] },
      { started_at: day(3), load_type_snapshot: "external", sets: [{ reps: 3, weight_kg: 80 }] },
    ];
    expect(exerciseBest(past, "external")).toEqual({ set: { reps: 5, weight_kg: 80 }, date: day(1) });
  });

  it("a tie keeps the date it was first reached", () => {
    const past: PastExercise[] = [
      { started_at: day(4), load_type_snapshot: "external", sets: [{ reps: 5, weight_kg: 80 }] },
      { started_at: day(2), load_type_snapshot: "external", sets: [{ reps: 5, weight_kg: 80 }] },
    ];
    expect(exerciseBest(past, "external")?.date).toBe(day(2));
  });

  it("ignores warm-ups, unlogged sets and workouts logged a different way", () => {
    const past: PastExercise[] = [
      { started_at: day(6), load_type_snapshot: "external", sets: [{ reps: 10, weight_kg: 100, is_warmup: true }, { reps: null, weight_kg: 90 }] },
      { started_at: day(5), load_type_snapshot: "bodyweight", sets: [{ reps: 10, weight_kg: 200 }] },
      { started_at: day(2), load_type_snapshot: "external", sets: [{ reps: 8, weight_kg: 50 }] },
    ];
    expect(exerciseBest(past, "external")).toEqual({ set: { reps: 8, weight_kg: 50 }, date: day(2) });
  });

  it("cardio uses the longest distance", () => {
    const past: PastExercise[] = [
      { started_at: day(1), load_type_snapshot: "cardio", sets: [{ reps: null, weight_kg: null, distance_m: 8000, duration_seconds: 2700 }] },
      { started_at: day(3), load_type_snapshot: "cardio", sets: [{ reps: null, weight_kg: null, distance_m: 5000, duration_seconds: 1500 }] },
    ];
    expect(exerciseBest(past, "cardio")?.set.distance_m).toBe(8000);
  });
});
