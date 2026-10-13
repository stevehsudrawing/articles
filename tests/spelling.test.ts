import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** The repository root, one level above `tests/`. */
const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * A British form and its United States form. Each key is the shortest text
 * every inflection of the word carries, so `colour` covers `colours`,
 * `coloured` and `recoloured` in one row. An `-ise` verb takes three rows -
 * the verb, its `-ising` form and its `-isation` noun - because neither
 * inflection contains the other. The list is curated rather than exhaustive: a
 * dictionary would flag identifiers and proper nouns, and the drift this
 * guards against is the project's own.
 */
export const VARIANTS: ReadonlyArray<readonly [string, string]> = [
  ["analyse", "analyze"],
  ["analysing", "analyzing"],
  ["apologise", "apologize"],
  ["apologising", "apologizing"],
  ["artefact", "artifact"],
  ["behaviour", "behavior"],
  ["capitalisation", "capitalization"],
  ["capitalise", "capitalize"],
  ["capitalising", "capitalizing"],
  ["catalogue", "catalog"],
  ["centre", "center"],
  ["centred", "centered"],
  ["centring", "centering"],
  ["colour", "color"],
  ["customisation", "customization"],
  ["customise", "customize"],
  ["customising", "customizing"],
  ["defence", "defense"],
  ["emphasise", "emphasize"],
  ["emphasising", "emphasizing"],
  ["favour", "favor"],
  ["grey", "gray"],
  ["initialisation", "initialization"],
  ["initialise", "initialize"],
  ["initialising", "initializing"],
  ["labelled", "labeled"],
  ["labelling", "labeling"],
  ["licence", "license"],
  ["maximisation", "maximization"],
  ["maximise", "maximize"],
  ["maximising", "maximizing"],
  ["minimisation", "minimization"],
  ["minimise", "minimize"],
  ["minimising", "minimizing"],
  ["modelled", "modeled"],
  ["modelling", "modeling"],
  ["neighbour", "neighbor"],
  ["normalisation", "normalization"],
  ["normalise", "normalize"],
  ["normalising", "normalizing"],
  ["optimisation", "optimization"],
  ["optimise", "optimize"],
  ["optimising", "optimizing"],
  ["organisation", "organization"],
  ["organise", "organize"],
  ["organising", "organizing"],
  ["prioritisation", "prioritization"],
  ["prioritise", "prioritize"],
  ["prioritising", "prioritizing"],
  ["programme", "program"],
  ["realisation", "realization"],
  ["realise", "realize"],
  ["realising", "realizing"],
  ["recognise", "recognize"],
  ["recognising", "recognizing"],
  ["serialisation", "serialization"],
  ["serialise", "serialize"],
  ["serialising", "serializing"],
  ["specialisation", "specialization"],
  ["specialise", "specialize"],
  ["specialising", "specializing"],
  ["standardisation", "standardization"],
  ["standardise", "standardize"],
  ["standardising", "standardizing"],
  ["summarisation", "summarization"],
  ["summarise", "summarize"],
  ["summarising", "summarizing"],
  ["synchronisation", "synchronization"],
  ["synchronise", "synchronize"],
  ["synchronising", "synchronizing"],
  ["travelled", "traveled"],
  ["travelling", "traveling"],
  ["utilisation", "utilization"],
  ["utilise", "utilize"],
  ["utilising", "utilizing"],
  ["visualisation", "visualization"],
  ["visualise", "visualize"],
  ["visualising", "visualizing"],
  ["whilst", "while"],
];

/** The rows, longest key first, so a word takes the most specific one. */
const ROWS = [...VARIANTS].sort((a, b) => b[0].length - a[0].length);

/**
 * Words that carry a listed form but are spelled the same in both variants.
 * `programmed` and `programmer` contain `programme`, `greyhound` contains
 * `grey`, and `analyses` is the noun's plural in both - the verb's third
 * person, which is the one form the two disagree on, does not turn up in this
 * project's prose. `labelledby` is here because the spelling is WAI-ARIA's own:
 * the attribute is `aria-labelledby`, and no stylesheet or script may rename
 * it.
 */
const KEEP = new Set([
  "analyses",
  "greyhound",
  "greyhounds",
  "labelledby",
  "programmed",
  "programmer",
  "programmers",
]);

/**
 * Repository-relative paths the walk leaves alone: generated output, the
 * installed tree, the lockfile (other people's package names and descriptions),
 * a third party's verbatim license text, and this file, which spells every
 * variant on purpose.
 */
const SKIPPED: readonly string[] = [
  ".astro/",
  ".git/",
  "dist/",
  "node_modules/",
  "pnpm-lock.yaml",
  "public/licenses/",
  "tests/spelling.test.ts",
];

/** The extensions read as text. */
const TEXT_EXTENSIONS = new Set([
  ".astro",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sh",
  ".ts",
  ".txt",
  ".vue",
  ".yaml",
  ".yml",
]);

