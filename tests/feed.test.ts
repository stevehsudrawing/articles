import { describe, expect, it } from "vitest";
import type { Article } from "../src/articles";
import { feedItems, feedOptions, feedUrl } from "../src/feed";
import { AUTHOR_EMAIL } from "../src/site";

/** A published article with only the fields the feed reads. */
function article(
  id: string,
  date: string,
  title: string,
  description: string,
  updated?: string,
): Article {
  return {
    id,
    data: { title, description, date, updated },
  } as unknown as Article;
}

const ARTICLES = [
  article(
    "2026-10-11-new",
    "2026-10-11",
    "Newer",
    "The newer one.",
    "2026-10-24",
  ),
  article("2026-07-15-old", "2026-07-15", "Older", "The older one."),
];

describe("feedUrl", () => {
  it("names the locale's file, with no trailing slash", () => {
    // Two facts at once, both of which the build hides: the base is `/` under
    // Vitest rather than `/articles`, and the address ends at the file name -
    // the slash is the one `getRelativeLocaleUrl(locale, "rss.xml")` adds.
    expect(feedUrl("en")).toMatch(/\/en\/rss\.xml$/);
    expect(feedUrl("en")).not.toMatch(/\/$/);
  });

  it("gives each locale its own file", () => {
    expect(feedUrl("en")).not.toBe(feedUrl("zh-hant"));
    expect(feedUrl("zh-hant")).toContain("/zh-hant/");
  });
});

describe("feedItems", () => {
  it("returns one item per article, in the order given", () => {
    expect(feedItems("en", ARTICLES).map((item) => item.title)).toEqual([
      "Newer",
      "Older",
    ]);
  });

  it("links each item to its page in this locale", () => {
    const [first] = feedItems("zh-hant", ARTICLES);

    expect(first.link).toMatch(/^https:\/\/stevehsudrawing\.github\.io\//);
    expect(first.link).toMatch(/\/zh-hant\/2026-10-11-new\/$/);
  });

  it("dates each item by its publication date at midnight UTC, not its update", () => {
    const [first] = feedItems("en", ARTICLES);

    expect((first.pubDate as Date).toISOString()).toBe(
      "2026-10-11T00:00:00.000Z",
    );
  });

  it("describes each item with the page's own description, and no body", () => {
    const items = feedItems("en", ARTICLES);

    expect(items.map((item) => item.description)).toEqual([
      "The newer one.",
      "The older one.",
    ]);
    expect(items.every((item) => item.content === undefined)).toBe(true);
  });

  it("has nothing to return for a locale that published nothing", () => {
    expect(feedItems("en", [])).toEqual([]);
  });
});

describe("feedOptions", () => {
  it("names the channel after the site, in the reader's language", () => {
    expect(feedOptions("en", ARTICLES).title).toBe(
      "Steve Hsu (什五)'s Articles",
    );
    expect(feedOptions("zh-hant", ARTICLES).title).toBe(
      "Steve Hsu (什五) 的文章",
    );
  });

  it("introduces the channel with the home page's own sentence", () => {
    expect(feedOptions("zh-hans", ARTICLES).description).toBe(
      "随想 · 故事 · 绘画 · 设计 · 技巧",
    );
  });

  it("points the channel at its locale's root", () => {
    expect(String(feedOptions("en", ARTICLES).site)).toMatch(/\/en\/$/);
  });

  it("states the language as the tag, not the identity", () => {
    expect(feedOptions("zh-hant", ARTICLES).customData).toContain(
      "<language>zh-Hant</language>",
    );
  });

  it("names the site's address as the editor, with its name beside it", () => {
    expect(feedOptions("en", ARTICLES).customData).toContain(
      `<managingEditor>${AUTHOR_EMAIL} (Steve Hsu (什五))</managingEditor>`,
    );
  });

  it("names the feed's own address", () => {
    expect(feedOptions("en", ARTICLES).customData).toMatch(
      /<atom:link rel="self" type="application\/rss\+xml" href="https:\/\/[^"]+\/en\/rss\.xml" \/>/,
    );
  });

  it("declares the namespace the self link needs", () => {
    expect(feedOptions("en", ARTICLES).xmlns).toEqual({
      atom: "http://www.w3.org/2005/Atom",
    });
  });

  it("names no article's author", () => {
    const named = feedItems("en", ARTICLES).filter(
      (item) => item.author !== undefined,
    );

    expect(named).toEqual([]);
  });

  it("depends on the articles and on nothing else", () => {
    expect(feedOptions("en", ARTICLES)).toEqual(feedOptions("en", ARTICLES));
  });
});
