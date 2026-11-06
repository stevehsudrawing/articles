import { getRelativeLocaleUrl } from "astro:i18n";
import { PER_PAGE, published, type Article } from "./articles";
import { localeIdentities, type Locale } from "./i18n/locales";
import { absoluteUrl } from "./site-assets";
import { articlesWithTag, siteTags } from "./tags";

/**
 * The inventory: what the site publishes, page by page.
 *
 * Every output that has to speak about "the public site" - the sitemap, the
 * feed, `llms.txt`, the audit - asks this module rather than re-deriving the
 * rules, because five copies of "a locale holds this article when its file
 * exists" is five places for them to drift apart.
 *
 * The questions it answers are: does this page exist, is it a page or a
 * redirect, may a crawler index it, which translations does it really have, and
 * when did its content last change.
 *
 * The module is split the way `site-assets.ts` is: `pagesOf()` decides
 * everything from data it is given and is tested, and `publicPages()` is the
 * one function that reads a collection - which it cannot be tested through,
 * because `getCollection()` returns `[]` inside Vitest.
 */

/**
 * What a page shows, for the one question that decides its indexability.
 *
 * The union is discriminated by which property is present rather than by a
 * `kind` field: `draft` is an article's own flag and `articles` is how many a
 * listing holds, so a field naming the shape would only restate them.
 */
export type Shown = { draft: boolean } | { articles: number };

/**
 * Whether a crawler may index a page.
 *
 * @param shown - An article's draft flag, or the number of articles a listing
 *   holds.
 * @returns `true` for a published article and for a listing holding an article,
 *   `false` for the two previews.
 */
export function isIndexable(shown: Shown): boolean {
  return "draft" in shown ? !shown.draft : shown.articles > 0;
}

/** The kinds of page the site publishes, in the order one locale lists them. */
export type PageKind = "home" | "list" | "tag-index" | "tag" | "article";

/** One real page: where it is, whether it may be indexed, and how fresh it is. */
export interface PublicPage {
  kind: PageKind;
  locale: Locale;
  /**
   * The page's path inside its locale, without the locale: `""` for the home,
   * `"page/2/"`, `"tags/sci-fi/page/1/"`, `"2026-10-11-seed/"`.
   *
   * Locale-free is what makes two locales' pages comparable: two records with
   * the same `path` are translations of one another.
   */
  path: string;
  /** The page's absolute URL, which is what a crawler is given. */
  url: string;
  /** Whether a crawler may index it. */
  indexable: boolean;
  /** The newest content date the page shows, `YYYY-MM-DD`, when it has one. */
  lastmod?: string;
}

/** What one locale publishes, as the collections report it. */
export interface LocaleContent {
  /** The locale's published articles, newest first. */
  articles: Article[];
  /** The site's tag set, in the order the tag index lists it. */
  tags: readonly string[];
}

/**
 * How many pages a listing of `items` runs to.
 *
 * Never zero: `paginate()` guarantees a first page even for an empty list
 * (`Math.max(1, …)`, measured in Astro 7), so a locale with nothing to show
 * still serves the page that shows it.
 *
 * @param items - How many entries the listing holds in total.
 * @returns The page count, at least one.
 */
function pageCount(items: number): number {
  return Math.max(1, Math.ceil(items / PER_PAGE));
}

/**
 * The entries one page of a listing shows.
 *
 * @param items - The whole listing, in its own order.
 * @param page - The page number, 1-based.
 * @returns That page's slice, which is empty past the end.
 */
function shownOn<T>(items: readonly T[], page: number): readonly T[] {
  const start = (page - 1) * PER_PAGE;
  return items.slice(start, start + PER_PAGE);
}

/**
 * The newest publication date among some articles.
 *
 * The publication date, not the modification date: a list's cards show when an
 * article was published, so a later edit does not change what the listing says.
 * The article's own page is the one place that reads `updated`.
 *
 * @param articles - The articles the page shows.
 * @returns The newest `date`, or `undefined` when there is none to read.
 */
function newestDate(articles: readonly Article[]): string | undefined {
  return articles.reduce<string | undefined>(
    (newest, article) =>
      newest === undefined || article.data.date > newest
        ? article.data.date
        : newest,
    undefined,
  );
}

