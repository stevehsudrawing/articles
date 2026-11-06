import { describe, expect, it } from "vitest";
import { PER_PAGE, type Article } from "../src/articles";
import {
  isIndexable,
  pagesOf,
  type LocaleContent,
  type PublicPage,
} from "../src/public-pages";

describe("isIndexable", () => {
  it("keeps a published article in", () => {
    expect(isIndexable({ draft: false })).toBe(true);
  });

  it("keeps a draft article out", () => {
    expect(isIndexable({ draft: true })).toBe(false);
  });

  it("keeps a tag page holding an article in", () => {
    expect(isIndexable({ articles: 1 })).toBe(true);
  });

  it("keeps a tag page holding nothing out", () => {
    expect(isIndexable({ articles: 0 })).toBe(false);
  });
});

/** A published article with only the fields the inventory reads. */
function article(
  id: string,
  date: string,
  rest: { updated?: string; tags?: string[]; draft?: boolean } = {},
): Article {
  return { id, data: { date, ...rest } } as unknown as Article;
}

const TAGS = ["design", "sci-fi"];

/** The path each record holds, in the order `pagesOf()` returns them. */
function paths(pages: readonly PublicPage[]): string[] {
  return pages.map((page) => page.path);
}

describe("pagesOf", () => {
  const content: LocaleContent = {
    articles: [
      article("2026-10-11-new", "2026-10-11", {
        updated: "2026-10-24",
        tags: ["design"],
      }),
      article("2026-07-15-old", "2026-07-15", { tags: ["sci-fi"] }),
    ],
    tags: TAGS,
  };

  it("lists the home, the list, the tag index, every tag page and every article", () => {
    expect(paths(pagesOf("zh-hans", content))).toEqual([
      "",
      "page/1/",
      "tags/page/1/",
      "tags/design/page/1/",
      "tags/sci-fi/page/1/",
      "2026-10-11-new/",
      "2026-07-15-old/",
    ]);
  });

  it("names every page's locale and absolute URL", () => {
    const [home] = pagesOf("en", content);

    expect(home.locale).toBe("en");
    expect(home.url).toMatch(/^https:\/\/[^/]+\/en\/$/);
    expect(home.kind).toBe("home");
  });

  it("dates the home, the list and the tag index by the newest publication", () => {
    const pages = pagesOf("zh-hans", content);
    const byDate = (path: string) =>
      pages.find((page) => page.path === path)?.lastmod;

    expect(byDate("")).toBe("2026-10-11");
    expect(byDate("page/1/")).toBe("2026-10-11");
    expect(byDate("tags/page/1/")).toBe("2026-10-11");
  });

  it("dates an article by its update when it declares one", () => {
    const pages = pagesOf("zh-hans", content);

    expect(pages.find((page) => page.path === "2026-10-11-new/")?.lastmod).toBe(
      "2026-10-24",
    );
    expect(pages.find((page) => page.path === "2026-07-15-old/")?.lastmod).toBe(
      "2026-07-15",
    );
  });

  it("dates a tag page by the newest article on it", () => {
    const pages = pagesOf("zh-hans", content);

    expect(
      pages.find((page) => page.path === "tags/design/page/1/")?.lastmod,
    ).toBe("2026-10-11");
  });

  it("keeps a locale with nothing published, and marks its tag pages as previews", () => {
    const pages = pagesOf("en", { articles: [], tags: TAGS });

    expect(paths(pages)).toEqual([
      "",
      "page/1/",
      "tags/page/1/",
      "tags/design/page/1/",
      "tags/sci-fi/page/1/",
    ]);
    expect(
      pages.filter((page) => page.kind === "tag").every((p) => !p.indexable),
    ).toBe(true);
    expect(pages[0].lastmod).toBeUndefined();
  });

  it("leaves every tag page indexable where the locale carries the tag", () => {
    const pages = pagesOf("zh-hans", content);

    expect(
      pages
        .filter((page) => page.kind === "tag")
        .every((page) => page.indexable),
    ).toBe(true);
  });

  it("marks a draft article as a preview", () => {
    const pages = pagesOf("en", {
      articles: [article("2026-10-11-draft", "2026-10-11", { draft: true })],
      tags: [],
    });

    expect(pages.find((page) => page.kind === "article")?.indexable).toBe(
      false,
    );
  });

  it("adds a second list page only when the articles need one", () => {
    const many = Array.from({ length: PER_PAGE + 1 }, (_, index) =>
      article(`2026-01-01-${String(index).padStart(2, "0")}`, "2026-01-01", {
        tags: ["design"],
      }),
    );

    const lists = pagesOf("zh-hans", { articles: many, tags: TAGS }).filter(
      (page) => page.kind === "list",
    );

    expect(lists.map((page) => page.path)).toEqual(["page/1/", "page/2/"]);
    expect(lists[1].lastmod).toBe("2026-01-01");
  });
});
