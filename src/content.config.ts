import type { SchemaContext } from "astro/content/config";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";
import { assertContentLayout, isArticleFolder } from "./content-layout";
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
 * @throws If the entry is not `<slug>/<locale>.md`, if the folder name is not
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
        `An article is one folder plus one file: ${entry} must be src/content/<YYYY-MM-DD>-<id>/${locale}.md.`,
      );
    }

    if (file === "index.md") {
      throw new Error(
        `An article is one file per locale: rename ${entry} to ${folder}/${locale}.md.`,
      );
    }

    if (file !== `${locale}.md`) {
      throw new Error(
        `The ${locale} file of "${folder}" must be named ${locale}.md, not ${file}: ${entry}.`,
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
          .object({ light: image(), dark: image().optional() })
          .optional(),
        licenseUrl: z
          .url("Write licenseUrl as a full URL, including its scheme.")
          .optional(),
      })
      .transform((data) => ({ ...data, lang: locale }));
}

/**
 * The layout the loaders below assume, checked where it cannot be skipped.
 *
 * This runs at module scope because Astro evaluates a page's frontmatter once
 * per rendered route: a route with no paths to render never runs it, which is
 * exactly the state a mistyped file name produces. Measured - with the only
 * article renamed to `zh-Hans.md`, a check in the article route let the build
 * finish and the site was simply one article shorter.
 */
assertContentLayout();

/**
 * One collection per locale, named after its identity: every collection reads
 * the same `src/content/`, and each matches only that locale's file, so a
 * collection name, a file name and a `lang` value are one string.
 */
export const collections = Object.fromEntries(
  localeIdentities.map((locale) => [
    locale,
    defineCollection({
      loader: glob({
        pattern: `**/${locale}.md`,
        base: "./src/content",
        generateId: articleId(locale),
      }),
      schema: articleSchema(locale),
    }),
  ]),
);
