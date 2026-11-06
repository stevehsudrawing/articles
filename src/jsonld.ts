import { getRelativeLocaleUrl } from "astro:i18n";
import type { Trail } from "./breadcrumbs";
import { getLocale, type Locale } from "./i18n/locales";
import { MAIN_SITE_URL } from "./site";
import { absoluteUrl, type ShareImage } from "./site-assets";

/**
 * The page's structured data: one `@graph` per page, built from the facts the
 * page already holds.
 *
 * The shape is a graph rather than a single node because three entities answer
 * for every page - the site, its author and the page itself - and a graph lets
 * each be defined once per document instead of repeated inside the others. The
 * page's own node is the one that changes with the page kind.
 *
 * Ids are derived here and nowhere else. A caller passes URLs and gets ids, so
 * two pages cannot disagree about where an entity lives and a layout cannot
 * invent one. The builders take absolute URLs rather than reading
 * `import.meta.env`, which is also what makes them testable: under Vitest the
 * configured site is present but the base path is not.
 */

/**
 * The site as one locale publishes it: the two absolute URLs ids are built
 * from, and the BCP-47 tag its pages declare.
 */
export interface LocaleSite {
  /** The site's root under its base path: where the author's entity lives. */
  root: string;
  /** The locale's home, which is the `WebSite` node of everything under it. */
  home: string;
  /** The locale's BCP-47 tag, from the locale table. */
  tag: string;
}

/** A reference to a node defined elsewhere in the same graph. */
export interface IdRef {
  "@id": string;
}

/** An image, with the size a crawler would otherwise fetch it to learn. */
export interface ImageObject {
  "@type": "ImageObject";
  /** The image's absolute URL. */
  url: string;
  width: number;
  height: number;
}

/** The site one locale serves. */
export interface WebSiteNode {
  "@type": "WebSite";
  "@id": string;
  url: string;
  name: string;
  inLanguage: string;
}

/** The person who writes it. */
export interface PersonNode {
  "@type": "Person";
  "@id": string;
  name: string;
  url: string;
}

/** The page itself, whatever kind it is. */
export interface PageNode {
  "@type": "WebPage" | "CollectionPage";
  "@id": string;
  url: string;
  name: string;
  description: string;
  inLanguage: string;
  isPartOf: IdRef;
}

/** One article, as the page that renders it describes it. */
export interface BlogPostingNode {
  "@type": "BlogPosting";
  "@id": string;
  headline: string;
  description: string;
  image: ImageObject;
  datePublished: string;
  dateModified?: string;
  author: IdRef;
  inLanguage: string;
  license?: string;
  isPartOf: IdRef;
  mainEntityOfPage: IdRef;
}

/** One step of a `BreadcrumbList`. */
export interface ListItemNode {
  "@type": "ListItem";
  /** The step's place in the trail, counting from 1. */
  position: number;
  name: string;
  /** Where the step leads: absent on the page's own step. */
  item?: string;
}

/** The page's place in the site, as the trail above its heading shows it. */
export interface BreadcrumbListNode {
  "@type": "BreadcrumbList";
  "@id": string;
  itemListElement: ListItemNode[];
}

/** Any node a page's graph may hold. */
export type JsonLdNode =
  WebSiteNode | PersonNode | PageNode | BlogPostingNode | BreadcrumbListNode;

/** The document a page writes: one context, one graph. */
export interface PageGraph {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
}

/**
 * The two URLs and the language tag one locale's pages are described with.
 *
 * This is the only place in the module that reads `import.meta.env`, and it is
 * deliberately not unit-tested: under Vitest the base path is `/` rather than
 * the site's, so a test of this function would pin a URL the site never serves.
 * The builders below take its result as an argument and are tested with URLs of
 * their own.
 *
 * @param locale - The locale whose pages are being described.
 * @returns Its root URL, its home URL and its BCP-47 tag.
 */
export function localeSite(locale: Locale): LocaleSite {
  return {
    root: absoluteUrl(import.meta.env.BASE_URL),
    home: absoluteUrl(getRelativeLocaleUrl(locale, "")),
    tag: getLocale(locale).tag,
  };
}

/**
 * The id of the author's entity.
 *
 * It hangs off the site root rather than a locale's home because the author is
 * one person: a fragment per locale would describe three.
 *
 * @param site - The locale's site.
 * @returns The absolute id.
 */
function personId(site: LocaleSite): string {
  return `${site.root}#person`;
}

/**
 * The id of one locale's `WebSite` entity, which every page under it is part of.
 *
 * @param site - The locale's site.
 * @returns The absolute id.
 */
function webSiteId(site: LocaleSite): string {
  return `${site.home}#website`;
}

/**
 * The id of a page's own entity.
 *
 * @param url - The page's absolute URL.
 * @returns The absolute id.
 */
function webPageId(url: string): string {
  return `${url}#webpage`;
}

/**
 * The id of an article's entity, which is not the page that renders it.
 *
 * @param url - The article page's absolute URL.
 * @returns The absolute id.
 */
