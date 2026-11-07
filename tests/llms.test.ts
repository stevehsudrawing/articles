import { describe, expect, it } from "vitest";
import { mirrorUrl, type Article } from "../src/articles";
import { LICENSES } from "../src/content.config";
import { llmsTxt, llmsUrl, mirrorMarkdown } from "../src/llms";
import { REPOSITORY_URL } from "../src/site";

/** A published article with only the fields these documents read. */
function article(
  id: string,
  data: Record<string, unknown> = {},
  body = "## 1. A heading\n\nSome text.\n",
): Article {
  return {
    id,
    data: {
      title: "A title",
      description: "A description.",
      date: "2026-10-11",
      license: "All-Rights-Reserved",
      ...data,
    },
    body,
  } as unknown as Article;
}

const SITE = {
  siteName: "Steve Hsu (什五) 的文章",
  summary: "随想 · 故事 · 绘画 · 设计 · 技巧",
};

describe("llmsUrl", () => {
  it("names the file at the base's root, with no trailing slash", () => {
    // The base is `/` under Vitest rather than `/articles`, so only the shape
    // is assertable here; the build is what shows the real address.
    expect(llmsUrl()).toMatch(/\/llms\.txt$/);
  });
});

describe("mirrorUrl", () => {
  it("sets the page's extension to `.md` and keeps no trailing slash", () => {
    expect(mirrorUrl("en", "2026-10-11-seed")).toMatch(
      /\/en\/2026-10-11-seed\/index\.md$/,
    );
  });

  it("gives each locale its own copy", () => {
    expect(mirrorUrl("en", "a")).not.toBe(mirrorUrl("zh-hant", "a"));
  });
});

describe("llmsTxt", () => {
  it("opens with the site's name and its own sentence", () => {
    const text = llmsTxt({
      ...SITE,
      locales: [{ locale: "zh-hans", articles: [article("a")] }],
    });

    expect(text.startsWith(`# ${SITE.siteName}\n\n> ${SITE.summary}\n`)).toBe(
      true,
    );
  });

  it("writes a section per locale in the order given, then its own two", () => {
    const text = llmsTxt({
      ...SITE,
      locales: [
        { locale: "zh-hans", articles: [article("a")] },
        { locale: "zh-hant", articles: [article("b")] },
        { locale: "en", articles: [article("c")] },
      ],
    });

    expect(text.match(/^## .*$/gm)).toEqual([
      "## 中文 (简体)",
      "## 中文 (繁體)",
      "## English",
      "## License",
      "## Project",
    ]);
  });

  it("lists each article with a link to its copy and its description", () => {
    const text = llmsTxt({
      ...SITE,
      locales: [{ locale: "en", articles: [article("2026-10-11-seed")] }],
    });

    // The base is `/` under Vitest, so the middle of the address is optional
    // here and only the build writes the real one.
    expect(text).toMatch(
      /\(https:\/\/stevehsudrawing\.github\.io\/(?:[^)]*\/)?en\/2026-10-11-seed\/index\.md\): A description\.$/m,
    );
  });

  it("gives a locale with nothing in it no section at all", () => {
    const text = llmsTxt({
      ...SITE,
      locales: [
        { locale: "zh-hans", articles: [article("a")] },
        { locale: "en", articles: [] },
      ],
    });

    expect(text).not.toContain("## English");
  });

  it("states that each article carries its own license", () => {
    const text = llmsTxt({ ...SITE, locales: [] });

    expect(text).toContain("## License");
    for (const id of Object.keys(LICENSES)) {
      expect(text).toContain(`\`${id}\``);
    }
  });

  it("names the project's source and its sitemap", () => {
    const text = llmsTxt({ ...SITE, locales: [] });

    expect(text).toContain(`[Source repository](${REPOSITORY_URL})`);
    expect(text).toMatch(/\[Sitemap\]\(https:\/\/[^)]*\/sitemap\.xml\)/);
  });

  it("ends with one newline and no more", () => {
    const text = llmsTxt({
      ...SITE,
      locales: [{ locale: "en", articles: [article("a")] }],
    });

    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
  });
});

describe("mirrorMarkdown", () => {
  it("opens with the title as the heading and the description as a quote", () => {
    const [heading, blank, quote] = mirrorMarkdown({
      locale: "zh-hans",
      article: article("a"),
    }).split("\n");

    expect(heading).toBe("# A title");
    expect(blank).toBe("");
    expect(quote).toBe("> A description.");
  });

  it("states the publication date and the page it describes", () => {
    const text = mirrorMarkdown({ locale: "zh-hans", article: article("a") });

    expect(text).toContain("- Published: 2026-10-11");
    expect(text).toMatch(
      /- Canonical: https:\/\/stevehsudrawing\.github\.io\/(?:.*\/)?zh-hans\/a\/$/m,
    );
  });

  it("writes no update date when the article declares none", () => {
    const text = mirrorMarkdown({ locale: "en", article: article("a") });

    expect(text).not.toContain("- Updated:");
  });

  it("writes no update date when it would repeat the publication one", () => {
    const text = mirrorMarkdown({
      locale: "en",
      article: article("a", { updated: "2026-10-11" }),
    });

    expect(text).not.toContain("- Updated:");
  });

  it("writes the update date when it differs", () => {
    const text = mirrorMarkdown({
      locale: "en",
      article: article("a", { updated: "2026-10-24" }),
    });

    expect(text).toContain("- Updated: 2026-10-24");
  });

  it("links the license when the vocabulary has a document for it", () => {
    const license = LICENSES["CC-BY-4.0"];
    const text = mirrorMarkdown({
      locale: "en",
      article: article("a", { license: "CC-BY-4.0" }),
    });

    expect(text).toContain(`- License: [${license.label}](${license.url})`);
  });

  it("writes the label alone when it has none", () => {
    const license = LICENSES["All-Rights-Reserved"];
    const text = mirrorMarkdown({
      locale: "en",
      article: article("a", { license: "All-Rights-Reserved" }),
    });

    expect(text).toContain(`- License: ${license.label}`);
    expect(text).not.toContain("undefined");
  });

  it("carries the source markdown as the body, ending in one newline", () => {
    const text = mirrorMarkdown({ locale: "en", article: article("a") });

    expect(text).toContain("\n\n## 1. A heading\n\nSome text.\n");
    expect(text.endsWith("Some text.\n")).toBe(true);
  });
});
