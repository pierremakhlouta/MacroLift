import { describe, expect, it } from "vitest";
import { normalize, searchExercises, type SearchableExercise } from "./search";

const LIB: SearchableExercise[] = [
  { name: "Barbell Bench Press", muscles: ["chest", "triceps", "shoulders"], equipment: "barbell" },
  { name: "Incline Dumbbell Press", muscles: ["chest", "shoulders", "triceps"], equipment: "dumbbell" },
  { name: "Bench Dip", muscles: ["triceps"], equipment: "bodyweight" },
  { name: "Lat Pulldown", muscles: ["lats", "biceps"], equipment: "cable" },
  { name: "Pull-Up", muscles: ["lats", "biceps", "upper_back"], equipment: "bodyweight" },
  { name: "Barbell Row", muscles: ["upper_back", "lats", "biceps"], equipment: "barbell" },
  { name: "Romanian Deadlift", muscles: ["hamstrings", "glutes", "lower_back"], equipment: "barbell" },
  { name: "Leg Press", muscles: ["quads", "glutes"], equipment: "machine" },
  { name: "Crunch", muscles: ["abs"], equipment: "bodyweight" },
  { name: "Côte Curl", muscles: ["biceps"], equipment: null },
];

const names = (q: string) => searchExercises(LIB, q).map((e) => e.name);

describe("normalize", () => {
  it("lowercases and strips punctuation and accents", () => {
    expect(normalize("  Pull-Up ")).toBe("pull up");
    expect(normalize("Côte")).toBe("cote");
  });
});

describe("searchExercises", () => {
  it("returns everything alphabetically for an empty query", () => {
    expect(names("")).toEqual([...LIB].map((e) => e.name).sort((a, b) => a.localeCompare(b)));
    expect(names("   ")).toHaveLength(LIB.length);
  });

  it("matches partial names as you type", () => {
    expect(names("ben")).toEqual(["Bench Dip", "Barbell Bench Press"]);
    expect(names("pres")).toEqual(["Barbell Bench Press", "Incline Dumbbell Press", "Leg Press"]);
    expect(names("dead")).toEqual(["Romanian Deadlift"]);
  });

  it("matches regardless of punctuation and spacing", () => {
    expect(names("pull up")).toContain("Pull-Up");
    expect(names("pullup")).toContain("Pull-Up");
    expect(names("pull-u")).toContain("Pull-Up");
  });

  it("matches muscle groups, including partial and everyday words", () => {
    expect(names("lats")).toEqual(["Barbell Row", "Lat Pulldown", "Pull-Up"]);
    expect(names("ham")).toEqual(["Romanian Deadlift"]);
    expect(names("back")).toEqual(["Barbell Row", "Lat Pulldown", "Pull-Up", "Romanian Deadlift"]);
    expect(names("core")).toEqual(["Crunch"]);
    expect(names("legs")).toEqual(["Leg Press", "Romanian Deadlift"]);
  });

  it("ranks name matches above muscle-only matches", () => {
    expect(names("lat")).toEqual(["Lat Pulldown", "Barbell Row", "Pull-Up"]);
    expect(names("tri")).toEqual(["Barbell Bench Press", "Bench Dip", "Incline Dumbbell Press"]);
    const chest = names("chest");
    expect(chest).toEqual(["Barbell Bench Press", "Incline Dumbbell Press"]);
  });

  it("requires every word to match (name + muscle combined)", () => {
    expect(names("barbell back")).toEqual(["Barbell Row", "Romanian Deadlift"]);
    expect(names("press chest")).toEqual(["Barbell Bench Press", "Incline Dumbbell Press"]);
    expect(names("press calves")).toEqual([]);
  });

  it("matches equipment and handles accents", () => {
    expect(names("cable")).toEqual(["Lat Pulldown"]);
    expect(names("cote")).toEqual(["Côte Curl"]);
  });

  it("returns nothing for no match", () => {
    expect(names("zzz")).toEqual([]);
  });
});
