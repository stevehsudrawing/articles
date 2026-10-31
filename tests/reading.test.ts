import { describe, expect, it } from "vitest";
import {
  DEFAULT_READING_SCALE,
  READING_SCALES,
  readingScalePercent,
} from "../src/reading";

describe("READING_SCALES", () => {
  it("ascends, so a step is a step in one direction", () => {
    for (let index = 1; index < READING_SCALES.length; index++) {
      expect(READING_SCALES[index]).toBeGreaterThan(READING_SCALES[index - 1]);
    }
  });

  it("contains the default, so a page always has a step to start on", () => {
    expect(READING_SCALES).toContain(DEFAULT_READING_SCALE);
  });
});

describe("readingScalePercent", () => {
  it("renders the default as the 100 percent a reader is told", () => {
    expect(readingScalePercent(DEFAULT_READING_SCALE)).toBe(100);
  });

  it("renders every step as a whole percentage", () => {
    for (const scale of READING_SCALES) {
      expect(readingScalePercent(scale)).toBe(Math.round(scale * 100));
      expect(Number.isInteger(readingScalePercent(scale))).toBe(true);
    }
  });
});
