import { EQUIPMENT, MUSCLES, type Equipment, type MuscleGroup } from "./catalog";

export type SearchableExercise = {
  name: string;
  muscles: readonly MuscleGroup[];
  equipment: Equipment | null;
};

/** Lowercase, strip accents and punctuation so "pull up", "Pull-Up" and "pullup" compare well. */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const compact = (text: string) => text.replace(/ /g, "");

type Indexed<T> = { item: T; name: string; nameCompact: string; words: string[]; tagWords: string[] };

function index<T extends SearchableExercise>(item: T): Indexed<T> {
  const name = normalize(item.name);
  const tags = item.muscles.flatMap((m) => [normalize(MUSCLES[m]?.label ?? m), ...(MUSCLES[m]?.aliases ?? []).map(normalize)]);
  if (item.equipment) tags.push(normalize(EQUIPMENT[item.equipment] ?? item.equipment));
  return { item, name, nameCompact: compact(name), words: name.split(" "), tagWords: tags.flatMap((t) => t.split(" ")) };
}

/**
 * Live partial search on exercise name and muscle group. Every typed word must match part of
 * the name, or the start of a muscle word (label or everyday alias like "back" or "legs") or
 * equipment word.
 * Results are ranked: name starts with query > a name word starts with a term > name contains
 * the terms > matched only by muscle/equipment. Ties are alphabetical.
 */
export function searchExercises<T extends SearchableExercise>(items: readonly T[], query: string): T[] {
  const q = normalize(query);
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
  if (!q) return sorted;
  const terms = q.split(" ");

  const scored: { item: T; score: number }[] = [];
  for (const entry of sorted.map(index)) {
    const termMatches = terms.map((t) => {
      if (entry.name.includes(t) || entry.nameCompact.includes(t)) return "name" as const;
      // Muscle/equipment words match from the start ("ham" -> hamstrings, but "tri" is not in "hamstrings").
      if (entry.tagWords.some((w) => w.startsWith(t))) return "tag" as const;
      return null;
    });
    if (termMatches.some((m) => m === null)) continue;

    let score: number;
    if (entry.name.startsWith(q) || entry.nameCompact.startsWith(compact(q))) score = 0;
    else if (termMatches.every((m) => m === "name") && terms.some((t) => entry.words.some((w) => w.startsWith(t)))) score = 1;
    else if (termMatches.every((m) => m === "name")) score = 2;
    else if (termMatches.some((m) => m === "name")) score = 3;
    else score = 4;
    scored.push({ item: entry.item, score });
  }
  // Array.prototype.sort is stable, so alphabetical order is kept within each score.
  return scored.sort((a, b) => a.score - b.score).map((s) => s.item);
}
