import { describe, expect, it } from "vitest";
import { articleTrail, tagTrail } from "../src/breadcrumbs";

// The hrefs are asserted by their tail: under Vitest `import.meta.env.BASE_URL`
// is `/`, so Astro's `getRelativeLocaleUrl()` returns `/zh-hans/…` here and
// `/articles/zh-hans/…` in a build. The path this module owns is the tail.
describe("articleTrail", () => {
  it("reads home, list, article", () => {
    const trail = articleTrail("zh-hans", "什五与 Kato 的角色设定资料");

    expect(trail.steps.map((step) => step.label)).toEqual([
      "首页",
      "文章",
      "什五与 Kato 的角色设定资料",
    ]);
  });

  it("links the two steps above the page, and only those", () => {
    const [home, list, article] = articleTrail("zh-hans", "A title").steps;

    expect(home.href).toMatch(/\/zh-hans\/$/);
    expect(list.href).toMatch(/\/zh-hans\/page\/1\/$/);
    expect(article.href).toBeUndefined();
  });

  it("names its landmark", () => {
    expect(articleTrail("zh-hans", "A title").label).toBe("面包屑导航");
  });

  it("takes each locale's own labels", () => {
    expect(articleTrail("en", "A title").steps[1].label).toBe("Articles");
    expect(articleTrail("zh-hant", "A title").steps[1].label).toBe("文章");
  });
});

describe("tagTrail", () => {
  it("reads home, tags, the tag's label", () => {
    const trail = tagTrail("zh-hans", "sci-fi");

    expect(trail.steps.map((step) => step.label)).toEqual([
      "首页",
      "标签",
      "科幻",
    ]);
  });

  it("links the tag index, which is the tag's real ancestor", () => {
    const [home, tags, tag] = tagTrail("zh-hans", "sci-fi").steps;

    expect(home.href).toMatch(/\/zh-hans\/$/);
    expect(tags.href).toMatch(/\/zh-hans\/tags\/page\/1\/$/);
    expect(tag.href).toBeUndefined();
  });

  it("carries the landmark's name, in the locale's own words", () => {
    expect(tagTrail("en", "sci-fi").label).toBe("Breadcrumb");
    expect(tagTrail("zh-hant", "sci-fi").label).toBe("麵包屑導航");
  });
});
