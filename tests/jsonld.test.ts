import { describe, expect, it } from "vitest";
import {
  articleNode,
  pageGraph,
  serializeGraph,
  type LocaleSite,
  type PageGraph,
} from "../src/jsonld";
import type { ShareImage } from "../src/site-assets";

const site: LocaleSite = {
  root: "https://example.com/articles/",
  home: "https://example.com/articles/zh-hans/",
  tag: "zh-Hans",
};

const url = "https://example.com/articles/zh-hans/2026-01-01-post/";

const page = {
  site,
  url,
  name: "A post - Steve Hsu (什五)",
  description: "What the post is about.",
  siteName: "Steve Hsu (什五) 的文章",
  author: "Steve Hsu (什五)",
  type: "WebPage" as const,
};

const image: ShareImage = {
  url: "https://example.com/articles/_astro/cover.abc123.jpg",
  width: 1200,
  height: 630,
  alt: "A post",
};

const article = {
  site,
  url,
  headline: "A post",
  description: "What the post is about.",
  image,
  datePublished: "2026-01-01",
  dateModified: "2026-02-02",
  license: "https://creativecommons.org/licenses/by/4.0/",
};

/** The node at one position, read as the type the test expects there. */
function node<T>(graph: PageGraph, index: number): T {
  return graph["@graph"][index] as T;
}

describe("pageGraph", () => {
  it("writes one context and the site, the author and the page", () => {
    const graph = pageGraph(page);

    expect(graph["@context"]).toBe("https://schema.org");
    expect(graph["@graph"].map((entry) => entry["@type"])).toEqual([
      "WebSite",
      "Person",
      "WebPage",
    ]);
  });

  it("derives every id from the URLs it is given", () => {
    const graph = pageGraph(page);

    expect(graph["@graph"].map((entry) => entry["@id"])).toEqual([
      "https://example.com/articles/zh-hans/#website",
      "https://example.com/articles/#person",
      "https://example.com/articles/zh-hans/2026-01-01-post/#webpage",
    ]);
  });

  it("names the site and the author, in the locale's own language", () => {
    const graph = pageGraph(page);
    const webSite = node<{ name: string; url: string; inLanguage: string }>(
      graph,
      0,
    );
    const person = node<{ name: string; url: string }>(graph, 1);

    expect(webSite).toMatchObject({
      name: "Steve Hsu (什五) 的文章",
      url: "https://example.com/articles/zh-hans/",
      inLanguage: "zh-Hans",
    });
    expect(person).toMatchObject({
      name: "Steve Hsu (什五)",
      url: "https://stevehsudrawing.github.io/",
    });
  });

  it("makes the page part of its locale's site", () => {
    const graph = pageGraph(page);
    const webPage = node<{ isPartOf: { "@id": string } }>(graph, 2);

    expect(webPage.isPartOf).toEqual({
      "@id": "https://example.com/articles/zh-hans/#website",
    });
  });

  it("names a collection page for the pages that are one", () => {
    const graph = pageGraph({ ...page, type: "CollectionPage" });

    expect(node<{ "@type": string }>(graph, 2)["@type"]).toBe("CollectionPage");
  });

  it("appends the nodes the page builds after its own", () => {
    const graph = pageGraph({ ...page, nodes: [articleNode(article)] });

    expect(graph["@graph"].map((entry) => entry["@type"])).toEqual([
      "WebSite",
      "Person",
      "WebPage",
      "BlogPosting",
    ]);
  });
});

describe("articleNode", () => {
  it("describes the article the page renders", () => {
    const posting = articleNode(article);

    expect(posting).toMatchObject({
      "@type": "BlogPosting",
      "@id": "https://example.com/articles/zh-hans/2026-01-01-post/#article",
      headline: "A post",
      description: "What the post is about.",
      datePublished: "2026-01-01",
      dateModified: "2026-02-02",
      inLanguage: "zh-Hans",
      license: "https://creativecommons.org/licenses/by/4.0/",
    });
  });

  it("carries the card's own size, so no fetch is needed to learn it", () => {
    expect(articleNode(article).image).toEqual({
      "@type": "ImageObject",
      url: "https://example.com/articles/_astro/cover.abc123.jpg",
      width: 1200,
      height: 630,
    });
  });

  it("points at the author, at its site and at the page that holds it", () => {
    const posting = articleNode(article);

    expect(posting.author).toEqual({
      "@id": "https://example.com/articles/#person",
    });
    expect(posting.isPartOf).toEqual({
      "@id": "https://example.com/articles/zh-hans/#website",
    });
    expect(posting.mainEntityOfPage).toEqual({
      "@id": "https://example.com/articles/zh-hans/2026-01-01-post/#webpage",
    });
  });

  it("writes no modification date when it would repeat the publication one", () => {
    const posting = articleNode({ ...article, dateModified: "2026-01-01" });

    expect(posting).not.toHaveProperty("dateModified");
  });

  it("writes no modification date when the article declares none", () => {
    const posting = articleNode({ ...article, dateModified: undefined });

    expect(posting).not.toHaveProperty("dateModified");
  });

  it("writes no license when the article's has no document to point at", () => {
    const posting = articleNode({ ...article, license: undefined });

    expect(posting).not.toHaveProperty("license");
  });
});

describe("serializeGraph", () => {
  it("writes JSON that parses back to the same graph", () => {
    const graph = pageGraph({ ...page, nodes: [articleNode(article)] });

    expect(JSON.parse(serializeGraph(graph))).toEqual(graph);
  });

  it("cannot end the script element from inside a value", () => {
    const graph = pageGraph({ ...page, name: "Titles </script> end here" });

    const text = serializeGraph(graph);

    expect(text).toContain("\\u003c/script>");
    expect(text).not.toContain("</script>");
    expect(JSON.parse(text)).toEqual(graph);
  });

  it("escapes every angle bracket, not the first", () => {
    const graph = pageGraph({ ...page, description: "a < b < c" });

    expect(serializeGraph(graph)).toContain("a \\u003c b \\u003c c");
  });
});
