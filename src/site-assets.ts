/**
 * The site's own files under `public/`, and the two URLs that reach them.
 *
 * A project site publishes under a base path, so a `public/` file cannot be
 * named by its path alone: a page's `src`/`href` needs the base in front of it,
 * and a crawler needs the whole thing made absolute. Both derivations live
 * here, beside the paths, so a path with several consumers is written once and
 * a moved file is a one-line change.
 */

/**
 * The shared images under `public/images/`, as paths relative to `public/`.
 *
 * These four are served unchanged: `og:image` wants a stable URL, and the
 * default covers need no processing. An article's own cover is the opposite -
 * it sits beside the article and goes through `astro:assets`.
 */
export const IMAGES = {
  /** The site card a page advertises when it has no artwork of its own. */
  siteCard: "images/og-image.png",
  /** The home page's hero cover: transparent artwork, so never an `og:image`. */
  homeCover: "images/index-cover.png",
  /** The light half of the default pair, and the `og:image` of a coverless article. */
  defaultCoverLight: "images/default-cover-light.png",
  /** The dark half of the default pair; never themed, never advertised. */
  defaultCoverDark: "images/default-cover-dark.png",
} as const;

/**
 * The icon set under `public/favicons/`, as paths relative to `public/`.
 *
 * The pair is linked by `media`, because a favicon has no CSS context: the
 * reader's stored theme cannot reach it, so it follows the system's.
 */
export const ICONS = {
  lightSvg: "favicons/favicon-light.svg",
  darkSvg: "favicons/favicon-dark.svg",
  lightPng: "favicons/favicon-light.png",
  darkPng: "favicons/favicon-dark.png",
  /** Opaque, 180x180, generated from the light SVG by `tools/svg-to-png.mjs`. */
  appleTouch: "favicons/apple-touch-icon.png",
} as const;

/**
 * Turns a `public/` path into the URL a page puts in `src` or `href`.
 *
 * @param path - A `public/`-relative path, as `IMAGES` and `ICONS` hold them.
 * @returns The path under the site's base, with its leading slash.
 */
export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

/**
 * Turns a `public/` path into the absolute URL a crawler needs.
 *
 * `og:image` is read outside any page: a social crawler gets the URL out of the
 * markup and fetches it directly, so a base-relative one cannot be resolved.
 *
 * @param path - A `public/`-relative path, as `IMAGES` and `ICONS` hold them.
 * @returns The file's absolute URL.
 */
export function absoluteAsset(path: string): string {
  return new URL(asset(path), import.meta.env.SITE).href;
}

/** The width an article cover must have, in pixels. */
export const COVER_WIDTH = 1200;

/** The height an article cover must have, in pixels. */
export const COVER_HEIGHT = 630;

/**
 * Fails the build when a declared cover is not the size the card expects.
 *
 * The schema cannot make this check: `image()` hands a refinement a placeholder
 * string and resolves to real metadata only afterwards. The dimensions are
 * therefore compared here, where they exist - in the layout, before anything
 * renders.
 *
 * @param size - The image's `width` and `height`, as `image()` resolved them.
 * @param entry - What to name in the message: the file and the field.
 * @throws If the image is not {@link COVER_WIDTH}x{@link COVER_HEIGHT}.
 */
export function assertCoverSize(
  size: { width: number; height: number },
  entry: string,
): void {
  if (size.width !== COVER_WIDTH || size.height !== COVER_HEIGHT) {
    throw new Error(
      `Cover image ${entry} is ${size.width}x${size.height}; a cover must be ${COVER_WIDTH}x${COVER_HEIGHT}.`,
    );
  }
}