/**
 * One locale's pages, in the order the inventory lists them.
 *
 * The order is fixed - home, then the list's pages, then the tag index's, then
 * the site's tag pages, then the articles newest first - so the same content
 * always produces the same list and a rendered file does not move.
 *
 * The home, the list and the tag index are indexable by construction: they
 * exist in every locale and are the site's own sections. Only the two previews
 * of `isIndexable()` can answer no.
 *
 * @param locale - The locale these pages belong to.
 * @param content - What that locale publishes.
 * @returns Its pages.
 */
export function pagesOf(locale: Locale, content: LocaleContent): PublicPage[] {
  const { articles, tags } = content;
  const page = (
    kind: PageKind,
    path: string,
    indexable: boolean,
    lastmod?: string,
  ): PublicPage => ({
    kind,
    locale,
    path,
    url: absoluteUrl(getRelativeLocaleUrl(locale, path)),
    indexable,
    lastmod,
  });

  const pages: PublicPage[] = [page("home", "", true, newestDate(articles))];

  const lists = pageCount(articles.length);
  for (let number = 1; number <= lists; number += 1) {
    pages.push(
      page(
        "list",
        `page/${number}/`,
        true,
        newestDate(shownOn(articles, number)),
      ),
    );
  }

  // The tag index's numbers are counts of this locale's articles, so they move
  // exactly when that set does.
  const indexes = pageCount(tags.length);
  for (let number = 1; number <= indexes; number += 1) {
    pages.push(
      page("tag-index", `tags/page/${number}/`, true, newestDate(articles)),
    );
  }

  // Every locale serves a page for every tag, because the tag set is the
  // site's; a locale that carries none of the articles is the preview commit 2
  // made it.
  for (const tag of tags) {
    const tagged = articles.filter(({ data }) => data.tags?.includes(tag));
    for (let number = 1; number <= pageCount(tagged.length); number += 1) {
      const shown = shownOn(tagged, number);
      pages.push(
        page(
          "tag",
          `tags/${tag}/page/${number}/`,
          isIndexable({ articles: shown.length }),
          newestDate(shown),
        ),
      );
    }
  }

  for (const article of articles) {
    pages.push(
      page(
        "article",
        `${article.id}/`,
        isIndexable({ draft: article.data.draft }),
        article.data.updated ?? article.data.date,
      ),
    );
  }

  return pages;
}

/**
 * Every real page the site publishes, in locale-table order.
 *
 * Redirect stubs are not here: they hand over to another URL, so they have no
 * content to date and nothing to index. Neither are the language gate and the
 * error page, which are not locale pages at all.
 *
 * @returns Every page, in the order of {@link pagesOf } for each locale.
 */
export async function publicPages(): Promise<PublicPage[]> {
  const tags = await siteTags();
  const pages: PublicPage[] = [];

  for (const locale of localeIdentities) {
    pages.push(...pagesOf(locale, { articles: await published(locale), tags }));
  }

  return pages;
}

/**
 * The locales whose page for one tag holds an article.
 *
 * The tag set is the site's, so every locale serves a page per tag and only
 * some of them fill it. This is what `hreflang` advertises for a tag page: an
 * empty page is `noindex`, and a page outside the index is not a translation of
 * anything. It asks `isIndexable()` rather than testing the count itself, so
 * "this page is indexable" and "this page is a translation" cannot disagree.
 *
 * It lives here rather than in `src/tags.ts` because it answers an inventory
 * question, and because `src/tags.ts` reads `isIndexable()`: importing it back
 * the other way would close a cycle between the two modules.
 *
 * @param tag - The tag's slug.
 * @returns The locales holding an article with that tag, in table order.
 */
export async function localesTagged(tag: string): Promise<Locale[]> {
  const held = await Promise.all(
    localeIdentities.map(async (locale) =>
      isIndexable({ articles: (await articlesWithTag(locale, tag)).length })
        ? locale
        : undefined,
    ),
  );
  return held.filter((locale): locale is Locale => locale !== undefined);
}
