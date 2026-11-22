/**
 * The facts this article shares across its locales: which PNG pair is a
 * sticker, how wide it is drawn, which widths the build emits for it, and how
 * its figures start out placed in the prose.
 *
 * Each locale file imports this module and adds only its own text, so the
 * translations differ by prose alone. The images are imported rather than named
 * by a public path, so the build reads their dimensions and emits them at the
 * widths below instead of at the file's own.
 */
import type { FigurePlacement } from "../../../figure";
import type { ThemeImageProps } from "../../../theme-image";
import observingDarkSrc from "./assets/sticker-observing-dark.png";
import observingLightSrc from "./assets/sticker-observing.png";
import thumbDarkSrc from "./assets/sticker-thumb-dark.png";
import thumbLightSrc from "./assets/sticker-thumb.png";

/** The width both stickers are drawn at, in CSS pixels. A figure wider than
 * this takes lines away from the prose it is floated beside. */
const drawnWidth = 180;

/** The candidate widths the build emits: the drawn width, half again for a
 * 1.5x screen, and double for a 2x one. The artwork is 360 px, so the top rung
 * is its own width; a rung above a file's width is clamped away rather than
 * upscaled, which is why the rungs follow the drawn width and not the artwork. */
const widths = [drawnWidth, drawnWidth * 1.5, drawnWidth * 2];

/** The width the image is rendered at - which is what `sizes` has to state. It
 * is not a list of candidates: a value larger than the rendered width makes the
 * browser choose the largest rung and never the others. */
const sizes = `${drawnWidth}px`;

/** The placement every figure of this article starts from. */
export const figurePlacement = {
  align: "right",
  float: true,
} as const satisfies FigurePlacement;

/** The thumb sticker: its two theme halves, drawn width and emitted widths. */
export const imageThumb = {
  light: thumbLightSrc,
  dark: thumbDarkSrc,
  width: drawnWidth,
  widths,
  sizes,
} as const satisfies ThemeImageProps;

/** The observing sticker: its two theme halves, drawn width and emitted
 * widths. */
export const imageObserving = {
  light: observingLightSrc,
  dark: observingDarkSrc,
  width: drawnWidth,
  widths,
  sizes,
} as const satisfies ThemeImageProps;
