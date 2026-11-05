import { describe, expect, it } from "vitest";
import { isIndexable } from "../src/public-pages";

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
