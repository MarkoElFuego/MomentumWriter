import { describe, expect, it } from "vitest";
import type { StoryMemory } from "@/lib/db/schema";
import { initialOf, showsMemory, splitItem, visibleItems } from "./memoryItem";

describe("splitItem", () => {
  it.each([
    ["Lokusta — otrovačica iz Galije", "Lokusta", "otrovačica iz Galije"],
    ["Galija: Lokustino poreklo", "Galija", "Lokustino poreklo"],
    ["Klaudije", "Klaudije", ""],
    ["Jean-Luc — prijatelj", "Jean-Luc", "prijatelj"],
    ["Agripina Mlađa – Neronova majka", "Agripina Mlađa", "Neronova majka"],
    ["  Neron - car  ", "Neron", "car"],
  ])("%s", (text, name, desc) => {
    expect(splitItem(text)).toEqual({ name, desc });
  });
});

describe("initialOf", () => {
  it.each([
    ["Ljubica", "Lj"],
    ["Džonatan", "Dž"],
    ["Njegoš", "Nj"],
    ["LJUBICA", "Lj"],
    ["Đorđe", "Đ"],
    ["ana", "A"],
    ["Lokusta", "L"],
    ["Nada", "N"],
  ])("%s → %s", (name, initial) => {
    expect(initialOf(name)).toBe(initial);
  });
});

describe("showsMemory", () => {
  const memory = (characters: number): StoryMemory => ({
    bookId: "b",
    updatedAt: 0,
    characters: Array.from({ length: characters }, (_, i) => ({ id: `c${i}`, text: "Ana", source: "user", pinned: true })),
    places: [],
    openThreads: [],
  });

  it("an empty new book: only Srce knjige", () => {
    expect(showsMemory(false, null)).toBe(false);
    expect(showsMemory(false, memory(0))).toBe(false);
  });

  it("text or a single remembered item brings the lists", () => {
    expect(showsMemory(true, null)).toBe(true);
    expect(showsMemory(false, memory(1))).toBe(true);
  });
});

describe("visibleItems", () => {
  const people = ["a", "b", "c", "d", "e", "f", "g", "h"];

  it("the first four, then „još 4”", () => {
    expect(visibleItems(people, 4, false)).toEqual({ shown: ["a", "b", "c", "d"], hidden: 4 });
  });

  it("all of them after „još N”, and short lists whole", () => {
    expect(visibleItems(people, 4, true)).toEqual({ shown: people, hidden: 0 });
    expect(visibleItems(["a", "b"], 4, false)).toEqual({ shown: ["a", "b"], hidden: 0 });
  });
});
