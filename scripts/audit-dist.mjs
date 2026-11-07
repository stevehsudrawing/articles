#!/usr/bin/env node
/**
 * Audits `dist/` and reports every promise the build broke.
 *
 * `pnpm build` proves the sources compile; the content guards prove they agree
 * with each other. Nothing read the result, so a link to a route the build no
 * longer produces or a page that lost its canonical was found by clicking it.
 * This reads the output instead, and it is the last thing that runs before the
 * artifact is uploaded.
 *
 * **It never decides what the site should publish.** The indexable pages are the
 * sitemap's URLs, the articles are the pages whose own graph holds a
 * `BlogPosting`, and the copies are the relations those pages carry - all read
 * back from the build. Re-deriving the inventory here would be a second copy of
 * the rules `src/public-pages.ts` keeps in one place, and the copy would agree
 * with a broken build.
 *
 * **It is a script rather than a test** because the suite has to pass on a fresh
 * clone with no `dist/`, so a test of this could only skip where it matters.
 * What it owes instead is that it can fail: it is exercised by breaking the
 * build on purpose and watching each break be reported.
 *
 * Run it after a build, from the repository root:
 *
 * ```sh
 * pnpm audit:dist
 * ```
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, SITE } from "../site.config.mjs";

/** The built site, one level above `scripts/`. */
const DIST = fileURLToPath(new URL("../dist/", import.meta.url));

/** The origin every internal URL resolves against. */
const ORIGIN = new URL(SITE).origin;

/** What the base path looks like with the slash an internal path carries. */
const BASE_PREFIX = `${BASE}/`;

/**
 * Every file under `dist/`, as sorted `/`-separated paths relative to it.
 *
 * @param directory - Where to start; `dist/` by default.
 * @param prefix - The path of `directory` relative to `dist/`, for recursion.
 * @returns The paths, sorted, so a report reads the same way twice.
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
 * The URL a built HTML file answers, as a path under the base.
 *
 * A directory's `index.html` is the directory's URL; anything else keeps its
 * name, so `404.html` stays `/articles/404.html`.
 *
 * @param file - A `dist/`-relative path.
 * @returns The path, including the base.
 */
function pageUrlOf(file) {
  const path = file.endsWith("index.html")
    ? file.slice(0, -"index.html".length)
    : file;
  return `${BASE}/${path}`;
}

/**
 * Whether a path inside the base ends without the slash its URL must carry.
 *
 * `trailingSlash: "always"` makes the directory form the URL, so
 * `/articles/zh-hans` is a link the host has to redirect. A last segment with
 * a dot is a file, and a file has no trailing slash to want.
 *
 * @param rest - The path with the base and its slash removed.
 * @returns True when the path is a directory written without its slash.
 */
function needsSlash(rest) {
  if (rest === "" || rest.endsWith("/")) {
    return false;
  }
  return !rest.slice(rest.lastIndexOf("/") + 1).includes(".");
}

/**
 * What a link names, when it names something of this site's.
 *
 * A fragment, a `mailto:`, a `data:` URI and any URL whose origin is not this
 * site's are not links this audit can judge, and the main site is outside the
 * base - so all of them answer nothing.
 *
 * @param href - The attribute value, as the page wrote it.
 * @param from - The path of the page or file the link is written on.
 * @returns The path, the file it names and whether its slash is missing, or
 *   `undefined` when the link is not this site's to check.
 */
function internal(href, from) {
  if (href === "" || href.startsWith("#")) {
    return undefined;
  }
  if (/^(?:mailto|data|tel|javascript):/i.test(href)) {
    return undefined;
  }

  let url;
  try {
    url = new URL(href, `${ORIGIN}${from}`);
  } catch {
    return undefined;
  }
  if (url.origin !== ORIGIN) {
    return undefined;
  }
  if (url.pathname !== BASE && !url.pathname.startsWith(BASE_PREFIX)) {
    return undefined;
  }

  const rest = url.pathname.slice(BASE_PREFIX.length);
  return {
    path: url.pathname,
    file: rest === "" || rest.endsWith("/") ? `${rest}index.html` : rest,
    slashless: needsSlash(rest),
  };
}

/**
 * Every `<link>` element on a page, as written.
 *
 * @param html - The page's text.
 * @returns The elements, in document order.
 */
