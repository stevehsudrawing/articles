import type { CollectionEntry } from "astro:content";
import type { SchemaContext } from "astro/content/config";
import { z } from "astro/zod";
import { describe, expect, it } from "vitest";
import { articleSchema, generateId, LICENSES } from "../src/content.config";

// The generated collection types are easy to lose in silence, because they
// reach TypeScript only through `tsconfig.json`. These two lines are an error
// today, and `@ts-expect-error` fails the typecheck the day one stops being
// one, which is exactly what a silent loss looks like.
// @ts-expect-error - a collection name is a locale identity, not a tag.
export type WrongCollectionName = CollectionEntry<"zh-Hant">;
// @ts-expect-error - the article schema has no `slug` field.
export type NoSuchField = CollectionEntry<"zh-hans">["data"]["slug"];

/**
 * A stand-in for Astro's schema context. Only `image()` is ever called, and the
 * real helper's return type is a specific Zod object that a hand-written
 * stand-in cannot be assignable to, so the cast happens here, once. Its shape is
 * the real one in miniature: a path goes in, image metadata comes out.
 */
const context = {
  image: () =>
    z.string().transform((src) => ({
      src,
      width: 1200,
      height: 630,
      format: "png",
    })),
} as unknown as SchemaContext;

/** Frontmatter that satisfies the schema, as the seed article writes it. */
const frontmatter = {
  title: "内容流水线的种子文章",
  description: "本站的第一篇文章。",
  date: "2026-10-11",
  license: "All-Rights-Reserved",
};

const schema = articleSchema("zh-hans")(context);

/** Calls `generateId` with the loader's options, for one entry path. */
function idOf(entry: string, data: Record<string, unknown>) {
  return generateId({ entry, base: new URL("file:///content/"), data });
}

describe("generateId", () => {
  it("returns the article folder's name", () => {
    expect(idOf("2026-10-11-seed/index.md", { date: "2026-10-11" })).toBe(
      "2026-10-11-seed",
    );
  });

  it("leaves a missing date to the schema", () => {
    expect(idOf("2026-10-11-seed/index.md", {})).toBe("2026-10-11-seed");
  });

  it("rejects a file that is not a folder's index.md", () => {
    expect(() => idOf("loose.md", { date: "2026-10-11" })).toThrow(
      /must be a folder with an index\.md/,
    );
  });

  it("rejects a folder name without the date", () => {
    expect(() => idOf("hello/index.md", { date: "2026-10-11" })).toThrow(
      /Article folder must be named/,
    );
  });

  it("rejects a folder nested inside an article folder", () => {
    expect(() =>
      idOf("2026-10-11-seed/nested/index.md", { date: "2026-10-11" }),
    ).toThrow(/Article folder must be named/);
  });

  it("rejects a date that disagrees with the folder", () => {
    expect(() =>
      idOf("2026-10-10-seed/index.md", { date: "2026-10-11" }),
    ).toThrow(/Folder date 2026-10-10 and frontmatter date 2026-10-11/);
  });

  it("rejects a date YAML parsed as a Date object", () => {
    expect(() =>
      idOf("2026-10-11-seed/index.md", { date: new Date("2026-10-11") }),
    ).toThrow(/Quote the date/);
  });

  it("rejects an `updated` YAML parsed as a Date object", () => {
    expect(() =>
      idOf("2026-10-11-seed/index.md", {
        date: "2026-10-11",
        updated: new Date("2026-12-01"),
      }),
    ).toThrow(/Quote the updated/);
  });
});

describe("articleSchema", () => {
  it("accepts the seed article's frontmatter", () => {
    const data = schema.parse(frontmatter);

    expect(data.title).toBe("内容流水线的种子文章");
    expect(data.lang).toBe("zh-hans");
    expect(data.draft).toBe(false);
  });

  it("injects the locale the schema was built with", () => {
    expect(articleSchema("en")(context).parse(frontmatter).lang).toBe("en");
  });

  it("accepts optional fields, a light-only cover and several tags", () => {
    const data = schema.parse({
      ...frontmatter,
      author: "什五",
      updated: "2026-12-01",
      translationKey: "seed-article",
      draft: true,
      tags: ["design", "seed-article"],
      cover: { light: "./cover-light.png" },
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    });

    expect(data.author).toBe("什五");
    expect(data.updated).toBe("2026-12-01");
    expect(data.tags).toEqual(["design", "seed-article"]);
    expect(data.draft).toBe(true);
    expect(data.cover?.light.width).toBe(1200);
    expect(data.licenseUrl).toBe(
      "https://creativecommons.org/licenses/by/4.0/",
    );
  });

  it("rejects a cover without a light variant", () => {
    const result = schema.safeParse({
      ...frontmatter,
      cover: { dark: "./cover-dark.png" },
    });

    expect(result.success).toBe(false);
  });

  it("rejects a license outside the vocabulary", () => {
    expect(Object.keys(LICENSES)).toContain("All-Rights-Reserved");
    expect(schema.safeParse({ ...frontmatter, license: "MIT" }).success).toBe(
      false,
    );
  });

  it("gives every license a label, and a URL except the reserved one", () => {
    for (const [id, license] of Object.entries(LICENSES)) {
      expect(license.label, id).not.toBe("");
    }
    expect(LICENSES["All-Rights-Reserved"].url).toBeUndefined();
    expect(LICENSES["CC-BY-4.0"].url).toBe(
      "https://creativecommons.org/licenses/by/4.0/",
    );
  });

  it("rejects a date that is not YYYY-MM-DD", () => {
    expect(schema.safeParse({ ...frontmatter, date: "2026-1-1" }).success).toBe(
      false,
    );
  });

  it("rejects a tag that is not a slug", () => {
    expect(
      schema.safeParse({ ...frontmatter, tags: ["Seed Article"] }).success,
    ).toBe(false);
  });

  it("rejects a licenseUrl that is not a URL", () => {
    expect(
      schema.safeParse({ ...frontmatter, licenseUrl: "creativecommons.org" })
        .success,
    ).toBe(false);
  });

  it("rejects frontmatter without a title or a date", () => {
    expect(schema.safeParse({ ...frontmatter, title: "" }).success).toBe(false);
    expect(schema.safeParse({ ...frontmatter, date: undefined }).success).toBe(
      false,
    );
  });
});
