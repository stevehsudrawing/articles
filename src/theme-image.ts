import type { ImageMetadata } from "astro";

/**
 * The props that describe an image, as opposed to the box that draws it.
 *
 * `ThemeImage` draws one of these, and `ArticleFigure` draws one inside a
 * figure, where the image's props travel as one object so the figure does not
 * grow a proxy prop per `Picture` knob. The type lives here rather than beside
 * the component because an `.astro` file exports nothing importable.
 */
export interface ThemeImageProps {
  /** The light half, which is the only half a lone image needs. */
  light?: ImageMetadata;
  /** The dark twin, when the artwork has one. */
  dark?: ImageMetadata;
  /**
   * What the picture shows.
   *
   * Empty for artwork the site repeats on a page whose heading already names it,
   * where a description would announce the same thing twice. A figure requires
   * it, because a description there is content.
   */
  alt?: string;
  /** The image's own box: its crop and its width caps, not a frame around it. */
  class?: string;
  /** How wide that box is at each breakpoint, so the browser picks a variant. */
  sizes?: string;
  /**
   * The ladder of widths to render, as `Picture`'s own `widths`.
   *
   * The consumer owns it, because the box is the consumer's: a cover box passes
   * the ladder it is drawn at, while an image drawn at its own size passes
   * nothing and is rendered once.
   */
  widths?: number[];
  /**
   * The width the image is drawn at, as `Picture`'s own `width`.
   *
   * It becomes the `width` attribute on the `<img>` - the box the browser
   * reserves - and the width the build renders a variant at, clamped to the
   * file's own width, so a drawing larger than its file is a scaled bitmap
   * rather than a sharper one. A larger drawing is a larger export.
   */
  width?: number;
  /** The height that belongs with `width`; alone it resizes by height instead. */
  height?: number;
  /** Whether this picture is the page's largest paint, which is fetched first. */
  priority?: boolean;
}
