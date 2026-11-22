import { describe, expect, it } from "vitest";
import { licenseMirrorUrl, licenseUrl } from "../src/licenses";

describe("licenseUrl", () => {
  it("prefixes the default locale and keeps the trailing slash", () => {
    expect(licenseUrl("zh-hans", "restricted-artworks")).toBe(
      "/zh-hans/licenses/restricted-artworks/",
    );
  });

  it("keeps a non-default locale's prefix", () => {
    expect(licenseUrl("en", "restricted-artworks")).toBe(
      "/en/licenses/restricted-artworks/",
    );
  });
});

describe("licenseMirrorUrl", () => {
  it("names the markdown copy beside the page", () => {
    expect(licenseMirrorUrl("zh-hans", "restricted-artworks")).toBe(
      "/zh-hans/licenses/restricted-artworks/index.md",
    );
  });
});
