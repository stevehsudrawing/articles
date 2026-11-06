/**
 * Facts about the site as an entity, rather than about the files it serves.
 *
 * The address below has two readers - the footer's outward link and the graph's
 * `Person` node - so it is written once. `src/site-assets.ts` is the other kind
 * of fact: the files under `public/` and the URLs that reach them.
 */

/**
 * The author's own site: the link hub this blog belongs to.
 *
 * Absolute and written whole, because it is a destination outside this site and
 * never passes through `asset()`.
 */
export const MAIN_SITE_URL = "https://stevehsudrawing.github.io/";
