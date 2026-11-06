import { getRelativeLocaleUrl } from "astro:i18n";
import { listUrl } from "./articles";
import type { Locale } from "./i18n/locales";
import { t } from "./i18n/messages";
import { tagIndexUrl } from "./tags";

/**
 * A page's trail through the site, shown above its heading and described as a
 * `BreadcrumbList`.
 *
 * One value serves both halves, which is what keeps the visible trail and the
 * structured one from drifting apart. Two page kinds have a trail and only two:
 * an article is filed under the list, a tag page under the tag index. The home,
 * the list, the tag index and the error page render none, because a trail whose
 * every step is one link says nothing a reader does not already know from the
 * header.
 */

/** One step of a trail. The last step is the page itself, so it has no `href`. */
export interface TrailStep {
  /** The step's name: a navigation label, or the page's own heading. */
  label: string;
  /** Where the step leads, absent on the current page. */
  href?: string;
}

/** A page's trail, and the name of the landmark that holds it. */
export interface Trail {
  /**
   * The `<nav>`'s accessible name. The trail has no visible heading, so this is
   * the only thing that tells a screen reader what the list is.
   */
  label: string;
  steps: TrailStep[];
}

/**
 * The first step of every trail: the locale's home.
 *
 * It needs no URL builder, because it is the locale's root and has no path that
 * could drift from the route that serves it.
 *
 * @param locale - The locale whose home to name.
 * @returns The step linking there.
 */
function homeStep(locale: Locale): TrailStep {
  return {
    label: t(locale, "text-nav-home"),
    href: getRelativeLocaleUrl(locale, ""),
  };
}

/**
 * The trail of an article page: home, the article list, the article.
 *
 * The list is not the article's URL ancestor - the article sits beside it, not
 * under it - so the trail declares the section the article belongs to rather
 * than the path it happens to have.
 *
 * @param locale - The locale the page is written in.
 * @param title - The article's title, which is the trail's last step.
 * @returns The trail.
 */
export function articleTrail(locale: Locale, title: string): Trail {
  return {
    label: t(locale, "text-nav-breadcrumb"),
    steps: [
      homeStep(locale),
      { label: t(locale, "text-nav-list"), href: listUrl(locale) },
      { label: title },
    ],
  };
}

/**
 * The trail of a tag page: home, the tag index, the tag.
 *
 * Here the middle step really is an ancestor - the tag's pages live under the
 * tag index's own directory - so the trail is the path as well as the section.
 *
 * @param locale - The locale the page is written in.
 * @param tag - The tag's slug, whose label is the trail's last step.
 * @returns The trail.
 */
export function tagTrail(locale: Locale, tag: string): Trail {
  return {
    label: t(locale, "text-nav-breadcrumb"),
    steps: [
      homeStep(locale),
      { label: t(locale, "text-nav-tags"), href: tagIndexUrl(locale) },
      { label: t(locale, `text-tag-${tag}`) },
    ],
  };
}
