/**
 * An article figure's placement contract.
 *
 * A figure is placed by two independent props: `float` decides whether the
 * following prose wraps beside it, and `align` decides the side. Both the class
 * list and the one pair that cannot be drawn live here, so the component states
 * no placement rule of its own and a test can reach every case.
 *
 * The sides and the float are refinements of the wide standard view: the class
 * list is emitted whatever the viewport, and `base.scss` draws those classes
 * only from `lg` up while the page is in the standard view. Below `lg`, and in
 * the comfortable view at any width, every figure is the same centered,
 * unfloated block.
 */

/** The base class an article figure's `<figure>` carries. */
export const FIGURE_CLASS = "article-figure";

/** The side an article figure sits on, or the side it floats to. */
export type FigureAlign = "left" | "center" | "right";

/** An article figure's two independent placement props. */
export interface FigurePlacement {
  /**
   * Whether the following prose wraps beside the figure, from `lg` up in the
   * standard view. A float needs a side.
   */
  float?: boolean;
  /**
   * The side the figure sits on, or floats to: centered by default, and
   * effective only from `lg` up in the standard view.
   */
  align?: FigureAlign;
}

/**
 * The class list an article figure's `<figure>` carries.
 *
 * `float` decides whether the following prose wraps beside the figure and
 * `align` decides the side, so the two are independent: unfloated, the figure
 * is a block in the column placed by its margins; floated, it takes the side
 * and the text flows past it. Both props refine the wide standard view only:
 * below `lg` and in the comfortable view the figure is centered and unfloated
 * whatever they say.
 *
 * @param placement - The figure's two placement props.
 * @returns The base class first, then the align modifier, then `--float`.
 * @throws Error when `float` meets an `align` of `"center"`, which is also the
 *   default: text cannot wrap a centered float.
 */
export function figurePlacement({
  float = false,
  align = "center",
}: FigurePlacement): string[] {
  if (float && align === "center") {
    throw new Error(
      'An article figure cannot float and center at once: align defaults to "center", and text cannot wrap a centered float. Use align="left" or align="right" with float.',
    );
  }

  return [
    FIGURE_CLASS,
    `${FIGURE_CLASS}--${align}`,
    ...(float ? [`${FIGURE_CLASS}--float`] : []),
  ];
}
