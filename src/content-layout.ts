import { isAlertKind, parseAlertMarker } from "./alerts";
import { localeIdentities } from "./i18n/locales";

/**
 * The content layout's contract: one folder per article, one file per locale.
 *
 * A collection's loader sees only the files that match its own locale, so a
 * file it does not match is not an error there - a `zh-Hans.md` just means that
 * translation does not exist, in silence. This module reads the sources rather
 * than the collections, so the build can fail on anything the loaders would
 * ignore.
 */

/** `<YYYY-MM-DD>-<id>`: the article folder's name, which is also its slug. */
export const ARTICLE_FOLDER = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The extension every content source carries. */
const EXTENSION = ".md";

/**
 * Whether a directory name is an article folder.
 *
 * The loader and the guard both ask this, so an article folder has one
 * definition rather than two that can drift.
 *
 * @param name - A directory name, relative to `src/content/`.
 * @returns Whether the name is `<YYYY-MM-DD>-<id>`.
 */
export function isArticleFolder(name: string): boolean {
  return ARTICLE_FOLDER.test(name);
}

/**
 * Every source file under `src/content/`, as `/src/content/...` paths.
 *
 * `import.meta.glob` is the one view of that directory no loader filters, which
 * is what lets the guard see a file that matched no collection. It is called
 * rather than evaluated at import time, so a module that imports this file for
 * `isArticleFolder` alone does not pay for the glob.
 *
 * @returns The source paths, in no particular order.
 */
export function contentFiles(): string[] {
  return Object.keys(import.meta.glob("/src/content/**/*.md"));
}

/** The prefix `contentFiles()` gives every path. */
const ROOT = "/src/content/";

/**
 * What is wrong with one source path, or nothing when it is well formed.
 *
 * Pure, so a test can drive it without a repository: the shape it enforces is
 * `src/content/<YYYY-MM-DD>-<id>/<locale>.md`, and it is exact - the file name
 * is a locale identity character for character (so `zh-Hans.md` is rejected
 * rather than read as a spelling of `zh-hans`), the folder carries the date,
 * and nothing sits between them.
 *
 * @param file - A path as `contentFiles()` reports it.
 * @returns The message to fail the build with, or `undefined` when the path is
 *   well formed.
 */
export function contentPathError(file: string): string | undefined {
  if (!file.startsWith(ROOT)) {
    return `${file} is outside ${ROOT}.`;
  }

  const segments = file.slice(ROOT.length).split("/");
  const name = segments.pop() ?? "";
  const folder = segments.pop() ?? "";

  if (segments.length > 0) {
    return `${file} is nested too deep. An article is one folder plus one file: src/content/<YYYY-MM-DD>-<id>/<locale>.md.`;
  }

  if (!folder) {
    return `${file} is loose in ${ROOT}. Move it into an article folder: src/content/<YYYY-MM-DD>-<id>/<locale>.md.`;
  }

  if (!isArticleFolder(folder)) {
    return `The folder "${folder}" must be named <YYYY-MM-DD>-<id>, for example 2026-10-11-hello-world: ${file}.`;
  }

  const stem = name.endsWith(EXTENSION)
    ? name.slice(0, -EXTENSION.length)
    : name;

  if (!localeIdentities.some((identity) => identity === stem)) {
    return `"${name}" must be named after a locale, one of ${localeIdentities.join(", ")}: ${file}. If it is an index.md from the earlier per-locale layout, rename it to ${folder}/<locale>.md.`;
  }

  return undefined;
}

/**
 * Fails the build when a source file is not `<slug>/<locale>.md`.
 *
 * This is what the loaders cannot do: each collection reads only the files that
 * match its own locale, so a mistyped file name makes a translation vanish
 * instead of failing. The first offender is reported, because one mistake
 * usually names the fix for the rest.
 *
 * @throws If any file under `src/content/` has an unexpected shape.
 */
export function assertContentLayout(): void {
  for (const file of contentFiles()) {
    const error = contentPathError(file);
    if (error) {
      throw new Error(error);
    }
  }
}

/**
 * Every source file's text, keyed by the path `contentFiles()` reports.
 *
 * Eager and raw, because the guard below reads the Markdown itself rather than
 * the entries a loader produced - and because it runs at module scope, where
 * nothing can await.
 *
 * @returns The sources, as path to text.
 */
function contentSources(): Record<string, string> {
  return import.meta.glob("/src/content/**/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
  });
}

/** A line that is only a frontmatter delimiter. */
const FRONTMATTER = /^(?:---|\+\+\+)\s*$/;

/** A fence's opening or closing line, allowing a blockquote's `>` markers. */
const FENCE = /^(?:\s*>)*\s*(`{3,}|~{3,})/;

/**
 * What is wrong with one source's alert markers, or nothing when they are fine.
 *
 * The renderer only reads a marker at the start of a blockquote's first
 * paragraph, and this looks for the same thing in the text: the frontmatter is
 * skipped because a `description` may legitimately start with one, a fenced
 * block is skipped whole because an article about the syntax writes the marker
 * inside one, and a line that opens with a backtick is a code span and cannot
 * match. Every offender is listed, so one build names them all.
 *
 * Pure, so a test can drive it without a repository.
 *
 * @param file - The path to name, as `contentFiles()` reports it.
 * @param text - The file's whole text.
 * @returns One line per marker that names no kind.
 */
export function alertMarkerErrors(file: string, text: string): string[] {
  const errors: string[] = [];
  let fence: string | undefined;
  let frontmatter = false;

  text.split("\n").forEach((line, index) => {
    if (index === 0 && FRONTMATTER.test(line)) {
      frontmatter = true;
      return;
    }
    if (frontmatter) {
      if (FRONTMATTER.test(line)) {
        frontmatter = false;
      }
      return;
    }

    const fenceLine = FENCE.exec(line);
    if (fenceLine) {
      const character = fenceLine[1][0];
      if (fence === undefined) {
        fence = character;
      } else if (fence === character) {
        fence = undefined;
      }
      return;
    }
    if (fence !== undefined) {
      return;
    }

    let rest = line;
    while (/^\s?>/.test(rest)) {
      rest = rest.replace(/^\s?>\s?/, "");
    }
    const marker = parseAlertMarker(rest);
    if (marker && !isAlertKind(marker.kind)) {
      const written = rest.trim().split(/\s/)[0];
      errors.push(
        `${file}:${index + 1} writes ${written}, which is not an alert kind. Use NOTE, TIP, IMPORTANT, WARNING or CAUTION, and to show a marker as text, put it in a code span or a fence`,
      );
    }
  });

  return errors;
}

/**
 * Fails the build when an article writes an alert marker that is not an alert.
 *
 * The renderer cannot report this itself, and that is measured rather than
 * assumed: the processor's diagnostics never reach the build, and a throw
 * inside a render step makes the content loader drop the article's whole body
 * while the build still exits 0. A throw at this module's scope is what a page
 * render cannot give - the same reason the layout check above lives here.
 *
 * @throws If any source outside its code writes a kind that is not one of the
 *   five.
 */
export function assertAlertMarkers(): void {
  const errors = Object.entries(contentSources()).flatMap(([file, text]) =>
    alertMarkerErrors(file, text),
  );
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}
