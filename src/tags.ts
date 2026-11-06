import type { PaginateFunction } from "astro";
import { getRelativeLocaleUrl } from "astro:i18n";
import { PER_PAGE, published, type Article } from "./articles";
import { defaultLocale, type Locale } from "./i18n/locales";
import { messagesOf } from "./i18n/messages";

/**
 * Tags, read from the articles that carry them.
 *
 * A tag is a locale-neutral slug whose display name is the message key
 * `text-tag-<slug>`, so the vocabulary and the message file are one mechanism.
 * The set belongs to the site rather than to a locale: every locale's index
 * lists every tag, because a published article in any locale always has a
 * default-locale version, and because the header's language switcher assumes
 * every locale serves the same page shapes.
 */

/**
 * The site's tags, most used first.
 *
 * @param counts - How many articles carry each tag.
 * @returns The tags, by count descending and then by slug ascending, so the
 *   order is total and a rebuild cannot shuffle two tags that tie.
 */
export function tagOrder(counts: ReadonlyMap<string, number>): string[] {
  return [...counts.keys()].sort((a, b) => {
    const difference = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    if (difference !== 0) {
      return difference;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * A tag with no display name in the base locale, named for a failure message.
 *
 * Pure, so a test can drive it without a collection.
 *
 * @param tags - The tags the site uses.
 * @param messages - The base locale's message table.
 * @returns The message naming the first unlabeled tag, or `undefined` when
 *   every tag has one.
 */
export function tagLabelMismatch(
  tags: readonly string[],
  messages: Readonly<Record<string, string>>,
): string | undefined {
  for (const tag of tags) {
    const key = `text-tag-${tag}`;
    if (messages[key] === undefined) {
      return `The tag "${tag}" has no label: add "${key}" to src/i18n/messages/${defaultLocale}.json.`;
    }
  }
  return undefined;
}

/**
 * How many of one locale's published articles carry each tag.
 *
 * @param locale - The locale whose articles to count.
 * @returns A tag-to-count map, holding only the tags that locale uses.
 */
export async function tagCounts(locale: Locale): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  for (const article of await published(locale)) {
    for (const tag of article.data.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return counts;
}

/**
 * The site's tags, in the order the index lists them.
 *
 * @returns Every tag the published articles carry, most used first.
 */
export async function siteTags(): Promise<string[]> {
  return tagOrder(await tagCounts(defaultLocale));
}

/**
 * One locale's published articles that carry a tag.
 *
 * @param locale - The locale whose articles to read.
 * @param tag - The tag to keep.
 * @returns Those articles, newest first.
 */
export async function articlesWithTag(
  locale: Locale,
  tag: string,
): Promise<Article[]> {
  return (await published(locale)).filter(({ data }) =>
    data.tags?.includes(tag),
  );
}

/**
 * The URL of one page of a locale's tag index.
 *
 * @param locale - The locale the reader is in.
 * @param page - The page number, 1-based.
 * @returns The locale-prefixed URL, with the trailing slash the site uses.
 */
export function tagIndexUrl(locale: Locale, page = 1): string {
  return getRelativeLocaleUrl(locale, `tags/page/${page}/`);
}

/**
 * The URL of one page of a tag's articles in a locale.
 *
 * @param locale - The locale the reader is in.
 * @param tag - The tag's slug.
 * @param page - The page number, 1-based.
 * @returns The locale-prefixed URL, with the trailing slash the site uses.
 */
export function tagPageUrl(locale: Locale, tag: string, page = 1): string {
  return getRelativeLocaleUrl(locale, `tags/${tag}/page/${page}/`);
}

/**
 * Fails the build when a used tag has no display name in the base locale.
 *
 * `t()` would throw on the same key, but it would say which key is missing and
 * not which tag introduced it, and a locale's fallback would hide the gap until
 * the base locale's own page rendered.
 *
 * @throws If a tag has no `text-tag-<slug>` key.
 */
export async function assertTagLabels(): Promise<void> {
  const mismatch = tagLabelMismatch(
    await siteTags(),
    messagesOf(defaultLocale),
  );
  if (mismatch) {
    throw new Error(mismatch);
  }
}

/**
 * The tag redirect routes' paths: one per tag, because a redirect needs the
 * tags but not their pages.
 *
 * @returns The function Astro calls to enumerate the paths.
 */
export function tagPaths() {
  return async () => (await siteTags()).map((tag) => ({ params: { tag } }));
}

/**
 * The tag index's `getStaticPaths`, paginated like the article list.
 *
 * Every locale paginates the same tags, so this takes no locale - the index's
 * content is the site's tag set and only its counts are per locale.
 *
 * @returns The function Astro calls to enumerate the pages.
 */
export function tagIndexPages() {
  return async ({ paginate }: { paginate: PaginateFunction }) =>
    paginate(await siteTags(), { pageSize: PER_PAGE });
}

/**
 * One tag's `getStaticPaths`, paginated over that locale's articles.
 *
 * The locale is passed rather than read, because `getStaticPaths` is hoisted to
 * module scope and cannot see a frontmatter constant (measured on the article
 * list route).
 *
 * @param locale - The locale whose articles the tag pages list.
 * @returns The function Astro calls to enumerate the paths.
 */
export function tagPages(locale: Locale) {
  return async ({ paginate }: { paginate: PaginateFunction }) => {
    const pages = await Promise.all(
      (await siteTags()).map(async (tag) =>
        paginate(await articlesWithTag(locale, tag), {
          pageSize: PER_PAGE,
          params: { tag },
        }),
      ),
    );
    return pages.flat();
  };
}
