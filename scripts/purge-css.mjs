#!/usr/bin/env node
/**
 * Removes the framework rules the built pages never name.
 *
 * The module list in `src/styles/bootstrap.scss` decides which components can
 * exist; only the pages decide which of their classes are used. Astro emits the
 * module list as one hashed sheet, so this reads the finished `dist/`, purges
 * that sheet against every page's markup, and replaces it in place with the
 * smaller file under a new content hash.
 *
 * **It runs after `astro build`, never during it.** The build writes the sheet
 * and every page that names a class; purging earlier would see a partial site
 * and drop a rule a page still uses. It is chained in `build`, so a local build
 * and the deploy artifact are the same shape.
 *
 * **The site's own sheets are left alone.** Only the sheet that defines
 * Bootstrap's root tokens is purged; the Astro component sheets are already
 * scoped to the markup that imported them and carry nothing to remove.
 *
 * Run it after a build, from the repository root:
 *
 * ```sh
 * pnpm build
 * ```
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { PurgeCSS } from "purgecss";

/** The built site, one level above `scripts/`. */
const DIST = fileURLToPath(new URL("../dist/", import.meta.url));

/** Files that can carry a reference to a sheet. */
const TEXT = new Set([".html", ".htm", ".js", ".mjs", ".css", ".json", ".xml"]);

/** The first token of Bootstrap's `:root` block, which marks the framework sheet. */
const FRAMEWORK_MARKER = "--bs-body-font-family:";

/** The hash Astro or this script appends to a sheet's name. */
const HASH_SUFFIX = /\.[A-Za-z0-9_-]{8}$/;

/**
 * Every file under `dist/`, as `/`-separated paths relative to it.
 *
 * @param directory - Where to start; `dist/` by default.
 * @param prefix - The path of `directory` relative to `dist/`, for recursion.
 * @returns The paths, sorted, so a run reports the same way twice.
 */
function distFiles(directory = DIST, prefix = "") {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...distFiles(join(directory, entry.name), path));
    } else if (entry.isFile()) {
      found.push(path);
    }
  }
  return found.sort();
}

/**
 * The attribute names a sheet selects on, for `dynamicAttributes`.
 *
 * The default extractor reads a document into tokens like `type=checkbox`, so
 * a bare attribute name never appears and PurgeCSS would drop every attribute
 * selector. The site keeps state in attributes - the theme, the reading scale,
 * the checkbox's type - so the sheet's own attributes are declared dynamic.
 *
 * @param text - The sheet's text.
 * @returns The distinct attribute names it selects on.
 */
function attributeNames(text) {
  const names = new Set();
  for (const match of text.matchAll(/\[([A-Za-z-]+)/g)) {
    names.add(match[1]);
  }
  return [...names];
}

/**
 * The three sizes a stylesheet is judged by.
 *
 * @param text - The sheet's text.
 * @returns The raw, gzip and Brotli sizes in bytes.
 */
function sizes(text) {
  const bytes = Buffer.from(text);
  return {
    raw: bytes.length,
    gzip: gzipSync(bytes, { level: 9 }).length,
    brotli: brotliCompressSync(bytes).length,
  };
}

const files = distFiles();
const html = files
  .filter((file) => file.endsWith(".html"))
  .map((file) => readFileSync(join(DIST, file), "utf8"))
  .sort()
  .join("\n");

const sheets = files.filter((file) => {
  if (!file.startsWith("_astro/") || !file.endsWith(".css")) return false;
  return readFileSync(join(DIST, file), "utf8").includes(FRAMEWORK_MARKER);
});

if (sheets.length === 0) {
  console.error(
    `purge-css: no sheet under _astro/ carries ${FRAMEWORK_MARKER}; the module list left no framework sheet to purge.`,
  );
  process.exit(1);
}

for (const file of sheets) {
  const path = join(DIST, file);
  const beforeText = readFileSync(path, "utf8");
  const result = await new PurgeCSS().purge({
    css: [{ raw: beforeText, name: path }],
    content: [{ extension: "html", raw: html }],
    // The default extractor splits a document into class-like tokens; the
    // trailing `:` exclusion keeps a custom-property name from being read as a
    // class.
    defaultExtractor: (source) => source.match(/[^<>"'`\s]*[^<>"'`\s:]/g) ?? [],
    // `active` is toggled on a nav item after load, and a selector that names
    // the attribute may be switched at runtime, so neither is decided here.
    safelist: { standard: ["active"] },
    // The extractor yields `name=value` tokens, never a bare attribute name, so
    // every attribute selector in the sheet would otherwise be dropped - the
    // theme, the reading scale and the checkbox mark among them. Treat every
    // attribute the sheet selects on as dynamic.
    dynamicAttributes: attributeNames(beforeText),
    // Custom properties are the theme bridge, an unused face may be the
    // reader's choice, and no animation here is unused.
    variables: false,
    fontFace: false,
    keyframes: false,
  });

  const afterText = result[0]?.css ?? beforeText;
  if (afterText.length === 0 || afterText.length >= beforeText.length) {
    console.log(
      `purge-css: ${file} unchanged (${sizes(beforeText).raw} bytes kept)`,
    );
    continue;
  }

  const hash = createHash("sha256").update(afterText).digest("hex").slice(0, 8);
  const stem = basename(file, ".css").replace(HASH_SUFFIX, "");
  const newName = `${stem}.${hash}.css`;
  const newFile = `_astro/${newName}`;
  writeFileSync(join(DIST, newFile), afterText);

  for (const textFile of files) {
    if (!TEXT.has(extname(textFile)) || textFile === file) continue;
    const textPath = join(DIST, textFile);
    const text = readFileSync(textPath, "utf8");
    if (!text.includes(basename(file))) continue;
    writeFileSync(textPath, text.replaceAll(basename(file), newName));
  }

  unlinkSync(path);

  const before = sizes(beforeText);
  const after = sizes(afterText);
  console.log(
    `purge-css: ${basename(file)} -> ${newName}: ` +
      `${before.raw} -> ${after.raw} bytes, ` +
      `gzip ${before.gzip} -> ${after.gzip}, ` +
      `Brotli ${before.brotli} -> ${after.brotli}`,
  );
}
