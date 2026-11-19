import { describe, expect, it } from "vitest";
import {
  FIGURE_CLASS,
  figurePlacement,
  type FigurePlacement,
} from "../src/figure";

describe("figurePlacement", () => {
  it("defaults to an unfloated centered figure", () => {
    expect(figurePlacement({})).toEqual([
      FIGURE_CLASS,
      `${FIGURE_CLASS}--center`,
    ]);
  });

  it("places each unfloated side by its own modifier", () => {
    for (const align of ["left", "center", "right"] as const) {
      expect(figurePlacement({ align })).toEqual([
        FIGURE_CLASS,
        `${FIGURE_CLASS}--${align}`,
      ]);
    }
  });

  it("adds the float modifier after the side it floats to", () => {
    for (const align of ["left", "right"] as const) {
      expect(figurePlacement({ float: true, align })).toEqual([
        FIGURE_CLASS,
        `${FIGURE_CLASS}--${align}`,
        `${FIGURE_CLASS}--float`,
      ]);
    }
  });

  it("refuses to float and center, naming the two sides that work", () => {
    const placement: FigurePlacement = { float: true, align: "center" };

    expect(() => figurePlacement(placement)).toThrow(
      'cannot float and center at once: align defaults to "center", and text cannot wrap a centered float. Use align="left" or align="right"',
    );
  });

  it("refuses a float with no side: the default is the center", () => {
    expect(() => figurePlacement({ float: true })).toThrow(
      'align defaults to "center"',
    );
  });
});
