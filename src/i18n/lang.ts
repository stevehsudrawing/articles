import type { Locale } from "./locales";
import { defaultLocale } from "./locales";

/** Tags the main site maps to Traditional Chinese. */
const TRADITIONAL: ReadonlySet<string> = new Set([
  "zh-hk",
  "zh-mo",
  "zh-tw",
  "zh-hant",
]);

/** Tags the main site maps to Simplified Chinese. */
const SIMPLIFIED: ReadonlySet<string> = new Set([
  "zh-hans",
  "zh-cn",
  "zh-sg",
  "zh",
]);

/**
 * Finds the locale a language tag names.
 *
 * @param tag - A BCP-47 language tag, such as `zh-TW` or `en-US`.
 * @returns The matching locale identity, or `undefined` for a language the
 *   site does not publish.
 */
export function matchLang(tag: string): Locale | undefined {
  const lower = tag.trim().toLowerCase();
  if (lower === "") return undefined;

  if (TRADITIONAL.has(lower) || lower.startsWith("zh-hant-")) {
    return "zh-hant";
  }
  if (SIMPLIFIED.has(lower) || lower.startsWith("zh-hans-")) {
    return "zh-hans";
  }
  // Any other `zh` variant is Simplified Chinese.
  if (lower.startsWith("zh")) return "zh-hans";
  if (lower === "en" || lower.startsWith("en-")) return "en";
  return undefined;
}

/**
 * Normalizes a language tag to a locale identity the site supports.
 *
 * A mirror of the main site's `normalizeLang()`, with one deliberate
 * difference: the ultimate fallback is `zh-hans`, not `en`.
 *
 * @param tag - A BCP-47 language tag, such as `zh-TW` or `en-US`.
 * @returns The matching locale identity, or `zh-hans` when none matches.
 */
export function normalizeLang(tag: string): Locale {
  return matchLang(tag) ?? defaultLocale;
}

/**
 * Resolves the language for the bare root: the shared `lang` when it holds a
 * `zh-*` value, then the browser's own preferences, then the default locale.
 *
 * A shared `lang` of `en` is skipped, because the main site writes its own
 * default on every load and `en` therefore cannot be told from a real choice.
 *
 * @param stored - The value of the shared `lang` key, or `null`.
 * @param browserLanguages - `navigator.languages`, most preferred first.
 * @returns The locale identity to navigate to.
 */
export function resolveLocale(
  stored: string | null,
  browserLanguages: readonly string[],
): Locale {
  const shared = stored?.trim().toLowerCase() ?? "";
  if (shared === "zh" || shared.startsWith("zh-")) {
    return matchLang(shared) ?? defaultLocale;
  }

  for (const tag of browserLanguages) {
    const match = matchLang(tag);
    if (match) return match;
  }
  return defaultLocale;
}
