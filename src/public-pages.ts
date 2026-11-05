/**
 * The one question every output asks about a page: may a crawler index it?
 *
 * Two of the site's page kinds can answer no, and both are previews rather than
 * failures. A draft is where a translator reads an article before publishing
 * it, and a tag page holds nothing in a locale that has not translated any
 * article carrying that tag. Both exist for a reader, so both render; neither
 * is something a search engine should carry.
 *
 * The predicate is pure because the rules it states are the rules a test can
 * pin: `getCollection()` returns `[]` inside Vitest, so anything reading a
 * collection could not be tested at all.
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
