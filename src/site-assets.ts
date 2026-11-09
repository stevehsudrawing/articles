/**
 * The site's own files: four images the build emits, and the icons it is known
 * by.
 *
 * An image is imported, so the build reads its dimensions and can emit it at
 * other widths - which is what a page drawing it at 416 px needs. The icons
 * cannot take that route and would not gain by it: they are linked, not drawn,
 * and the reader's browser picks the size it needs from the `<link>`.
 *
 * A project site publishes under a base path, so a `public/` file cannot be
 * named by its path alone: a page's `src`/`href` needs the base in front of it,
 * and a crawler needs the whole thing made absolute. Both derivations live
 * here, beside the paths, so a path with several consumers is written once and
 * a moved file is a one-line change.
 */

import type { ImageMetadata } from "astro";

import defaultCoverDark from "./assets/images/default-cover-dark.png";
import defaultCoverLight from "./assets/images/default-cover-light.png";
import indexCover from "./assets/images/index-cover.png";
import ogImage from "./assets/images/og-image.png";

/**
 * The four images the site owns, imported so the build emits them.
 *
 * Each is a 1200x630 PNG, read from the file rather than declared: a page that
 * draws one asks for a width, and a crawler that is handed one gets the file's
 * own bytes. Neither re-encodes, and neither has to be watched for.
 */
export const IMAGES = {
  /** The site card a page advertises when it has no artwork of its own. */
  siteCard: ogImage,
  /** The home page's hero cover: transparent artwork, so never an `og:image`. */
  homeCover: indexCover,
  /** The light half of the default pair, and the `og:image` of a coverless article. */
  defaultCoverLight,
  /** The dark half of the default pair: the dark theme's card and hero artwork, never advertised. */
  defaultCoverDark,
};

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
 * @param path - A `public/`-relative path, as `ICONS` holds them.
 * @returns The path under the site's base, with its leading slash.
 */
export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

/**
 * Turns any URL under the site's base into the absolute URL a crawler needs.
 *
 * `og:image` is read outside any page: a social crawler gets the URL out of the
 * markup and fetches it directly, so a base-relative one cannot be resolved.
 * It takes a URL that already carries the base, such as the one an import
 * resolved to.
 *
 * @param path - A site-relative URL, with its leading slash.
 * @returns The file's absolute URL.
 */
export function absoluteUrl(path: string): string {
  return new URL(path, import.meta.env.SITE).href;
}

/** The width an article cover must have, in pixels. */
export const COVER_WIDTH = 1200;

/** The height an article cover must have, in pixels. */
export const COVER_HEIGHT = 630;

/**
 * A share card: the file a crawler fetches and the facts it needs first.
 *
 * The URL, its size and its description travel together because they describe
 * one image. Kept as a string alone, a layout would have to pass the other two
 * separately, and nothing would stop them from disagreeing with the file.
 */
export interface ShareImage {
  /** The image's absolute URL, since it is read outside any page. */
  url: string;
  /** The file's width in pixels. */
  width: number;
  /** The file's height in pixels. */
  height: number;
  /** What the image shows, for `og:image:alt`. */
  alt: string;
}

/**
 * A share card built from one of the images the site owns.
 *
 * The size is the file's own, taken from the metadata the import resolved, so a
 * card cannot describe a file it did not measure. The URL is that same
 * metadata's `src` made absolute, which is the file the build emitted - the
 * source's own bytes, never a re-encode.
 *
 * @param image - One of `IMAGES`, or an article's declared cover.
 * @param alt - What the image shows: a description, not a caption.
 * @returns The card a page advertises.
 */
export function siteCard(image: ImageMetadata, alt: string): ShareImage {
  return {
    url: absoluteUrl(image.src),
    width: image.width,
    height: image.height,
    alt,
  };
}

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

/** The formats a cover may be shared in: the two every crawler can show. */
const COVER_FORMATS: readonly string[] = ["png", "jpg", "jpeg"];

/**
 * Fails the build when a declared cover is not a format `og:image` can use.
 *
 * A cover is advertised as itself - no re-encode - so its own format is what a
 * crawler receives. `astro:assets` can read and emit more than that, and webp
 * is what it prefers when asked to transform, so the rule needs a check that
 * runs before anything renders.
 *
 * @param image - The cover as `image()` resolved it, whose `format` is the
 *   file's own (`"jpg"` for a JPEG, `"png"` for a PNG).
 * @param entry - What to name in the message: the file and the field.
 * @throws If the image is neither PNG nor JPEG.
 */
export function assertCoverFormat(
  image: { format: string },
  entry: string,
): void {
  if (!COVER_FORMATS.includes(image.format)) {
    throw new Error(
      `Cover image ${entry} is ${image.format}; a cover must be PNG or JPEG.`,
    );
  }
}
