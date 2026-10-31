/**
 * The article's reading size.
 *
 * A reader steps the prose through these scales with the article tools bar, and
 * the rules in `base.css` multiply the body's size and every heading level by
 * the chosen one. Only `.article-body` reads it: the hero, the contents, the bar
 * and the site chrome keep their own sizes.
 *
 * The steps are one fact with one home. The markup renders them as data
 * attributes for the page's inline script - an inline script cannot import - and
 * the layout renders the default as the status region's first text, so nothing
 * can disagree about what 100 percent is.
 */

/**
 * The sizes a reader can choose, ascending, with `1` - untransformed - in the
 * middle.
 *
 * Five steps rather than a slider: the bar has room for two controls, and `A-`
 * pressed four times already returns to 100 percent, so no reset control is
 * needed.
 */
export const READING_SCALES = [0.9, 1, 1.1, 1.2, 1.3] as const;

/**
 * The scale a page starts on, which is the one Bootstrap's own sizes describe.
 */
export const DEFAULT_READING_SCALE = 1;

/**
 * A scale as the whole percentage a reader is told.
 *
 * The live region reads the caption and this number together, so the value has
 * to be a percentage rather than a multiplier: `1.1` is `110`, not `110%` of
 * anything the reader could see.
 *
 * @param scale - One of `READING_SCALES`.
 * @returns That scale in whole percent.
 */
export function readingScalePercent(scale: number): number {
  return Math.round(scale * 100);
}