function articleId(url: string): string {
  return `${url}#article`;
}

/** What a page contributes to its graph. */
export interface PageFacts {
  /** The site as this locale publishes it. */
  site: LocaleSite;
  /** The page's own absolute URL, which its `WebPage` id is built from. */
  url: string;
  /** The page's name: the string `<title>` shows. */
  name: string;
  /** The page's introduction, which its description and its card also carry. */
  description: string;
  /** The site's formal name, which the home page's heading shows. */
  siteName: string;
  /** The author this page states: its byline, or the site's author. */
  author: string;
  /** A document of its own, or one of a collection. */
  type: "WebPage" | "CollectionPage";
  /** The nodes only the page can build, appended after its own. */
  nodes?: JsonLdNode[];
}

/**
 * Builds the graph a page writes: the site, its author, the page and whatever
 * the page adds.
 *
 * The page's node is written even where nothing references it, because it is
 * what an article's `mainEntityOfPage` resolves to - an id that is referenced
 * and never defined is the one thing a graph must not contain.
 *
 * @param facts - The page's own values.
 * @returns The graph, ready to serialize.
 */
export function pageGraph(facts: PageFacts): PageGraph {
  const { site, url } = facts;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": webSiteId(site),
        url: site.home,
        name: facts.siteName,
        inLanguage: site.tag,
      },
      {
        "@type": "Person",
        "@id": personId(site),
        name: facts.author,
        url: MAIN_SITE_URL,
      },
      {
        "@type": facts.type,
        "@id": webPageId(url),
        url,
        name: facts.name,
        description: facts.description,
        inLanguage: site.tag,
        isPartOf: { "@id": webSiteId(site) },
      },
      ...(facts.nodes ?? []),
    ],
  };
}

/** What an article contributes to the graph of the page that renders it. */
export interface ArticleFacts {
  /** The site as this locale publishes it. */
  site: LocaleSite;
  /** The article page's absolute URL, which its two ids are built from. */
  url: string;
  /** The article's title, which the page's heading also shows. */
  headline: string;
  /** The article's introduction. */
  description: string;
  /** The card the page advertises: the file its hero serves, with its size. */
  image: ShareImage;
  /** The frontmatter's `date`, an ISO 8601 calendar date. */
  datePublished: string;
  /** The frontmatter's `updated`, written only when it differs. */
  dateModified?: string;
  /** The license's URL, when the article's license has a document to point at. */
  license?: string;
}

/**
 * Builds the `BlogPosting` node an article page adds to its graph.
 *
 * A date goes out as the content states it: the frontmatter's `YYYY-MM-DD` is
 * an ISO 8601 calendar date, and adding a time of day would invent one. The
 * modification date is dropped when it repeats the publication date, because a
 * second date that says nothing is noise rather than information.
 *
 * @param facts - The article's own values.
 * @returns The node, for the page's graph.
 */
export function articleNode(facts: ArticleFacts): BlogPostingNode {
  const node: BlogPostingNode = {
    "@type": "BlogPosting",
    "@id": articleId(facts.url),
    headline: facts.headline,
    description: facts.description,
    image: {
      "@type": "ImageObject",
      url: facts.image.url,
      width: facts.image.width,
      height: facts.image.height,
    },
    datePublished: facts.datePublished,
    author: { "@id": personId(facts.site) },
    inLanguage: facts.site.tag,
    isPartOf: { "@id": webSiteId(facts.site) },
    mainEntityOfPage: { "@id": webPageId(facts.url) },
  };

  if (facts.dateModified && facts.dateModified !== facts.datePublished) {
    node.dateModified = facts.dateModified;
  }
  if (facts.license) {
    node.license = facts.license;
  }

  return node;
}

/**
 * Builds the `BreadcrumbList` node for the trail a page shows.
 *
 * Google's rules, read 2026-11-05: every step needs `position` and `name`, and
 * `item` on all but the last - there the containing page's own URL is what the
 * step names, so writing it would only repeat the page. `item` is absolute
 * because the rest of the graph is, and a relative one would resolve against
 * the document by luck alone.
 *
 * @param trail - The trail the page renders, ending with the page itself.
 * @param url - The page's absolute URL, which its id is built from.
 * @returns The node, for the page's graph.
 */
export function breadcrumbNode(trail: Trail, url: string): BreadcrumbListNode {
  return {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: trail.steps.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.label,
      ...(step.href ? { item: absoluteUrl(step.href) } : {}),
    })),
  };
}

/**
 * Writes a graph as the text of a `<script type="application/ld+json">`.
 *
 * `<` is escaped to `\u003c` because the element ends at the first `</script>`,
 * so a title containing one would close it and spill the rest of the graph into
 * the document. The escape is JSON's own: a parser reads the same string back,
 * and the HTML tokenizer sees no tag opener.
 *
 * @param graph - The graph to write.
 * @returns The JSON, safe to place inside the element.
 */
export function serializeGraph(graph: PageGraph): string {
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
