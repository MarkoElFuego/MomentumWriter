import { describe, expect, it } from "vitest";
import { headingRole, isSceneBreakText, styledHeadingRole } from "./chapterHeading";

describe("headingRole", () => {
  it.each([
    ["Poglavlje 3", "poglavlje", ""],
    ["POGLAVLJE III", "poglavlje", ""],
    ["Poglavlje treće", "poglavlje", ""],
    ["Treće poglavlje", "poglavlje", ""],
    ["Glava 3", "glava", ""],
    ["Chapter 3", "chapter", ""],
    ["3", "arabic", ""],
    ["3.", "arabic", ""],
    ["III", "roman", ""],
    ["III.", "roman", ""],
    ["3. Kofer", "arabic", "Kofer"],
    ["III · Kofer", "roman", "Kofer"],
    ["III – Kofer", "roman", "Kofer"],
    ["Poglavlje 3: Kofer", "poglavlje", "Kofer"],
    ["Poglavlje 3 – Gde je Mara?", "poglavlje", "Gde je Mara?"],
    ["  Poglavlje   12  ", "poglavlje", ""],
  ])("%s → chapter (%s) „%s”", (text, family, title) => {
    expect(headingRole(text)).toEqual({ role: "chapter", family, title });
  });

  it.each([
    "3 dana kasnije.",
    "3 dana kasnije",
    "— Treće?",
    "„Poglavlje 3”, rekla je.",
    "Petar je zastao ispred vrata.",
    "3.5 miliona ljudi",
    "Poglavlje dim",
    "vi",
    "IIII",
    "1984",
    "Poglavlje 3 bilo je najteže od svih koja je ikad napisao u životu",
    "III. Kraj je bio blizu.",
  ])("%s is not a heading", (text) => {
    expect(headingRole(text)).toBeNull();
  });

  it("front and back matter by name", () => {
    expect(headingRole("Posveta")).toEqual({ role: "front", title: "Posveta" });
    expect(headingRole("PROLOG")).toEqual({ role: "front", title: "Prolog" });
    expect(headingRole("Uvod:")).toEqual({ role: "front", title: "Uvod" });
    expect(headingRole("Epilog")).toEqual({ role: "back", title: "Epilog" });
    expect(headingRole("beleška o autoru")).toEqual({ role: "back", title: "Beleška o autoru" });
    expect(headingRole("Zahvalnost")).toEqual({ role: "back", title: "Zahvalnost" });
    expect(headingRole("Uvod u fiziku")).toBeNull();
  });

  it("„Deo prvi” is a part of the book, a level above chapters", () => {
    for (const text of ["Deo prvi", "Prvi deo", "DEO II", "Deo 2: Grad", "Knjiga prva"]) {
      expect(headingRole(text)).toEqual({ role: "bookPart" });
    }
  });
});

describe("styledHeadingRole", () => {
  it("trusts a styled heading even without a number", () => {
    expect(styledHeadingRole("Kofer")).toEqual({ role: "chapter", family: "styled", title: "Kofer" });
    expect(styledHeadingRole("Poglavlje 3: Kofer")).toEqual({ role: "chapter", family: "styled", title: "Kofer" });
    expect(styledHeadingRole("Epilog")).toEqual({ role: "back", title: "Epilog" });
  });
});

describe("isSceneBreakText", () => {
  it.each(["***", "* * *", "*", "#", "§", "~", "✱ ✱ ✱", "---", " — — — "])("%s", (text) => {
    expect(isSceneBreakText(text)).toBe(true);
  });
  it.each(["-", "Kraj.", "* Kofer", "—"])("%s is text", (text) => {
    expect(isSceneBreakText(text)).toBe(false);
  });
});
