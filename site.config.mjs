/**
 * Where the site is deployed, which two readers need and neither may restate.
 *
 * `astro.config.mjs` hands both to Astro, and every page URL, asset URL and
 * graph id the site builds starts from them. `scripts/audit-dist.mjs` reads them
 * to know which URLs are this site's and where `dist/` begins.
 *
 * It is plain ESM rather than a TypeScript module because the second reader is a
 * program Node runs directly: Node cannot load a `.ts` module without a flag,
 * and loading `astro.config.mjs` instead would pull in Astro's own config helper
 * and the two TypeScript modules that file imports.
 */

/** The origin the site is published from. */
export const SITE = "https://stevehsudrawing.github.io";

/** The path the site lives under, with no trailing slash. */
export const BASE = "/articles";