/** One listed form found in a file, and the word it should have been. */
type Hit = {
  /** The path, relative to the repository root, with `/` separators. */
  file: string;
  /** The 1-based line number. */
  line: number;
  /** The whole word the form was found in. */
  word: string;
  /** The same word, rewritten. */
  suggestion: string;
};

/**
 * Whether a file's name marks it as text this check reads. A dotfile carries no
 * extension of its own, so it counts as text; a name without any dot, such as a
 * husky hook, does not.
 *
 * @param name - The file's own name, without its directory.
 * @returns True when the file is read as text.
 */
function isText(name: string): boolean {
  const lastDot = name.lastIndexOf(".");
  if (lastDot === -1) {
    return false;
  }
  if (lastDot === 0 && !name.includes(".", 1)) {
    return true;
  }
  return TEXT_EXTENSIONS.has(name.slice(lastDot));
}

/**
 * Every text file under a directory, as sorted repository-relative paths.
 *
 * @param directory - Where to start; the repository root by default.
 * @returns The paths, `/`-separated and sorted, so a failure reads the same
 *   way twice.
 */
function textFiles(directory = ROOT): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const relativePath = relative(ROOT, path).split(sep).join("/");
    const skipped = SKIPPED.some(
      (skip) => relativePath === skip || relativePath.startsWith(skip),
    );
    if (skipped) {
      continue;
    }
    if (entry.isDirectory()) {
      found.push(...textFiles(path));
    } else if (entry.isFile() && isText(entry.name)) {
      found.push(relativePath);
    }
  }
  return found.sort();
}

/**
 * Rewrites a matched word, keeping an initial or a full capital.
 *
 * @param word - The matched word.
 * @param uk - The British form inside it.
 * @param us - The United States form to write instead.
 * @returns The word as it should read.
 */
function rewrite(word: string, uk: string, us: string): string {
  return word.replace(new RegExp(uk, "gi"), (hit) => {
    if (hit === hit.toUpperCase()) {
      return us.toUpperCase();
    }
    return hit[0] === hit[0].toUpperCase()
      ? us[0].toUpperCase() + us.slice(1)
      : us;
  });
}

/**
 * Every listed form in a text, in the order the text carries them. A word is
 * reported once, against the longest key it contains: `centred` is a row of its
 * own, and the `centre` row must not rewrite it to `centerd`.
 *
 * @param file - The path a report names.
 * @param text - The text to read.
 * @returns One entry per word found.
 */
function findVariants(file: string, text: string): Hit[] {
  const hits: Hit[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/\w+/g)) {
      const word = match[0];
      const lower = word.toLowerCase();
      if (KEEP.has(lower)) {
        continue;
      }
      const row = ROWS.find(([uk]) => lower.includes(uk));
      if (!row) {
        continue;
      }
      hits.push({
        file,
        line: index + 1,
        word,
        suggestion: rewrite(word, row[0], row[1]),
      });
    }
  });
  return hits;
}

/**
 * The one-line form a failure reports.
 *
 * @param hit - The entry to write.
 * @returns `file:line word -> suggestion`.
 */
function describeHit(hit: Hit): string {
  return `${hit.file}:${hit.line} ${hit.word} -> ${hit.suggestion}`;
}

describe("isText", () => {
  it("reads a dotfile and a named extension, and skips the rest", () => {
    expect(isText(".editorconfig")).toBe(true);
    expect(isText("astro.config.mjs")).toBe(true);
    expect(isText("pre-commit")).toBe(false);
    expect(isText("logo.png")).toBe(false);
  });
});

describe("findVariants", () => {
  it("finds an inflection, a prefix and an initial capital", () => {
    const found = findVariants(
      "sample.md",
      "colour Colours recoloured colouring",
    );

    expect(found.map((hit) => hit.suggestion)).toEqual([
      "color",
      "Colors",
      "recolored",
      "coloring",
    ]);
    expect(found[0]).toMatchObject({
      file: "sample.md",
      line: 1,
      word: "colour",
    });
  });

  it("leaves the United States spelling alone", () => {
    expect(findVariants("sample.md", "color colors colored coloring")).toEqual(
      [],
    );
  });

  it("rewrites a word against the longest form it contains", () => {
    const found = findVariants("sample.md", "the centred panel and the centre");

    expect(found.map((hit) => hit.suggestion)).toEqual(["centered", "center"]);
  });

  it("does not flag a word that only looks like a listed form", () => {
    const text = "analysis analyst promise revised surprise";

    expect(findVariants("sample.md", text)).toEqual([]);
  });

  it("leaves a word the two variants spell the same way", () => {
    const text = "a programmer programmed analyses greyhound";

    expect(findVariants("sample.md", text)).toEqual([]);
  });

  it("reports the line each form sits on", () => {
    const found = findVariants("sample.md", "clean\nbehaviour\nclean");

    expect(found.map((hit) => hit.line)).toEqual([2]);
  });
});

describe("the repository's text", () => {
  it("is written in English (United States)", () => {
    const report = textFiles()
      .flatMap((file) =>
        findVariants(file, readFileSync(join(ROOT, file), "utf8")),
      )
      .map(describeHit)
      .join("\n");

    expect(report).toBe("");
  });
});
