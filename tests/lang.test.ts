import { describe, expect, it } from "vitest";
import { matchLang, normalizeLang, resolveLocale } from "../src/i18n/lang";

describe("matchLang", () => {
  it("maps the main site's Traditional Chinese tags to zh-hant", () => {
    for (const tag of ["zh-TW", "zh-HK", "zh-MO", "zh-Hant"]) {
      expect(matchLang(tag)).toBe("zh-hant");
    }
  });

  it("maps the main site's Simplified Chinese tags to zh-hans", () => {
    for (const tag of ["zh-CN", "zh-SG", "zh", "zh-Hans"]) {
      expect(matchLang(tag)).toBe("zh-hans");
    }
  });

  it("reads a region or script subtag on top of the base language", () => {
    expect(matchLang("zh-Hant-TW")).toBe("zh-hant");
    expect(matchLang("zh-Hans-CN")).toBe("zh-hans");
    expect(matchLang("en-GB")).toBe("en");
  });

  it("treats any other zh variant as Simplified Chinese", () => {
    expect(matchLang("zh-MY")).toBe("zh-hans");
  });

  it("ignores case and surrounding whitespace", () => {
    expect(matchLang("  ZH-HANT  ")).toBe("zh-hant");
  });

  it("returns undefined for a language the site does not publish", () => {
    for (const tag of ["fr", "de-DE", "ja", ""]) {
      expect(matchLang(tag)).toBeUndefined();
    }
  });
});

describe("normalizeLang", () => {
  it("returns the matching locale", () => {
    expect(normalizeLang("zh-TW")).toBe("zh-hant");
  });

  it("falls back to zh-hans, not en, for an unsupported language", () => {
    expect(normalizeLang("fr")).toBe("zh-hans");
  });
});

describe("resolveLocale", () => {
  it("lets a stored zh-* value win over the browser's list", () => {
    expect(resolveLocale("zh-Hant", ["en-US", "en"])).toBe("zh-hant");
  });

  it("skips a stored en value and reads the browser's list", () => {
    expect(resolveLocale("en", ["zh-Hant", "en-US"])).toBe("zh-hant");
  });

  it("scans the browser's list for the first supported language", () => {
    expect(resolveLocale(null, ["fr", "de", "zh-Hant"])).toBe("zh-hant");
  });

  it("falls back to the default locale when nothing matches", () => {
    expect(resolveLocale(null, ["fr", "de"])).toBe("zh-hans");
    expect(resolveLocale(null, [])).toBe("zh-hans");
  });
});
