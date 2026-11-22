import { describe, expect, it } from "vitest";
import { licenseMirrorUrl, licenseStamp, licenseUrl } from "../src/licenses";

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

describe("licenseStamp", () => {
  it("prints the version and the effective date when there is a version", () => {
    expect(licenseStamp({ version: "1.0", effectiveDate: "2026-11-22" })).toBe(
      "v1.0 · 2026-11-22",
    );
  });

  it("prints the effective date alone when the document has no version", () => {
    expect(licenseStamp({ effectiveDate: "2026-11-22" })).toBe("2026-11-22");
  });
});
