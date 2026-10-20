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
