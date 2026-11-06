import { getRelativeLocaleUrl } from "astro:i18n";
import { defaultLocale, getLocale } from "./i18n/locales";
import type { PublicPage } from "./public-pages";
import { absoluteUrl } from "./site-assets";

/**
 * The sitemap: one document listing every page a crawler may index.
 *
 * It is a pure function over the inventory rather than a page that renders, so
 * the same records always produce the same bytes - no build timestamp, no
 * iteration over a set whose order is incidental - and so the rules it applies
 * can be tested.
 */

/** The namespace sitemaps.org defines. */
const SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

/** The namespace of the XHTML vocabulary, which carries the alternate links. */
const XHTML_NS = "http://www.w3.org/1999/xhtml";

/**
 * Escapes the three characters that cannot stand in XML text.
 *
 * A `<loc>` here is a URL built from a folder name, and a folder name may hold
 * an `&`; XML would read the raw character as the start of an entity and the
 * document would stop being well formed.
 *
 * @param text - The text to place in an element.
 * @returns The same text, safe inside one.
 */
function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Renders the sitemap for a set of pages.
 *
 * Only indexable pages appear, and a page's alternates are the indexable
 * records that share its path: an empty tag page is `noindex`, so no page may
 * name it as a translation. `x-default` is built from the page's path and the
 * default locale, which is exactly how the head builds the one it writes
 * beside `hreflang`, so the two files cannot come to describe the page
 * differently.
 *
 * `<changefreq>` and `<priority>` are not written: Google documents that it
 * ignores both, and a number nobody reads invites tuning.
 *
 * @param pages - The inventory, in the order the document should list it.
 * @returns The sitemap document, with a trailing newline.
 */
export function sitemapXml(pages: readonly PublicPage[]): string {
  const listed = pages.filter((page) => page.indexable);

  const byPath = new Map<string, PublicPage[]>();
  for (const page of listed) {
    const group = byPath.get(page.path) ?? [];
    group.push(page);
    byPath.set(page.path, group);
  }

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="${SITEMAP_NS}" xmlns:xhtml="${XHTML_NS}">`,
  ];

  for (const page of listed) {
    lines.push("  <url>", `    <loc>${escapeXml(page.url)}</loc>`);
    if (page.lastmod) {
      lines.push(`    <lastmod>${page.lastmod}</lastmod>`);
    }
    for (const alternate of byPath.get(page.path) ?? [page]) {
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${getLocale(alternate.locale).tag}" href="${escapeXml(alternate.url)}" />`,
      );
    }
    lines.push(
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(absoluteUrl(getRelativeLocaleUrl(defaultLocale, page.path)))}" />`,
    );
    lines.push("  </url>");
  }

  lines.push("</urlset>");

  return `${lines.join("\n")}\n`;
}
