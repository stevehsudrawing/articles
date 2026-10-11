/**
 * The locale table: one entry per published locale, holding the identity, the
 * BCP-47 tag that `lang` and `hreflang` emit, and the language's own name.
 */
export const locales = [
  { identity: "zh-hans", tag: "zh-Hans", name: "中文 (简体)" },
  { identity: "zh-hant", tag: "zh-Hant", name: "中文 (繁體)" },
  { identity: "en", tag: "en", name: "English" },
] as const;

/**
 * A locale identity: the URL segment, the Astro locale, the content folder
 * name and the message file name, all at once.
 */
export type Locale = (typeof locales)[number]["identity"];

/** One row of the locale table. */
export type LocaleEntry = (typeof locales)[number];

/** The default locale, and the site's ultimate fallback. */
export const defaultLocale: Locale = "zh-hans";

/** The identities in table order, for Astro's `i18n.locales`. */
export const localeIdentities: Locale[] = locales.map(
  (locale) => locale.identity,
);

/**
 * Looks up a row of the locale table.
 *
 * @param identity - A locale identity.
 * @returns The table row for that identity.
 */
export function getLocale(identity: Locale): LocaleEntry {
  // Every `Locale` comes from the table, so the lookup cannot fail.
  return locales.find((locale) => locale.identity === identity)!;
}
