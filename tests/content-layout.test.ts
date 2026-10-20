import { describe, expect, it } from "vitest";
import { sharedFieldMismatch, type Article } from "../src/articles";
import { contentPathError } from "../src/content-layout";

/**
 * One article as the guard sees it: a path, and the fields it compares. The
 * rest of a `CollectionEntry` is not read, so the cast states only what is
 * used.
 */
function article(path: string, data: Record<string, unknown>): Article {
  const id = path.split("/").slice(-2, -1)[0];
  return { id, filePath: path, data } as unknown as Article;
}

describe("contentPathError", () => {
  it("accepts one file per locale in one article folder", () => {
    for (const file of [
      "/src/content/2026-10-11-seed/zh-hans.md",
      "/src/content/2026-10-11-seed/zh-hant.md",
      "/src/content/2026-10-11-seed/en.md",
    ]) {
      expect(contentPathError(file), file).toBeUndefined();
    }
  });

  it("rejects a file name in the wrong case", () => {
    expect(contentPathError("/src/content/2026-10-11-seed/zh-Hans.md")).toMatch(
      /must be named after a locale, one of zh-hans, zh-hant, en/,
    );
  });

  it("rejects a leftover index.md and names the file to use instead", () => {
    expect(contentPathError("/src/content/2026-10-11-seed/index.md")).toMatch(
      /rename it to 2026-10-11-seed\/<locale>\.md/,
    );
  });

  it("rejects the earlier per-locale layout", () => {
    expect(
      contentPathError("/src/content/en/2026-10-11-seed/index.md"),
    ).toMatch(/nested too deep/);
  });

  it("rejects a file nested deeper than one folder", () => {
    expect(
      contentPathError("/src/content/2026-10-11-seed/sub/zh-hans.md"),
    ).toMatch(/nested too deep/);
  });

  it("rejects a file loose in the content folder", () => {
    expect(contentPathError("/src/content/zh-hans.md")).toMatch(
      /is loose in \/src\/content\//,
    );
  });

  it("rejects a folder without the date", () => {
    expect(contentPathError("/src/content/hello/zh-hans.md")).toMatch(
      /must be named <YYYY-MM-DD>-<id>/,
    );
  });

  it("rejects a path outside the content folder", () => {
    expect(contentPathError("zh-hans.md")).toMatch(/is outside/);
  });
});

describe("sharedFieldMismatch", () => {
  /** The three fields one article states once, as two locales agree on them. */
  const agreed = {
    author: "Steve Hsu",
    license: "CC-BY-4.0",
    tags: ["design", "seed-article"],
  };

  it("accepts locales that agree", () => {
    expect(
      sharedFieldMismatch([
        article("/src/content/2026-10-11-seed/zh-hans.md", agreed),
        article("/src/content/2026-10-11-seed/en.md", agreed),
      ]),
    ).toBeUndefined();
  });

  it("accepts a single locale, and an empty list", () => {
    expect(
      sharedFieldMismatch([
        article("/src/content/2026-10-11-seed/zh-hans.md", agreed),
      ]),
    ).toBeUndefined();
    expect(sharedFieldMismatch([])).toBeUndefined();
  });

  it("names a divergent author and both files", () => {
    const message = sharedFieldMismatch([
      article("/src/content/2026-10-11-seed/zh-hans.md", agreed),
      article("/src/content/2026-10-11-seed/en.md", {
        ...agreed,
        author: "Someone Else",
      }),
    ]);

    expect(message).toContain('"author"');
    expect(message).toContain("src/content/2026-10-11-seed/zh-hans.md");
    expect(message).toContain("src/content/2026-10-11-seed/en.md");
  });

  it("names a divergent license", () => {
    expect(
      sharedFieldMismatch([
        article("/src/content/2026-10-11-seed/zh-hans.md", agreed),
        article("/src/content/2026-10-11-seed/en.md", {
          ...agreed,
          license: "All-Rights-Reserved",
        }),
      ]),
    ).toContain('"license"');
  });

  it("names a tag list in a different order", () => {
    expect(
      sharedFieldMismatch([
        article("/src/content/2026-10-11-seed/zh-hans.md", agreed),
        article("/src/content/2026-10-11-seed/en.md", {
          ...agreed,
          tags: ["seed-article", "design"],
        }),
      ]),
    ).toContain('"tags"');
  });

  it("names a field one locale leaves unset", () => {
    const { author: _author, ...withoutAuthor } = agreed;

    expect(
      sharedFieldMismatch([
        article("/src/content/2026-10-11-seed/zh-hans.md", agreed),
        article("/src/content/2026-10-11-seed/en.md", withoutAuthor),
      ]),
    ).toContain("(unset)");
  });
});
