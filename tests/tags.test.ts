import { describe, expect, it } from "vitest";
import {
  tagIndexUrl,
  tagLabelMismatch,
  tagOrder,
  tagPageUrl,
} from "../src/tags";

describe("tagOrder", () => {
  it("puts the most used tag first", () => {
    const counts = new Map([
      ["design", 1],
      ["code", 3],
      ["life", 2],
    ]);

    expect(tagOrder(counts)).toEqual(["code", "life", "design"]);
  });

  it("breaks a tie on the slug, ascending", () => {
    const counts = new Map([
      ["zeta", 2],
      ["alpha", 2],
    ]);

    expect(tagOrder(counts)).toEqual(["alpha", "zeta"]);
  });

  it("leaves the map it is given alone", () => {
    const counts = new Map([
      ["beta", 1],
      ["alpha", 1],
    ]);
    tagOrder(counts);

    expect([...counts.keys()]).toEqual(["beta", "alpha"]);
  });
});

describe("tagLabelMismatch", () => {
  const labels = { "text-tag-design": "设计" };

  it("accepts a tag that has a label", () => {
    expect(tagLabelMismatch(["design"], labels)).toBeUndefined();
    expect(tagLabelMismatch([], labels)).toBeUndefined();
  });

  it("names the first tag without a label, and the file to edit", () => {
    const message = tagLabelMismatch(["design", "probe"], labels);

    expect(message).toContain('"probe"');
    expect(message).toContain("text-tag-probe");
    expect(message).toContain("src/i18n/messages/zh-hans.json");
  });

  it("reports the first tag when the table is empty", () => {
    expect(tagLabelMismatch(["design", "probe"], {})).toContain('"design"');
  });
});

describe("tagIndexUrl", () => {
  it("puts the page number under the reserved segment", () => {
    expect(tagIndexUrl("zh-hans")).toBe("/zh-hans/tags/page/1/");
    expect(tagIndexUrl("en", 2)).toBe("/en/tags/page/2/");
  });
});

describe("tagPageUrl", () => {
  it("puts a tag's page number after the tag", () => {
    expect(tagPageUrl("zh-hant", "design")).toBe(
      "/zh-hant/tags/design/page/1/",
    );
    expect(tagPageUrl("zh-hans", "design", 3)).toBe(
      "/zh-hans/tags/design/page/3/",
    );
  });
});
