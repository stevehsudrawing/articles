/**
 * The facts this article shares across its locales: which PNG pair is a sticker,
 * how wide it is drawn, and how its figures start out placed in the prose.
 *
 * Each locale file imports this module and adds only its own text, so the
 * translations differ by prose alone. The images are imported rather than named
 * by a public path, so the build reads their dimensions and can emit them at the
 * drawn width.
 */
import type { FigurePlacement } from "../../figure";
import type { ThemeImageProps } from "../../theme-image";
import observingDarkSrc from "./observing-dark.png";
import observingLightSrc from "./observing.png";
import thumbDarkSrc from "./thumb-dark.png";
import thumbLightSrc from "./thumb.png";

/** The width both stickers are drawn at, in CSS pixels. */
const imageWidth = 180;

/**
 * The widths the build emits for a sticker: the drawn width, plus the file's own
 * 240 px that a 2x reader picks. A wider entry would be clamped to the source.
 */
const imageWidths = [180, 240];

/** The `sizes` that matches the drawn width, so the ladder resolves to 180w. */
const imageSizes = `${imageWidth}px`;

/** The placement every figure of this article starts from. */
export const figurePlacement = {
  align: "right",
  float: true,
} as const satisfies FigurePlacement;

/** The thumb sticker, shared by the three locales. */
export const imageThumb = {
  light: thumbLightSrc,
  dark: thumbDarkSrc,
  width: imageWidth,
  widths: imageWidths,
  sizes: imageSizes,
} as const satisfies ThemeImageProps;

/** The observing sticker, shared by the three locales. */
export const imageObserving = {
  light: observingLightSrc,
  dark: observingDarkSrc,
  width: imageWidth,
  widths: imageWidths,
  sizes: imageSizes,
} as const satisfies ThemeImageProps;
