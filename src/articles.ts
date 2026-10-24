import { getCollection, type CollectionEntry } from "astro:content";
import type { PaginateFunction } from "astro";
import { getRelativeLocaleUrl } from "astro:i18n";
import { defaultLocale, localeIdentities, type Locale } from "./i18n/locales";
import { asset, COVER_HEIGHT, COVER_WIDTH, IMAGES } from "./site-assets";

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
 * The images an article's page and its card show, and the size to declare.
 *
 * The hero and the card ask one question - "which files does this article
 * show?" - and used to answer it separately. An article with a cover shows its
 * own light file and its optional dark twin; an article without one shows the
 * site's default pair, so a coverless page and a coverless card follow the
 * theme too. The dimensions travel with the URLs because a card writes them as
 * the image's intrinsic size, and a declared cover's have already passed
 * `assertCoverSize()`.
 *
 * `dark` is absent, not empty, when there is no twin: the attribute that marks
 * a pair must not appear on a lone image, which is the whole rule the toggle
 * rests on.
 *
 * @param article - The article, as the collection hands it over.
 * @returns The URLs to show and the size to declare for them.
 */
export function coverPair(article: Article): {
  light: string;
  dark?: string;
  width: number;
  height: number;
} {
  const cover = article.data.cover;
  if (cover) {
    return {
      light: cover.light.src,
      dark: cover.dark?.src,
      width: cover.light.width,
      height: cover.light.height,
    };
  }
  return {
    light: asset(IMAGES.defaultCoverLight),
    dark: asset(IMAGES.defaultCoverDark),
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
  };
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
          `${locale} holds "${article.id}", which ${defaultLocale} does not have. Every article needs a ${defaultLocale} version: add src/content/${article.id}/${defaultLocale}.md or remove the file.`,
        );
      }
    }
  }
}

/**
 * The frontmatter one article states once for all of its locales.
 *
 * These three describe the article rather than a translation of it: its byline,
 * the license it is published under and the tags it is filed with. `date` is
 * not here, because every locale file's date is already checked against the
 * folder's.
 */
export const SHARED_FIELDS = ["author", "license", "tags"] as const;

/**
 * Renders one field's value for a failure message.
 *
 * @param value - The field's value, which may be absent.
 * @returns The value as the author would read it back.
 */
function describe(value: unknown): string {
  if (value === undefined) {
    return "unset";
  }
  return Array.isArray(value) ? `[${value.join(", ")}]` : String(value);
}

/**
 * What differs between the locales of one article, or nothing when they agree.
 *
 * Pure, so a test can drive it without a collection. The values are compared as
 * the schema produced them, so two tag lists holding the same tags in a
 * different order count as a difference - which is intended: one article has
 * one tag list, and the order is the order they render in.
 *
 * @param entries - Two or more locales of the same article.
 * @returns The message naming the field and both files, or `undefined`.
 */
export function sharedFieldMismatch(
  entries: readonly Article[],
): string | undefined {
  const [first, ...rest] = entries;
  if (!first) {
    return undefined;
  }

  for (const other of rest) {
    for (const field of SHARED_FIELDS) {
      const mine = describe(first.data[field]);
      const theirs = describe(other.data[field]);
      if (mine !== theirs) {
        return `"${field}" differs between ${first.filePath ?? first.id} (${mine}) and ${other.filePath ?? other.id} (${theirs}). An article states it once for every locale, so make them the same.`;
      }
    }
  }

  return undefined;
}

/**
 * Fails the build when the locales of one article disagree about it.
 *
 * `content-layout.ts` keeps the file paths honest; this keeps the values
 * honest, so "the license belongs to the article" is a fact rather than a
 * convention an author has to remember. Only published entries are compared: a
 * draft is not part of the site yet, and it is checked when it publishes.
 *
 * @throws If `author`, `license` or `tags` differ between two locales of one
 * article.
 */
export async function assertSharedFields(): Promise<void> {
  const byId = new Map<string, Article[]>();

  for (const locale of localeIdentities) {
    for (const article of await published(locale)) {
      const group = byId.get(article.id) ?? [];
      group.push(article);
      byId.set(article.id, group);
    }
  }

  for (const entries of byId.values()) {
    const mismatch = sharedFieldMismatch(entries);
    if (mismatch) {
      throw new Error(mismatch);
    }
  }
}

/**
 * The collection checks every page that renders articles runs first.
 *
 * They read the collections, which exist only once the content layer has
 * synced, so they cannot live in `content.config.ts` the way the file-layout
 * guard does. They are called by each locale's home page rather than by an
 * article route, because a route's frontmatter runs once per rendered path: an
 * article route with no articles renders nothing and runs nothing, so a check
 * placed there cannot see the state that leaves an article unreachable.
 */
export async function assertArticles(): Promise<void> {
  await assertDefaultCovers();
  await assertSharedFields();
}
