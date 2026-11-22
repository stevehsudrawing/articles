import { getCollection, type CollectionEntry } from "astro:content";
import { getRelativeLocaleUrl } from "astro:i18n";
import { defaultLocale, localeIdentities, type Locale } from "./i18n/locales";

/** One license document, as the collection hands it over. */
export type License = CollectionEntry<"licenses">;

/**
 * A license's slug, taken from an entry's id.
 *
 * The id is `<slug>/<locale>`, so everything before the last segment is the
 * slug and everything after it is the locale.
 *
 * @param id - An entry's id.
 * @returns The slug.
 */
function slugOf(id: string): string {
  return id.slice(0, id.lastIndexOf("/"));
}

/**
 * The slug of one document.
 *
 * The routes and the markdown copies hold the entry rather than its id, so this
 * is where the two segments become the slug again.
 *
 * @param entry - The document's entry.
 * @returns The slug, which is the last segment of its URL but one.
 */
export function licenseSlug(entry: License): string {
  return slugOf(entry.id);
}

/**
 * A locale's license documents, ordered by slug.
 *
 * The filter reads the id rather than the data, because the id is what the
 * loader derived from the path: a document's language is the file it lives in,
 * not a field an author can get wrong.
 *
 * @param locale - The locale whose documents to read.
 * @returns That locale's documents, by slug.
 */
export async function licenseEntries(locale: Locale): Promise<License[]> {
  const entries = await getCollection("licenses", ({ id }) =>
    id.endsWith(`/${locale}`),
  );
  return [...entries].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * One license document in one locale.
 *
 * @param locale - The locale to read it in.
 * @param slug - The document's slug, which is its folder's name.
 * @returns The entry, or `undefined` when that locale has no file.
 */
export async function licenseEntry(
  locale: Locale,
  slug: string,
): Promise<License | undefined> {
  const entries = await getCollection(
    "licenses",
    ({ id }) => id === `${slug}/${locale}`,
  );
  return entries[0];
}

/**
 * The slugs every locale's license route is generated for.
 *
 * The default locale's set is the site's catalog; a locale holds a document
 * exactly when its file exists there. This is the same rule the article routes
 * use for their `getStaticPaths`.
 *
 * @returns The slugs, in order.
 */
export async function licenseSlugs(): Promise<string[]> {
  const entries = await licenseEntries(defaultLocale);
  return entries.map((entry) => slugOf(entry.id));
}

/**
 * The locales that hold one license document.
 *
 * @param slug - The document's slug.
 * @returns The locales, in the site's locale order.
 */
export async function licenseLocales(slug: string): Promise<Locale[]> {
  const entries = await getCollection(
    "licenses",
    ({ id }) => slugOf(id) === slug,
  );
  const held = new Set(
    entries.map((entry) => entry.id.slice(entry.id.lastIndexOf("/") + 1)),
  );
  return localeIdentities.filter((locale) => held.has(locale));
}

/**
 * The URL of a license document in one locale.
 *
 * @param locale - The locale the reader is in.
 * @param slug - The document's slug.
 * @returns The locale-prefixed URL, with the trailing slash the site uses.
 */
export function licenseUrl(locale: Locale, slug: string): string {
  return getRelativeLocaleUrl(locale, `licenses/${slug}/`);
}

/**
 * The URL of a license document's markdown copy in one locale.
 *
 * Composed from `licenseUrl()` for the reason `mirrorUrl()` is composed from
 * `articleUrl()`: `getRelativeLocaleUrl()` appends a slash under
 * `trailingSlash: "always"`, so the file name is joined afterwards.
 *
 * @param locale - The locale the copy is written in.
 * @param slug - The document's slug.
 * @returns The locale-prefixed path of the copy, with no trailing slash.
 */
export function licenseMirrorUrl(locale: Locale, slug: string): string {
  return `${licenseUrl(locale, slug)}index.md`;
}

/** What the site's inventory needs from one document. */
export interface LicenseRow {
  /** The document's slug, which is its URL's last segment. */
  slug: string;
  /** The newest date the document carries: `updated`, else its effective date. */
  lastmod: string;
}

/**
 * A locale's documents, as the inventory lists them.
 *
 * Only the two facts a sitemap entry needs: which document, and how fresh it
 * is. The page and the copy get their own data from {@link licenseEntry}.
 *
 * @param locale - The locale whose documents to list.
 * @returns One row per document, by slug.
 */
export async function licenseRows(locale: Locale): Promise<LicenseRow[]> {
  return (await licenseEntries(locale)).map((entry) => ({
    slug: licenseSlug(entry),
    lastmod: entry.data.updated ?? entry.data.effectiveDate,
  }));
}
