import en from "./messages/en.json";
import zhHans from "./messages/zh-hans.json";
import zhHant from "./messages/zh-hant.json";
import { defaultLocale, type Locale } from "./locales";

/** One locale's messages: a flat map from a key to a value. */
type Messages = Record<string, string>;

/** The three message tables, keyed by the locale identity they are named after. */
const TABLES: Record<Locale, Messages> = {
  "zh-hans": zhHans,
  en,
  "zh-hant": zhHant,
};

/**
 * Substitutes positional placeholders `%1`..`%n` with the values given.
 *
 * @param value - The message value, as written in the table.
 * @param values - The values, in the order the placeholders number them.
 * @returns The value with every placeholder replaced.
 */
export function interpolate(value: string, values: readonly string[]): string {
  return value.replace(/%(\d+)/g, (match, n) => values[Number(n) - 1] ?? match);
}

/**
 * Reads one message and substitutes its placeholders.
 *
 * `zh-hans` is the base: a key missing from the reader's locale falls back to
 * it, and a key missing from the base as well is a bug rather than a graceful
 * degradation, so it throws. A value that still carries a placeholder after
 * substitution is a bug too - a locale that dropped one - and the reader would
 * otherwise see a literal `%1` on the page, which is why this throws rather than
 * rendering it.
 *
 * @param locale - The locale whose copy the page is written in.
 * @param key - The message key, such as `text-nav-home`.
 * @param values - The values for the key's `%1`..`%n` placeholders.
 * @returns The localized string.
 * @throws If no locale has the key, or if a placeholder is left unmatched.
 */
export function t(
  locale: Locale,
  key: string,
  ...values: readonly string[]
): string {
  const value = TABLES[locale][key] ?? TABLES[defaultLocale][key];

  if (value === undefined) {
    throw new Error(
      `No message "${key}": every key must exist in ${defaultLocale}.json.`,
    );
  }

  const result = interpolate(value, values);

  const leftover = result.match(/%\d+/);
  if (leftover) {
    throw new Error(
      `Message "${key}" still carries ${leftover[0]} after substitution; every locale's value has to use the same placeholders as ${defaultLocale}.json.`,
    );
  }

  return result;
}

/**
 * A locale's whole table, for the checks that compare locales.
 *
 * @param locale - The locale to read.
 * @returns That locale's messages.
 */
export function messagesOf(locale: Locale): Messages {
  return TABLES[locale];
}
