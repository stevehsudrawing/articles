import type { RSSFeedItem, RSSOptions } from "@astrojs/rss";
import { getRelativeLocaleUrl } from "astro:i18n";
import { articleUrl, type Article } from "./articles";
import { getLocale, type Locale } from "./i18n/locales";
import { t } from "./i18n/messages";
import { AUTHOR_EMAIL } from "./site";
import { absoluteUrl } from "./site-assets";

/**
 * A locale's feed: the file a reader subscribes to, and what goes in it.
 *
 * The module decides and `@astrojs/rss` writes, which is the split
 * `src/sitemap.ts` keeps with its route - except that here the writer is the
 * library, so this module hands over options rather than a document. The reason
 * for the split is the same one: `getCollection()` returns `[]` inside Vitest,
 * so everything that reads a collection stays in the route and everything that
 * decides is a pure function the suite can drive.
 */

/** The namespace that gives the channel's `<atom:link>` its meaning. */
const ATOM_NS = "http://www.w3.org/2005/Atom";

/**
 * The site-relative path of a locale's feed.
 *
 * Composed from the locale's root rather than from
 * `getRelativeLocaleUrl(locale, "rss.xml")`: with `trailingSlash: "always"` that
 * call returns `/articles/en/rss.xml/`, because `shouldAppendForwardSlash()`
 * answers before it looks at the format - passing `format: "file"` changes
 * nothing. The file is `rss.xml`, and the slash-terminated address is not its
 * path.
 *
 * @param locale - The locale whose feed to name.
 * @returns The path under the site's base, with no trailing slash.
 */
export function feedUrl(locale: Locale): string {
  return `${getRelativeLocaleUrl(locale, "")}rss.xml`;
}

/**
 * The articles as feed items, in the order they are given.
 *
 * The caller hands over `published()`, so a draft is in no feed and the order
 * is the site's own, newest first. An item carries the three facts the article
 * already states - its title, its address and its description. The body is not
 * included: a mirror of the article's markdown is the full text a machine
 * reads, and a feed that carried a rendering of the page would be a second copy
 * of it.
 *
 * @param locale - The locale the items are written for.
 * @param articles - That locale's published articles, newest first.
 * @returns One item per article.
 */
export function feedItems(
  locale: Locale,
  articles: readonly Article[],
): RSSFeedItem[] {
  return articles.map((article) => ({
    title: article.data.title,
    link: absoluteUrl(articleUrl(locale, article.id)),
    description: article.data.description,
    // A date-only string is parsed as UTC (ECMA-262), and `toUTCString()` reads
    // no host zone, so the file holds the same bytes on any machine.
    pubDate: new Date(article.data.date),
  }));
}

/**
 * Everything `@astrojs/rss` needs for one locale's feed.
 *
 * The channel names the site, introduces itself with the home page's own
 * sentence, and links the locale's root. The three facts `customData` adds are
 * the ones the library has no property for: the language, the address to write
 * to, and the feed's own address. They are written in that order because the
 * library merges them into `<channel>` as they appear, and a channel's
 * `<atom:link>` conventionally comes last.
 *
 * The address is the site's, not a byline's: no item carries `<author>`, because
 * an article may name someone else and this repository holds one address.
 *
 * @param locale - The locale whose feed to build.
 * @param articles - That locale's published articles, newest first.
 * @returns The options to hand to `rss()`.
 */
export function feedOptions(
  locale: Locale,
  articles: readonly Article[],
): RSSOptions {
  const tag = getLocale(locale).tag;
  const editor = `${AUTHOR_EMAIL} (${t(locale, "text-site-author")})`;
  const self = absoluteUrl(feedUrl(locale));

  return {
    title: t(locale, "text-site-name"),
    description: t(locale, "text-hero-description-home"),
    site: absoluteUrl(getRelativeLocaleUrl(locale, "")),
    items: feedItems(locale, articles),
    xmlns: { atom: ATOM_NS },
    customData: [
      `<language>${tag}</language>`,
      `<managingEditor>${editor}</managingEditor>`,
      `<atom:link rel="self" type="application/rss+xml" href="${self}" />`,
    ].join(""),
  };
}
