import { describe, expect, it } from "vitest";
import { articleUrl, order, type Article } from "../src/articles";

/** A published article with only the fields the ordering reads. */
function article(id: string, date: string): Article {
  return { id, data: { date } } as unknown as Article;
}

describe("order", () => {
  it("puts the newest first", () => {
    const sorted = order([
      article("2026-01-01-old", "2026-01-01"),
      article("2026-10-11-new", "2026-10-11"),
      article("2026-05-05-middle", "2026-05-05"),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual([
      "2026-10-11-new",
      "2026-05-05-middle",
      "2026-01-01-old",
    ]);
  });

  it("breaks a tie on the same day by id, descending", () => {
    const sorted = order([
      article("2026-01-01-alpha", "2026-01-01"),
      article("2026-01-01-beta", "2026-01-01"),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual([
      "2026-01-01-beta",
      "2026-01-01-alpha",
    ]);
  });

  it("leaves the array it is given alone", () => {
    const entries = [
      article("2026-01-01-old", "2026-01-01"),
      article("2026-10-11-new", "2026-10-11"),
    ];
    order(entries);

    expect(entries.map((entry) => entry.id)).toEqual([
      "2026-01-01-old",
      "2026-10-11-new",
    ]);
  });
});

describe("articleUrl", () => {
  it("prefixes the locale and keeps the trailing slash", () => {
    expect(articleUrl("zh-hans", "2026-10-11-seed")).toBe(
      "/zh-hans/2026-10-11-seed/",
    );
  });
});
