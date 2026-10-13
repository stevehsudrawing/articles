import { getCollection, type CollectionEntry } from "astro:content";
import type { PaginateFunction } from "astro";
import { getRelativeLocaleUrl } from "astro:i18n";
import { defaultLocale, localeIdentities, type Locale } from "./i18n/locales";

/** One article, as the collection hands it over. */
export type Article = CollectionEntry<Locale>;

/**
 * Orders articles newest first.
 *
 * The date is the primary key and the id breaks a tie, so the order is total
 * and a rebuild cannot shuffle two articles that share a day.
 *
 * @param entries - The articles to order, in any order.
 * @returns A new array, newest first.
 */
export function order(entries: readonly Article[]): Article[] {
  return [...entries].sort((a, b) => {
    if (a.data.date !== b.data.date) {
      return a.data.date < b.data.date ? 1 : -1;
    }
    return b.id.localeCompare(a.id);
  });
}

/**
 * A locale's published articles, newest first.
 *
 * Drafts are filtered here rather than at each page, so "published" has one
 * definition and the list, the home page and the redirects cannot disagree.
 *
 * @param locale - The locale whose folder to read.
 * @returns That locale's published articles.
 */
export async function published(locale: Locale): Promise<Article[]> {
  const entries = await getCollection(locale, ({ data }) => !data.draft);
  return order(entries);
}

/**
 * The URL of an article in one locale.
 *
 * @param locale - The locale the reader is in.
 * @param id - The article's id, which is its folder's name.
 * @returns The locale-prefixed URL, with the trailing slash the site uses.
 */
export function articleUrl(locale: Locale, id: string): string {
  return getRelativeLocaleUrl(locale, `${id}/`);
}

/**
 * The slugs every locale's article route is generated for.
 *
 * The default locale's published set is the site's article list; a locale holds
 * an article exactly when its folder exists there.
 *
 * @returns The article ids, newest first.
 */
export async function articleSlugs(): Promise<string[]> {
  return (await published(defaultLocale)).map((article) => article.id);
}

/**
 * How many articles one list page shows.
 *
 * Twelve divides evenly by 1, 2 and 3, so no breakpoint leaves a ragged final
 * row, and the home's six divides by the same counts.
 */
export const PER_PAGE = 12;

/**
 * The `getStaticPaths` a list route exports, for one locale.
 *
 * It lives here because a route cannot write it as a frontmatter function:
 * Astro hoists `getStaticPaths` to module scope, so the locale and the page
 * size are not in its scope there (measured - the build failed with
 * `locale is not defined`). Exported, the route passes its locale literals in
 * and the page size keeps one home.
 *
 * The `paginate` parameter is Astro's own type rather than a hand-written one:
 * the route's `Astro.props` is inferred from this function's return type, so a
 * loose annotation would make `page` untyped in the page itself.
 *
 * @param locale - The locale whose list this route serves.
 * @returns The function Astro calls to enumerate the pages.
 */
export function articlePages(locale: Locale) {
  return async ({ paginate }: { paginate: PaginateFunction }) =>
    paginate(await published(locale), { pageSize: PER_PAGE });
}

/**
 * The locales that hold a real copy of one article.
 *
 * This is what `hreflang` advertises: a locale whose page is a redirect is not
 * a translation of the article, so it is never listed as one.
 *
 * @param id - The article's id.
 * @returns The locales holding it, in table order.
 */
export async function localesWith(id: string): Promise<Locale[]> {
  const held = await Promise.all(
    localeIdentities.map(async (locale) => {
      const found = await getCollection(
        locale,
        ({ id: entry }) => entry === id,
      );
      return found.length > 0 ? locale : undefined;
    }),
  );
  return held.filter((locale): locale is Locale => locale !== undefined);
}

/**
 * Where a reader who asked for a missing translation should be sent.
 *
 * @param id - The article's id.
 * @param locale - The locale whose URL was requested.
 * @returns The default locale's URL, or `undefined` when that locale holds the
 *   article and should render it instead.
 */
export async function redirectUrl(
  id: string,
  locale: Locale,
): Promise<string | undefined> {
  if (locale === defaultLocale) {
    return undefined;
  }
  const held = await getCollection(locale, ({ id: entry }) => entry === id);
  return held.length > 0 ? undefined : articleUrl(defaultLocale, id);
}

/**
 * Fails the build when a locale holds an article the default locale lacks.
 *
 * "Every article has a `zh-hans` version" is what makes the redirect rule
 * sound, and nothing else checks it: the article would simply never be
 * reachable from the list, in silence. This is the check that makes the rule
 * real, and it runs while the routes are generated.
 *
 * @throws If a non-default locale holds an id the default locale does not.
 */
export async function assertDefaultCovers(): Promise<void> {
  const known = new Set(await articleSlugs());

  for (const locale of localeIdentities) {
    if (locale === defaultLocale) {
      continue;
    }
    for (const article of await published(locale)) {
      if (!known.has(article.id)) {
        throw new Error(
          `${locale} holds "${article.id}", which ${defaultLocale} does not have. Every article needs a ${defaultLocale} version: add src/content/${defaultLocale}/${article.id}/index.md or remove the file.`,
        );
      }
    }
  }
}
