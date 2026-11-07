import { articleUrl, mirrorUrl, type Article } from "./articles";
import { LICENSES } from "./content.config";
import { getLocale, type Locale } from "./i18n/locales";
import { REPOSITORY_URL } from "./site";
import { absoluteUrl } from "./site-assets";

/**
 * The two documents an agent reads: the site's inventory and a copy of each
 * article in the form its author wrote it.
 *
 * This module decides and the routes fetch, the split `src/sitemap.ts` and
 * `src/feed.ts` keep: `getCollection()` returns `[]` inside Vitest, so
 * everything that reads a collection stays in a route and everything that
 * decides is a pure function the suite can drive.
 *
 * Both files address an agent rather than a reader, which is why their prose is
 * English: a single file has no locale to be written in. The site's own name
 * and its one sentence still come from the messages, and each locale's section
 * is headed by the language's own name from the locale table.
 */

/**
 * A file the build writes at the base's root, as a page or a crawler names it.
 *
 * The name is also the route file's, because an endpoint with a file extension
 * is emitted under that extension.
 *
 * @param name - The file name, extension included.
 * @returns The path under the site's base, with no trailing slash.
 */
function baseFile(name: string): string {
  return `${import.meta.env.BASE_URL}${name}`;
}

/**
 * The address of the inventory, which every page names with `rel="describedby"`.
 *
 * @returns The path under the site's base.
 */
export function llmsUrl(): string {
  return baseFile("llms.txt");
}

/** The license ids, from the vocabulary, so the set cannot drift from it. */
const LICENSE_NAMES = Object.keys(LICENSES)
  .map((id) => `\`${id}\``)
  .join(", ");

/** The sentence that says what the copies are, since the file exists for them. */
const MIRRORS_NOTE = `Every article also has a markdown copy beside its page: the same URL with
\`index.md\` where the page has \`index.html\`. Each page names its copy with
\`rel="alternate" type="text/markdown"\`, and every page under this path is
described by this file, which it names with \`rel="describedby"\`.`;

/** That each article carries its own license, and where a reader sees it. */
const LICENSE_SECTION = `## License

Each article declares its own license in its frontmatter - ${LICENSE_NAMES} - and
both the page's footer and the markdown copy name it.`;

/**
 * Where the site's own work lives.
 *
 * @returns The section, naming the repository and the sitemap absolutely.
 */
function projectSection(): string {
  return `## Project

- [Source repository](${REPOSITORY_URL}): the site's code and the articles it publishes.
- [Sitemap](${absoluteUrl(baseFile("sitemap.xml"))}): every page a crawler may index.`;
}

/** One locale's published articles, in the order the file should list them. */
export interface LocaleArticles {
  locale: Locale;
  /** That locale's published articles, newest first. */
  articles: readonly Article[];
}

/** What the inventory is written from. */
export interface LlmsFacts {
  /** The site's formal name, as the home page's heading shows it. */
  siteName: string;
  /** The home page's own sentence, which the feed's channel also carries. */
  summary: string;
  /** Every locale, in the order its section should appear. */
  locales: readonly LocaleArticles[];
}

/**
 * Writes the inventory: one file naming every published article and its copy.
 *
 * A locale holding nothing contributes no section, because an empty `##` tells
 * an agent only that a language exists. Every other section is written from the
 * facts it is given, so the same content always produces the same bytes.
 *
 * @param facts - The site's name and sentence, and each locale's articles.
 * @returns The document, with a trailing newline.
 */
export function llmsTxt(facts: LlmsFacts): string {
  const sections = facts.locales
    .filter(({ articles }) => articles.length > 0)
    .map(({ locale, articles }) => {
      const items = articles.map(
        (article) =>
          `- [${article.data.title}](${absoluteUrl(mirrorUrl(locale, article.id))}): ${article.data.description}`,
      );
      return [`## ${getLocale(locale).name}`, "", ...items].join("\n");
    });

  return `${[
    `# ${facts.siteName}\n\n> ${facts.summary}`,
    MIRRORS_NOTE,
    ...sections,
    LICENSE_SECTION,
    projectSection(),
  ].join("\n\n")}\n`;
}

/** What one markdown copy is written from. */
export interface MirrorFacts {
  /** The locale whose copy this is. */
  locale: Locale;
  /** The article, as the collection hands it over. */
  article: Article;
}

/**
 * Writes one article's markdown copy: its source behind a header it needs.
 *
 * The body is the authored markdown rather than a page rendered back into
 * markdown, so there is one renderer. It starts at `##` because the title comes
 * from frontmatter, which is why the composed header can open with `#` without
 * restarting the numbering.
 *
 * The header carries what a reader of the file cannot otherwise see: when the
 * article was published, when it last changed, how it is licensed, and the page
 * it describes - a copy read on its own has no provenance, and citing it needs
 * an address. `Updated` is dropped when it repeats the publication date, the
 * rule the page's own `dateModified` follows.
 *
 * @param facts - The article and the locale it is copied for.
 * @returns The document, with a trailing newline.
 */
export function mirrorMarkdown({ locale, article }: MirrorFacts): string {
  const { data } = article;
  const license = LICENSES[data.license];
  const licenseText = license.url
    ? `[${license.label}](${license.url})`
    : license.label;

  const lines = [
    `# ${data.title}`,
    "",
    `> ${data.description}`,
    "",
    `- Published: ${data.date}`,
  ];

  if (data.updated && data.updated !== data.date) {
    lines.push(`- Updated: ${data.updated}`);
  }

  lines.push(
    `- License: ${licenseText}`,
    `- Canonical: ${absoluteUrl(articleUrl(locale, article.id))}`,
    "",
    // `body` is optional on an entry built in code; a file entry always has
    // one, and this keeps the document well formed either way.
    (article.body ?? "").trimEnd(),
  );

  return `${lines.join("\n")}\n`;
}
