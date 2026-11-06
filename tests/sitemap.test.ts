import { describe, expect, it } from "vitest";
import type { PublicPage } from "../src/public-pages";
import { sitemapXml } from "../src/sitemap";

const base = "https://example.com/articles";

/** One record, with the fields a test is not exercising filled in. */
function page(overrides: Partial<PublicPage> & { path: string }): PublicPage {
  return {
    kind: "list",
    locale: "zh-hans",
    url: `${base}/zh-hans/${overrides.path}`,
    indexable: true,
    ...overrides,
  };
}

const threeLocales = ["zh-hans", "zh-hant", "en"] as const;

/** The same page in all three locales. */
const translated = threeLocales.map((locale) =>
  page({ locale, path: "page/1/", url: `${base}/${locale}/page/1/` }),
);

describe("sitemapXml", () => {
  it("declares itself, both namespaces, and ends with a newline", () => {
    const xml = sitemapXml(translated);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(
      true,
    );
    expect(xml).toContain(
      'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    );
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml.endsWith("</urlset>\n")).toBe(true);
  });

  it("lists the pages in the order it is given", () => {
    const xml = sitemapXml([
      page({ path: "", url: `${base}/zh-hans/` }),
      page({ path: "page/1/", url: `${base}/zh-hans/page/1/` }),
    ]);

    expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual([
      `${base}/zh-hans/`,
      `${base}/zh-hans/page/1/`,
    ]);
  });

  it("leaves out every page a crawler may not index", () => {
    const xml = sitemapXml([
      page({ path: "page/1/" }),
      page({ path: "tags/design/page/1/", indexable: false }),
    ]);

    expect(xml).not.toContain("tags/design/page/1/");
    expect([...xml.matchAll(/<loc>/g)]).toHaveLength(1);
  });

  it("writes the date it is given, and omits it when there is none", () => {
    const xml = sitemapXml([
      page({ path: "page/1/", lastmod: "2026-10-11" }),
      page({ path: "tags/page/1/" }),
    ]);

    expect(xml).toContain("<lastmod>2026-10-11</lastmod>");
    expect([...xml.matchAll(/<lastmod>/g)]).toHaveLength(1);
  });

  it("names a page's real translations as its alternates, itself included", () => {
    const xml = sitemapXml(translated);
    const first = xml.slice(xml.indexOf("<url>"), xml.indexOf("</url>"));

    expect([...first.matchAll(/hreflang="([^"]+)"/g)].map((m) => m[1])).toEqual(
      ["zh-Hans", "zh-Hant", "en", "x-default"],
    );
  });

  it("names no page outside the index as an alternate", () => {
    const xml = sitemapXml([
      page({
        locale: "zh-hans",
        path: "tags/design/page/1/",
        url: `${base}/zh-hans/tags/design/page/1/`,
      }),
      page({
        locale: "en",
        path: "tags/design/page/1/",
        url: `${base}/en/tags/design/page/1/`,
        indexable: false,
      }),
    ]);

    expect(xml).toContain(`href="${base}/zh-hans/tags/design/page/1/"`);
    expect(xml).not.toContain(`href="${base}/en/tags/design/page/1/"`);
  });

  // The href is asserted by its tail, as the trail tests do: under Vitest
  // `import.meta.env.BASE_URL` is `/`, so the default locale's copy resolves to
  // `/zh-hans/…` here and `/articles/zh-hans/…` in a build.
  it("points x-default at the default locale's copy of the same path", () => {
    const xml = sitemapXml([
      page({ locale: "en", path: "page/1/", url: `${base}/en/page/1/` }),
    ]);

    expect(/hreflang="x-default" href="([^"]+)"/.exec(xml)?.[1]).toMatch(
      /^https:\/\/.+\/zh-hans\/page\/1\/$/,
    );
  });

  it("escapes the characters XML cannot read raw", () => {
    const xml = sitemapXml([
      page({ path: "a&b/", url: `${base}/zh-hans/a&b/</x>` }),
    ]);

    expect(xml).toContain(`${base}/zh-hans/a&amp;b/&lt;/x&gt;`);
    expect(xml).not.toContain("a&b/");
  });

  it("writes the same bytes for the same pages", () => {
    expect(sitemapXml(translated)).toBe(sitemapXml(translated));
  });
});
