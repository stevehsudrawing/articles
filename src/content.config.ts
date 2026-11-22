import type { SchemaContext } from "astro/content/config";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";
import {
  assertAlertMarkers,
  assertContentLayout,
  EXTENSION,
  isArticleFolder,
  isLicenseSlug,
} from "./content-layout";
import { localeIdentities, type Locale } from "./i18n/locales";

/**
 * The license vocabulary: the only values `license` accepts, each with the
 * label a page shows and the URL it points at. A new value is added here first,
 * and every document that lists the licenses follows in the same commit.
 *
 * `All-Rights-Reserved` has no URL, because there is nothing to link to when
 * reuse is not granted; the article page renders its label as plain text.
 */
export const LICENSES = {
  "CC-BY-4.0": {
    label: "Creative Commons Attribution 4.0",
    url: "https://creativecommons.org/licenses/by/4.0/",
  },
  "CC-BY-SA-4.0": {
    label: "Creative Commons Attribution-ShareAlike 4.0",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  "CC-BY-NC-SA-4.0": {
    label: "Creative Commons Attribution-NonCommercial-ShareAlike 4.0",
    url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  },
  "CC-BY-NC-ND-4.0": {
    label: "Creative Commons Attribution-NonCommercial-NoDerivatives 4.0",
    url: "https://creativecommons.org/licenses/by-nc-nd/4.0/",
  },
  "All-Rights-Reserved": {
    label: "All rights reserved. No reuse without permission.",
    url: undefined,
  },
} as const;

/** One value of the vocabulary. */
export type LicenseId = keyof typeof LICENSES;

/** The ids, in table order, for the schema's enum. */
const LICENSE_IDS = Object.keys(LICENSES) as [LicenseId, ...LicenseId[]];

/** `YYYY-MM-DD`, the only shape a frontmatter date may take. */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A license's version: digits and dots, so `1.0` and `1.1.0` are both valid. A
 * document that never carried a version leaves the field out.
 */
const VERSION = /^\d+(\.\d+)*$/;

/** A tag: lowercase and hyphenated, so it can be a message-key fragment too. */
const TAG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The one tag slug a route already owns.
 *
 * The tag index and the tag pages paginate under a literal `page` segment, so a
 * tag named `page` would want `/tags/page/`, which is where `tags/page/1/`
 * lives. Reserving it keeps one URL meaning one page; `webpage` says the same
 * thing without a route behind it.
 */
const RESERVED_TAG = "page";

/** The message a date without quotes gets, wherever it is written. */
const QUOTED_DATE = 'Write the date in quotes, as "YYYY-MM-DD".';

/**
 * The message a declared cover without a description gets.
 *
 * A cover is artwork, and it is the only source of what `og:image:alt` says, so
 * the field is required rather than falling back to the article's title - which
 * names the article instead of the picture.
 */
const COVER_ALT_REQUIRED =
  "A cover needs an alt: describe what the picture shows, in this file's language.";

/** How long a cover's alt may be: a label rather than a caption. */
const COVER_ALT_MAX = 120;

/**
 * Rejects a frontmatter date that YAML parsed as a `Date` object.
 *
 * `date: 2026-10-11` is not the string `2026-10-11` but a date, which cannot be
 * compared with the folder name and can render as the previous day in a
 * negative-offset timezone.
 *
 * @param field - The field's name, as the author writes it.
 * @param value - The field's value, straight from the frontmatter.
 * @param entry - The entry's path, relative to the locale folder.
 * @throws If the value is a `Date`, which means the quotes are missing.
 */
function assertQuotedDate(field: string, value: unknown, entry: string): void {
  if (value instanceof Date) {
    const date = value.toISOString().slice(0, 10);
    throw new Error(
      `Quote the ${field} in ${entry}: an unquoted YAML date is a Date object, not a string. Write ${field}: "${date}".`,
    );
  }
}

/**
 * Builds one locale collection's `generateId`, which derives an entry's `id`
 * from its path and checks what the path states.
 *
 * The id is the article folder's name, because that folder name is the slug,
 * so every locale of one article derives the same id from the same folder. The
 * folder also states the article's date, so this is the one place that can
 * compare it with the frontmatter's: the callback receives the entry path and
 * the unvalidated frontmatter, while a schema sees only the data. The
 * parameter's type restates the loader's own, which the loader does not export.
 *
 * @param locale - The identity of the collection this callback serves.
 * @returns The loader's `generateId` callback.
 * @throws If the entry is not `<slug>/<locale>.mdx`, if the folder name is not
 * `<YYYY-MM-DD>-<id>`, if a date is unquoted, or if the two dates disagree.
 */
export function articleId(locale: Locale) {
  return ({
    entry,
    data,
  }: {
    entry: string;
    base: URL;
    data: Record<string, unknown>;
  }): string => {
    const segments = entry.split("/");
    const file = segments.pop();
    const folder = segments.pop();

    if (!file || !folder || segments.length > 0) {
      throw new Error(
        `An article is one folder plus one file: ${entry} must be src/content/articles/<YYYY-MM-DD>-<id>/${locale}${EXTENSION}.`,
      );
    }

    if (file === "index.md" || file === "index.mdx") {
      throw new Error(
        `An article is one file per locale: rename ${entry} to ${folder}/${locale}${EXTENSION}.`,
      );
    }

    if (file !== `${locale}${EXTENSION}`) {
      throw new Error(
        `The ${locale} file of "${folder}" must be named ${locale}${EXTENSION}, not ${file}: ${entry}.`,
      );
    }

    if (!isArticleFolder(folder)) {
      throw new Error(
        `Article folder must be named <YYYY-MM-DD>-<id>, for example 2026-10-11-hello-world: "${folder}" in ${entry}.`,
      );
    }

    assertQuotedDate("date", data.date, entry);
    assertQuotedDate("updated", data.updated, entry);

    const folderDate = folder.slice(0, 10);

    if (typeof data.date === "string" && data.date !== folderDate) {
      throw new Error(
        `Folder date ${folderDate} and frontmatter date ${data.date} disagree in ${entry}. Make them the same day.`,
      );
    }

    return folder;
  };
}

/**
 * Derives a license document's id from its path: `<slug>/<locale>`.
 *
 * The folder is the slug and the file name is the locale, so both are in the
 * id and `src/licenses.ts` can answer "this locale's documents" and "this
 * document's locales" from the id alone - no `lang` field to keep in step and
 * no second look at the path. The guard in `content-layout.ts` fails the build
 * first, but these checks run inside the loader, where a wrong id would
 * otherwise be a URL.
 *
 * @param options - The loader's callback argument, as `articleId()` declares it.
 * @returns The id, `<slug>/<locale>`.
 * @throws If the entry is not one folder plus one file, if the file is not
 *   named after a locale, or if the folder is not a slug.
 */
export function licenseId({
  entry,
}: {
  entry: string;
  base: URL;
  data: Record<string, unknown>;
}): string {
  const segments = entry.split("/");
  const file = segments.pop();
  const folder = segments.pop();

  if (!file || !folder || segments.length > 0) {
    throw new Error(
      `A license is one folder plus one file: ${entry} must be src/content/licenses/<slug>/<locale>${EXTENSION}.`,
    );
  }

  const locale = file.endsWith(EXTENSION)
    ? file.slice(0, -EXTENSION.length)
    : file;

  if (
    file !== `${locale}${EXTENSION}` ||
    !localeIdentities.some((identity) => identity === locale)
  ) {
    throw new Error(
      `A license's file is named after a locale, one of ${localeIdentities.join(", ")}: ${entry} must be src/content/licenses/${folder}/<locale>${EXTENSION}.`,
    );
  }

  if (!isLicenseSlug(folder)) {
    throw new Error(
      `License folder must be a lowercase hyphenated slug, for example restricted-artworks: "${folder}" in ${entry}.`,
    );
  }

  return `${folder}/${locale}`;
}

/**
 * Builds the schema every locale's articles are validated against.
 *
 * The fields are identical in every locale; the only difference is the `lang`
 * the factory injects, so an article's language is the file it lives in rather
 * than a field an author can get wrong.
 *
 * @param locale - The identity of the locale whose file the collection reads.
 * @returns The function Astro calls with its schema context.
 */
export function articleSchema(locale: Locale) {
  return ({ image }: SchemaContext) =>
    z
      .object({
        title: z
          .string()
          .min(1, "An article needs a title: it is rendered as the H1."),
        description: z
          .string()
          .min(
            1,
            "An article needs a description: it is the lede and the card's text.",
          ),
        date: z.string().regex(DATE, QUOTED_DATE),
        license: z.enum(LICENSE_IDS, "Use one of the license values."),
        author: z.string().min(1).optional(),
        updated: z.string().regex(DATE, QUOTED_DATE).optional(),
        tags: z
          .array(
            z
              .string()
              .regex(
                TAG,
                "A tag is lowercase and hyphenated, like seed-article.",
              )
              .refine(
                (tag) => tag !== RESERVED_TAG,
                `"${RESERVED_TAG}" is a reserved tag: it names the pagination segment, so use "webpage" for that idea.`,
              ),
          )
          .optional(),
        draft: z.boolean().default(false),
        cover: z
          .object({
            light: image(),
            dark: image().optional(),
            // One description for the artwork, which both halves show, so a
            // dark twin never has to describe itself twice.
            alt: z
              .string({ error: COVER_ALT_REQUIRED })
              .min(1, COVER_ALT_REQUIRED)
              .max(
                COVER_ALT_MAX,
                `Keep a cover's alt under ${COVER_ALT_MAX} characters: it is a label, not a caption.`,
              ),
          })
          .optional(),
        licenseUrl: z
          .url("Write licenseUrl as a full URL, including its scheme.")
          .optional(),
      })
      .transform((data) => ({ ...data, lang: locale }));
}

/**
 * The schema every license document is validated against.
 *
 * One collection serves every locale, because a license's language is its file
 * name and its data states none. There is no `date`: a license is not a dated
 * post, and `effectiveDate` is the field that carries that meaning. There is
 * no `draft` either - a published file is a published license, and an
 * unpublished one would put a catalog row in front of a page that does not
 * exist.
 *
 * @returns The function Astro calls with its schema context.
 */
export function licenseSchema() {
  return () =>
    z.object({
      title: z.string().min(1, "A license needs a title: it is the page's H1."),
      description: z
        .string()
        .min(1, "A license needs a description: it is the lede."),
      version: z
        .string()
        .regex(VERSION, 'Write the version as digits and dots, as "1.0".')
        .optional(),
      effectiveDate: z.string().regex(DATE, QUOTED_DATE),
      updated: z.string().regex(DATE, QUOTED_DATE).optional(),
    });
}

/**
 * The layout the loaders below assume, checked where it cannot be skipped.
 *
 * This runs at module scope because Astro evaluates a page's frontmatter once
 * per rendered route: a route with no paths to render never runs it, which is
 * exactly the state a mistyped file name produces. Measured - with the only
 * article renamed to `zh-Hans.mdx`, a check in the article route let the build
 * finish and the site was simply one article shorter.
 */
assertContentLayout();
assertAlertMarkers();

/**
 * One collection per article locale, named after its identity: every collection
 * reads the same `src/content/articles/`, and each matches only that locale's
 * file, so a collection name, a file name and a `lang` value are one string.
 */
const articleCollections = Object.fromEntries(
  localeIdentities.map((locale) => [
    locale,
    defineCollection({
      loader: glob({
        pattern: `**/${locale}${EXTENSION}`,
        base: "./src/content/articles",
        generateId: articleId(locale),
      }),
      schema: articleSchema(locale),
    }),
  ]),
);

/**
 * The licenses collection: one loader for every document and every locale.
 *
 * A route renders one locale's page, so it already knows which file it wants
 * and the collection needs no per-locale copy; `generateId` writes the slug and
 * the locale into the id, which is what the readers filter on.
 */
const licenseCollection = defineCollection({
  loader: glob({
    pattern: `**/*${EXTENSION}`,
    base: "./src/content/licenses",
    generateId: licenseId,
  }),
  schema: licenseSchema(),
});

/**
 * The collections the site reads, one map per kind.
 *
 * Merged with `Object.assign` rather than a spread: a spread of the article
 * map erases the key types Astro reads to type every entry, while an
 * intersection keeps both.
 */
export const collections = Object.assign({}, articleCollections, {
  licenses: licenseCollection,
});
