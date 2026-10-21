import { describe, expect, it } from "vitest";
import { assertCoverSize, COVER_HEIGHT, COVER_WIDTH } from "../src/site-assets";

describe("assertCoverSize", () => {
  it("accepts the size the share card expects", () => {
    expect(() =>
      assertCoverSize(
        { width: COVER_WIDTH, height: COVER_HEIGHT },
        "2026-10-11-seed/zh-hans.md cover.light",
      ),
    ).not.toThrow();
  });

  it("names the file, the field and both measurements", () => {
    expect(() =>
      assertCoverSize(
        { width: 512, height: 512 },
        "2026-10-11-seed/zh-hans.md cover.light",
      ),
    ).toThrow(
      "Cover image 2026-10-11-seed/zh-hans.md cover.light is 512x512; a cover must be 1200x630.",
    );
  });

  it("rejects a cover of the right width and the wrong height", () => {
    expect(() =>
      assertCoverSize({ width: COVER_WIDTH, height: 600 }, "cover.png"),
    ).toThrow(/is 1200x600; a cover must be 1200x630\./);
  });
});
