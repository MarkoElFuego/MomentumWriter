import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/react";
import type { Book, Part } from "@/lib/db/schema";
import { KDP_TRIMS, kdpChecks, kdpGutter, kdpLayout, layoutForKdp } from "./kdp";
import { buildBook } from "./typst/buildBook";
import { runTypst } from "./typst/nodeTypst";
import { printTemplate, type Layout } from "./typst/templates/print.typ";

const trim = (id: string) => KDP_TRIMS.find((t) => t.id === id)!;

describe("KDP rules", () => {
  it("widens the minimum inside margin with the page count, as in KDP's table", () => {
    expect([24, 150, 151, 300, 301, 500, 501, 700, 701, 828].map(kdpGutter)).toEqual([
      0.375, 0.375, 0.5, 0.5, 0.625, 0.625, 0.75, 0.75, 0.875, 0.875,
    ]);
  });

  it("keeps every margin above KDP's minimum, the inside wider than the outside", () => {
    for (const t of KDP_TRIMS) {
      for (const pages of [24, 400, 828]) {
        const [inside, outside, top, bottom] = kdpLayout(t, pages).margin.map(parseFloat);
        expect(Math.min(outside!, top!, bottom!)).toBeGreaterThanOrEqual(0.25);
        expect(inside!).toBeGreaterThanOrEqual(kdpGutter(pages));
        expect(inside!).toBeGreaterThan(outside!);
      }
    }
    expect(kdpLayout(trim("5x8"), 800).margin[0]).toBe("0.875in");
    expect(kdpLayout(trim("6x9"), 100).page).toBe("width: 6in, height: 9in");
  });

  it("lays out again when the page count lands in another row of the table", async () => {
    const counts = [720, 760];
    const built: string[] = [];
    const result = await layoutForKdp(
      (layout) => {
        built.push(layout.margin[0]);
        return layout.margin[0];
      },
      trim("5x8"),
      async () => counts.shift() ?? 760,
    );
    // Guess (0.75 in) → 720 pages → 0.875 in → 760 pages, same row: done.
    expect(built).toEqual(["0.75in", "0.875in"]);
    expect(result.pages).toBe(760);
    expect(result.layout.margin[0]).toBe("0.875in");
  });

  it("lists what KDP would refuse", () => {
    const ok = kdpChecks({ pages: 240, trim: trim("6x9"), title: "Kiša", author: "Ana" });
    expect(ok.every((c) => c.ok)).toBe(true);
    expect(ok[1]?.text).toBe("Veličina 6 × 9 in je sa KDP liste");
    const bad = kdpChecks({ pages: 12, trim: trim("5.25x8"), title: "Nova knjiga" });
    expect(bad.filter((c) => !c.ok)).toHaveLength(3);
    expect(bad[0]?.text).toContain("najmanje 24");
    expect(kdpChecks({ pages: 800, trim: trim("6x9"), title: "K", author: "A" })[0]?.text).toContain("krem");
    // Serbian plural: 2–4 strane, 21 strana, 12 strana.
    expect(kdpChecks({ pages: 2, trim: trim("6x9"), title: "K", author: "A" })[0]?.text).toMatch(/^2 strane —/);
    expect(kdpChecks({ pages: 221, trim: trim("6x9"), title: "K", author: "A" })[0]?.text).toMatch(/^221 strana —/);
    expect(kdpChecks({ pages: 234, trim: trim("6x9"), title: "K", author: "A" })[0]?.text).toMatch(/^234 strane —/);
  });
});

describe("KDP layout in Typst", () => {
  const t = (text: string): JSONContent => ({ type: "text", text });
  const p = (text: string): JSONContent => ({ type: "paragraph", content: [t(text)] });
  const book: Book = { id: "b", title: "Kiša", language: "sr-Latn", createdAt: 0, updatedAt: 0 };
  const parts: Part[] = [1, 2, 3].map((n) => ({
    id: `p${n}`,
    bookId: "b",
    kind: "chapter",
    title: `Deo ${n}`,
    order: n,
    content: { type: "doc", content: Array.from({ length: 12 }, () => p("Đorđe je čekao na stanici dok je kiša padala po krovovima i šinama.")) },
    wordCount: 100,
    createdAt: 0,
    updatedAt: 0,
  }));
  const model = buildBook(book, parts);
  const probe = `
#context [#metadata((
  pages: counter(page).final().first(),
  width: page.width.inches(),
  height: page.height.inches(),
  blank: range(1, counter(page).final().first() + 1).filter(p => page-info(p).blank),
)) <probe>]`;
  const run = async (layout: Layout) => {
    const result = await runTypst(printTemplate(model, { size: "a5", layout, author: "Ana" }) + probe, "<probe>", "value");
    expect(result.errors).toEqual([]);
    return result.query?.[0] as { pages: number; width: number; height: number; blank: number[] };
  };

  it.each(["5x8", "6x9", "8.5x11"])("makes the PDF page exactly the trim size (%s)", async (id) => {
    const info = await run(kdpLayout(trim(id), 24));
    expect(info.width).toBeCloseTo(trim(id).width, 3);
    expect(info.height).toBeCloseTo(trim(id).height, 3);
  });

  it("never leaves two blank pages in a row", async () => {
    const { blank } = await run(kdpLayout(trim("5x8"), 24));
    expect(blank.length).toBeGreaterThan(0);
    expect(blank.some((page, i) => blank[i + 1] === page + 1)).toBe(false);
  });

  it("counts pages with the real compiler across passes", async () => {
    const result = await layoutForKdp(
      (layout) => printTemplate(model, { size: "a5", layout }),
      trim("6x9"),
      async (source) => {
        const r = await runTypst(source + "\n#context [#metadata(counter(page).final().first()) <n>]", "<n>", "value");
        return r.query?.[0] as number;
      },
    );
    expect(result.pages).toBeGreaterThan(4);
    expect(result.layout.margin[0]).toBe("0.75in");
  });
});