function linkTags(html) {
  return [...html.matchAll(/<link\b[^>]*>/g)].map((match) => match[0]);
}

/**
 * The value of one attribute of a tag, when it has one.
 *
 * @param tag - One element, as written.
 * @param name - The attribute's name.
 * @returns Its value, or `undefined`.
 */
function attributeOf(tag, name) {
  const found = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return found === null ? undefined : found[1];
}

/**
 * Every value of an attribute in a whole document.
 *
 * The lookbehind is what keeps `data-href` from reading as `href`: an attribute
 * starts after whitespace.
 *
 * @param text - The document.
 * @param name - `href` or `src`.
 * @returns The values, in document order.
 */
function attributeValues(text, name) {
  return [...text.matchAll(new RegExp(`(?<=\\s)${name}="([^"]*)"`, "g"))].map(
    (match) => match[1],
  );
}

/**
 * The graphs a page writes, parsed where they parse.
 *
 * @param html - The page's text.
 * @returns One entry per `ld+json` script: its parsed graph, or the error.
 */
function graphsOf(html) {
  const bodies = [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ].map((match) => match[1]);

  return bodies.map((body) => {
    try {
      return { graph: JSON.parse(body) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  });
}

/**
 * Whether a parsed graph describes an article.
 *
 * @param graph - One parsed `ld+json` document.
 * @returns True when any node is a `BlogPosting`.
 */
function isArticle(graph) {
  const nodes = Array.isArray(graph?.["@graph"]) ? graph["@graph"] : [graph];
  return nodes.some((node) => node?.["@type"] === "BlogPosting");
}

/**
 * The five characters an XML document escapes, read back.
 *
 * @param text - The text between two tags.
 * @returns The same text, unescaped.
 */
function unescapeXml(text) {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

/** The findings, one line each, in the order they were found. */
const findings = [];

/**
 * Records one broken promise.
 *
 * @param where - The `dist/`-relative file, or the file it concerns.
 * @param message - What is wrong with it.
 */
function report(where, message) {
  findings.push(`${where}: ${message}`);
}

/**
 * Runs every check, collecting findings rather than stopping at the first.
 *
 * @param files - Every path under `dist/`.
 * @param pages - The text of every built HTML file, by path.
 */
function audit(files, pages) {
  const has = (file) => files.includes(file);

  // A. The sitemap names files, and its alternates do too.
  if (!has("sitemap.xml")) {
    report("sitemap.xml", "is missing");
  }
  const sitemap = has("sitemap.xml")
    ? readFileSync(join(DIST, "sitemap.xml"), "utf8")
    : "";
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    unescapeXml(match[1]),
  );
  const alternateHrefs = [
    ...sitemap.matchAll(/<xhtml:link\b[^>]*\shref="([^"]+)"/g),
  ].map((match) => unescapeXml(match[1]));

  for (const [where, url] of [
    ...locs.map((loc) => ["sitemap.xml", loc]),
    ...alternateHrefs.map((href) => ["sitemap.xml alternate", href]),
  ]) {
    const target = internal(url, "/");
    if (target === undefined) {
      report(where, `names a URL outside the site: ${url}`);
    } else if (!has(target.file)) {
      report(where, `names a file that was not built: ${url}`);
    }
  }

  // B. Nothing withheld is advertised.
  const listed = new Set(locs);
  for (const [page, html] of pages) {
    const noindex = /<meta name="robots" content="noindex">/.test(html);
    if (noindex && listed.has(`${ORIGIN}${pageUrlOf(page)}`)) {
      report(page, "is noindex and is listed in the sitemap");
    }
  }

  // C. An indexable page's head, and a graph that parses.
  for (const loc of locs) {
    const target = internal(loc, "/");
    if (target === undefined) {
      continue;
    }
    const html = pages.get(target.file);
    if (html === undefined) {
      continue;
    }

    const links = linkTags(html);
    const canonicals = links.filter((tag) => /rel="canonical"/.test(tag));
    if (canonicals.length !== 1) {
      report(target.file, `has ${canonicals.length} canonicals, expected 1`);
    } else if (attributeOf(canonicals[0], "href") !== loc) {
      report(
        target.file,
        `canonical is ${attributeOf(canonicals[0], "href")}, sitemap says ${loc}`,
      );
    }

    if (!/<meta name="description" content="[^"]+">/.test(html)) {
      report(target.file, "has no description");
    }

    const headings = [...html.matchAll(/<h1[\s>]/g)].length;
    if (headings !== 1) {
      report(target.file, `has ${headings} h1 elements, expected 1`);
    }

    const graphs = graphsOf(html);
    if (graphs.length !== 1) {
      report(target.file, `has ${graphs.length} JSON-LD graphs, expected 1`);
    }

    const feeds = links.filter((tag) =>
      /type="application\/rss\+xml"/.test(tag),
    );
    if (feeds.length !== 1) {
      report(target.file, `has ${feeds.length} feed links, expected 1`);
    }

    const described = links.filter((tag) => /rel="describedby"/.test(tag));
    if (described.length !== 1) {
      report(
        target.file,
        `has ${described.length} describedby links, expected 1`,
      );
    }
  }

  // C and D both need a graph, so every page with one is parsed once here.
  const articles = [];
  for (const [page, html] of pages) {
    for (const { graph, error } of graphsOf(html)) {
      if (error !== undefined) {
        report(page, `has a JSON-LD graph that does not parse: ${error}`);
      } else if (isArticle(graph)) {
        articles.push(page);
      }
    }
  }

  // D. An article has a copy, and the inventory names it.
  const copies = new Map();
  for (const page of articles) {
    const html = pages.get(page);
    const marks = linkTags(html).filter((tag) =>
      /type="text\/markdown"/.test(tag),
    );
    if (marks.length !== 1) {
      report(page, `has ${marks.length} markdown copies, expected 1`);
      continue;
    }

    const href = attributeOf(marks[0], "href") ?? "";
    const target = internal(href, pageUrlOf(page));
    if (target === undefined || !has(target.file)) {
      report(page, `names a copy that was not built: ${href}`);
      continue;
    }
    copies.set(page, `${ORIGIN}${target.path}`);
  }

  // E. The inventory exists, resolves, and names every copy.
  if (!has("llms.txt")) {
    report("llms.txt", "is missing");
  } else {
    const text = readFileSync(join(DIST, "llms.txt"), "utf8");
    if (text.trim() === "") {
      report("llms.txt", "is empty");
    }

    const links = [...text.matchAll(/\]\(([^)\s]+)\)/g)].map(
      (match) => match[1],
    );
    for (const link of links) {
      const target = internal(link, pageUrlOf("index.html"));
      // An external link is the Project section's whole job - the repository
      // is not published from this site.
      if (target === undefined) {
        continue;
      }
      if (!has(target.file)) {
        report("llms.txt", `names a file that was not built: ${link}`);
      }
    }

    for (const [page, copy] of copies) {
      if (!links.includes(copy)) {
        report(page, `has a copy the inventory does not name: ${copy}`);
      }
    }
  }

  // F. Every link on every page names a file.
  for (const [page, html] of pages) {
    for (const name of ["href", "src"]) {
      for (const value of attributeValues(html, name)) {
        const target = internal(value, pageUrlOf(page));
        if (target === undefined) {
          continue;
        }
        if (target.slashless) {
          report(page, `links without its trailing slash: ${value}`);
        }
        if (!has(target.file)) {
          report(page, `links to a file that was not built: ${value}`);
        }
      }
    }
  }
}

/**
 * Reads the build, runs the checks and reports them.
 *
 * @returns The process's exit code: 0 when nothing is broken, 1 otherwise.
 */
function main() {
  if (!existsSync(DIST)) {
    console.error("No dist/ to audit. Run `pnpm build` first.");
    return 1;
  }

  const files = distFiles();
  const pages = new Map(
    files
      .filter((file) => file.endsWith(".html"))
      .map((file) => [file, readFileSync(join(DIST, file), "utf8")]),
  );

  audit(files, pages);

  if (findings.length === 0) {
    console.log(`${files.length} files audited, no findings.`);
    return 0;
  }

  for (const line of [...findings].sort()) {
    console.log(line);
  }
  console.log(`\n${findings.length} findings in ${files.length} files.`);
  return 1;
}

process.exitCode = main();
