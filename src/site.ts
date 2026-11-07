/**
 * Facts about the site as an entity, rather than about the files it serves.
 *
 * Each is written once because each has more than one reader: the main site's
 * address reaches the footer's outward link and the graph's `Person` node, the
 * author's address reaches the feed's `<managingEditor>` and that same `Person`
 * node, and the repository's reaches the footer's license link and `llms.txt`.
 * `src/site-assets.ts` is the other kind of fact: the files under `public/` and
 * the URLs that reach them.
 */

/**
 * The author's own site: the link hub this blog belongs to.
 *
 * Absolute and written whole, because it is a destination outside this site and
 * never passes through `asset()`.
 */
export const MAIN_SITE_URL = "https://stevehsudrawing.github.io/";

/**
 * The address the site's author can be written to.
 *
 * Public: the main site's about card links it as `mailto:`. The feed gives it
 * as the channel's editorial contact, and the graph's `Person` node as its
 * address. Both describe the site's author rather than any article's - a byline
 * may name someone else, and that person is named in the graph without it.
 */
export const AUTHOR_EMAIL = "stevehsudrawing@outlook.com";

/**
 * Where the site's code and the articles' sources live.
 *
 * The footer builds its license link on it, and `llms.txt` names it as the
 * project's source.
 */
export const REPOSITORY_URL = "https://github.com/stevehsudrawing/articles";
