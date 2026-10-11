/**
 * Caps the body at a small number of lines. commitlint has no such rule:
 * `body-max-length` counts characters rather than lines.
 */
const bodyMaxLines = {
  rules: {
    /**
     * Reports whether the body fits within `value` non-empty lines.
     *
     * @param {{ body: string | null }} commit - The parsed commit.
     * @param {"always" | "never"} when - The rule's polarity.
     * @param {number} value - The maximum number of non-empty body lines.
     * @returns {[boolean, string]} The result and its message.
     */
    "body-max-lines": ({ body }, when = "always", value = 3) => {
      // A commit with no body parses as `null`, not as "".
      const lines = (body ?? "")
        .split("\n")
        .filter((line) => line.trim() !== "").length;
      const valid = when === "never" ? lines > value : lines <= value;
      return [valid, `body must not exceed ${value} lines`];
    },
  },
};

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [bodyMaxLines],
  rules: {
    // 2 = error, 0 = disabled.
    "type-enum": [
      2,
      "always",
      [
        "build",
        "chore",
        "ci",
        "content",
        "docs",
        "feat",
        "fix",
        "perf",
        "refactor",
        "revert",
        "style",
        "test",
      ],
    ],
    "header-max-length": [2, "always", 200],
    "body-max-line-length": [2, "always", 80],
    "body-max-lines": [2, "always", 3],
    "footer-max-line-length": [0],
  },
};
