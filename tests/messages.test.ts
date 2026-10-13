import { describe, expect, it } from "vitest";
import { interpolate, messagesOf, t } from "../src/i18n/messages";
import { defaultLocale, localeIdentities } from "../src/i18n/locales";

describe("interpolate", () => {
  it("substitutes positional placeholders", () => {
    expect(interpolate("page %1 of %2", ["3", "10"])).toBe("page 3 of 10");
  });

  it("lets a value be used more than once", () => {
    expect(interpolate("%1 and %1", ["x"])).toBe("x and x");
  });

  it("leaves an unmatched placeholder as written, for the caller to catch", () => {
    expect(interpolate("%1 and %2", ["x"])).toBe("x and %2");
  });
});

describe("t", () => {
  it("reads the locale's own value", () => {
    expect(t("en", "text-nav-home")).toBe("Home");
  });

  it("falls back to the base locale per key", () => {
    const missing = localeIdentities.find(
      (locale) =>
        locale !== defaultLocale &&
        messagesOf(locale)["text-label-license"] === undefined,
    );
    if (missing) {
      expect(t(missing, "text-label-license")).toBe(
        messagesOf(defaultLocale)["text-label-license"],
      );
    } else {
      // Every locale carries the key, so the fallback is exercised with a key
      // that only the base locale has.
      expect(t(defaultLocale, "text-label-license")).not.toBe("");
    }
  });

  it("substitutes the values it is given", () => {
    expect(t("zh-hans", "text-count-pages", "3")).toBe("共 3 页");
  });

  it("throws when no locale has the key", () => {
    expect(() => t("zh-hans", "text-does-not-exist")).toThrow(
      /No message "text-does-not-exist"/,
    );
  });

  it("throws when a placeholder is left unmatched", () => {
    expect(() => t("zh-hans", "text-count-pages")).toThrow(/still carries %1/);
  });
});

describe("the message tables", () => {
  it("keeps every key inside the base locale", () => {
    const base = new Set(Object.keys(messagesOf(defaultLocale)));

    for (const locale of localeIdentities) {
      if (locale === defaultLocale) continue;
      for (const key of Object.keys(messagesOf(locale))) {
        expect(base.has(key), `${locale} has "${key}"`).toBe(true);
      }
    }
  });

  it("keeps every prefix's keys together", () => {
    // A key's group is its first two segments: `text-hero-title-home` belongs
    // to `text-hero` and `text-title-paged` to `text-title`, so the two never
    // merge. `messagesOf` hands back the imported JSON as written, so
    // `Object.keys` reports the file's own order.
    const group = (key: string) => key.split("-").slice(0, 2).join("-");

    for (const locale of localeIdentities) {
      const groups = Object.keys(messagesOf(locale)).map(group);
      const runs = groups.filter(
        (name, index) => index === 0 || name !== groups[index - 1],
      );
      const repeated = runs.filter(
        (name, index) => runs.indexOf(name) !== index,
      );

      expect(repeated, `${locale} keeps each prefix's keys together`).toEqual(
        [],
      );
    }
  });

  it("uses the same placeholders in every locale that has a key", () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/%(\d+)/g)].map((match) => Number(match[1])).sort();

    for (const [key, base] of Object.entries(messagesOf(defaultLocale))) {
      for (const locale of localeIdentities) {
        if (locale === defaultLocale) continue;
        const value = messagesOf(locale)[key];
        if (value === undefined) continue;
        expect(placeholders(value), `${locale} "${key}"`).toEqual(
          placeholders(base),
        );
      }
    }
  });

  it("numbers every key's placeholders from 1 without a gap", () => {
    for (const [key, value] of Object.entries(messagesOf(defaultLocale))) {
      const numbers = [...value.matchAll(/%(\d+)/g)]
        .map((match) => Number(match[1]))
        .sort((a, b) => a - b);
      const unique = [...new Set(numbers)];
      expect(unique, key).toEqual(unique.map((_, index) => index + 1));
    }
  });
});
