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

/**
 * The URL of one locale's catalog of licenses.
 *
 * @param locale - The locale the reader is in.
 * @returns The locale-prefixed URL, with the trailing slash the site uses.
 */
export function licenseIndexUrl(locale: Locale): string {
  return getRelativeLocaleUrl(locale, "licenses/");
}

/**
 * The locale an entry's id ends in.
 *
 * The loader derived that segment from the file's name and checked it against
 * the locale table, so a cast is the whole conversion.
 *
 * @param id - An entry's id, `<slug>/<locale>`.
 * @returns The locale the entry is written in.
 */
function localeOf(id: string): Locale {
  return id.slice(id.lastIndexOf("/") + 1) as Locale;
}

/** One document, as the catalog and the inventory list it. */
export interface LicenseRow {
  /** The document's slug, which is its URL's last segment. */
  slug: string;
  /** The locale holding the text this row describes. */
  locale: Locale;
  /** The document's title, in its own language. */
  title: string;
  /** The document's description, in its own language. */
  description: string;
  /** The text's version, as its frontmatter declares it. */
  version: string;
  /** The date the version took effect, `YYYY-MM-DD`. */
  effectiveDate: string;
  /** The newest date the document carries: `updated`, else its effective date. */
  lastmod: string;
  /** The URL of the page holding the text, in {@link LicenseRow.locale}. */
  url: string;
}

/**
 * One entry as a row.
 *
 * @param entry - The document's entry.
 * @returns The row, pointing at the locale the entry lives in.
 */
function row(entry: License): LicenseRow {
  const locale = localeOf(entry.id);
  const slug = licenseSlug(entry);
  return {
    slug,
    locale,
    title: entry.data.title,
    description: entry.data.description,
    version: entry.data.version,
    effectiveDate: entry.data.effectiveDate,
    lastmod: entry.data.updated ?? entry.data.effectiveDate,
    url: licenseUrl(locale, slug),
  };
}

/**
 * A locale's documents, as the inventory lists them.
 *
 * @param locale - The locale whose documents to list.
 * @returns One row per document, by slug.
 */
export async function licenseRows(locale: Locale): Promise<LicenseRow[]> {
  return (await licenseEntries(locale)).map(row);
}

/**
 * Every document the site publishes, once each, as the catalog lists it.
 *
 * A row points at the locale that holds the text, not at the reader's own: a
 * reader in `en` following a Simplified Chinese license reaches the page rather
 * than a redirect. When a document does exist in the reader's language that
 * text wins, then the default locale's, so the choice is the same on every
 * catalog page.
 *
 * @param pageLocale - The locale the catalog is rendered in.
 * @returns One row per document, by slug.
 */
export async function licenseCatalog(
  pageLocale: Locale,
): Promise<LicenseRow[]> {
  // Sorted before grouping, so the map's insertion order is the slug order and
  // a second sort over the groups is not needed.
  const entries = [...(await getCollection("licenses"))].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const bySlug = new Map<string, License[]>();
  for (const entry of entries) {
    const slug = licenseSlug(entry);
    const held = bySlug.get(slug) ?? [];
    held.push(entry);
    bySlug.set(slug, held);
  }

  const rows: LicenseRow[] = [];
  for (const held of bySlug.values()) {
    const preferred =
      held.find((entry) => localeOf(entry.id) === pageLocale) ??
      held.find((entry) => localeOf(entry.id) === defaultLocale) ??
      held.at(0);
    if (preferred) rows.push(row(preferred));
  }

  return rows;
}
