// The renderer's own steps. What the built markup needs and the Markdown
// pipeline does not supply is added here, in one pass over the tree each,
// because none of it needs a dependency:
//
//   1. Bootstrap's `table` class on every GFM table. Bootstrap attaches its
//      table styles to the class, and a bare `<table>` gets only Reboot's
//      `caption-side` and `border-collapse`.
//   2. Bootstrap's `form-check-input` class on a task list's checkbox. GFM
//      emits `<input type="checkbox" disabled>`, which no stylesheet draws: a
//      browser's default checkbox keeps its own shape, size and accent, and it
//      ignores both the theme and the accent scale. The class brings
//      Bootstrap's control, and `base.scss` finishes the job - the filled state
//      and the square corner, both of which Bootstrap compiles to literals.
//   3. `tabindex="0"` on every `<pre>`. A fenced block scrolls horizontally,
//      and a scrollable box that cannot take focus cannot be scrolled by
//      keyboard. Shiki's output carried the attribute; Prism's does not.
//   4. A link back to a section beside every heading - see `markdownHeadings`
//      below.
//   5. A GitHub alert's marker turned into an alert block, with a title in the
//      article's own language - see `markdownAlerts` below.
//   6. The renderer's two English footnote strings renamed in the article's
//      own language, and its back-reference mark redrawn - see
//      `markdownFootnotes` below.
//
// The Astro 7 processor is Sätteri, so the hook is a Sätteri hast visitor and
// not a unified plugin: `markdown.rehypePlugins` is the legacy path and needs
// `@astrojs/markdown-remark` installed, which replaces the processor. A
// visitor also filters in the parser rather than in JavaScript - only the
// elements named in `filter` are handed across - so the walk costs nothing on
// the rest of the document.

import { satteriHeadingIdsPlugin } from "@astrojs/markdown-satteri";
import { ALERT_KINDS, parseAlertMarker } from "./alerts";
import { ICONS } from "./icons";
import { defaultLocale, localeIdentities, type Locale } from "./i18n/locales";
import { t } from "./i18n/messages";

/** An element of the rendered tree, as much of it as this step reads. */
interface HastElement {
  type: string;
  tagName: string;
  properties?: Record<string, unknown>;
}

/** The visitor's context, as much of it as this step uses. */
interface HastVisitorContext {
  /**
   * Sets one property on one node.
   *
   * @param node - The node to change.
   * @param key - The property's name, in hast's camelCase form (`tabIndex`).
   * @param value - The value; an array becomes a space-separated attribute.
   */
  setProperty(node: Readonly<HastElement>, key: string, value: unknown): void;
}

/**
 * One class added to a node's class list, keeping what the node carries.
 *
 * @param node - The element to read.
 * @param name - The class to add.
 * @returns The class list to set, or `null` when the node already has it.
 */
function withClass(node: Readonly<HastElement>, name: string): string[] | null {
  const classes = node.properties?.className;
  const list = Array.isArray(classes) ? classes.map(String) : [];
  return list.includes(name) ? null : [...list, name];
}

/**
 * The hast visitor `astro.config.mjs` installs, by name and tag filter.
 *
 * The three changes share one visitor because they share one pass: a table and
 * a task list's checkbox get a class, and everything else in the filter - a
 * `<pre>` - is made focusable.
 */
export const markdownStep = {
  name: "articles/renderer-step",
  element: {
    filter: ["table", "input", "pre"],
    /**
     * Adds a Bootstrap class or the `<pre>` tabindex, keeping any class the
     * element already carries.
     *
     * @param node - The matched element.
     * @param context - The visitor's context.
     */
    visit(node: Readonly<HastElement>, context: HastVisitorContext): void {
      if (node.tagName === "input") {
        if (node.properties?.type !== "checkbox") {
          return;
        }
        const classes = withClass(node, "form-check-input");
        if (classes) {
          context.setProperty(node, "className", classes);
        }
        return;
      }
      if (node.tagName === "table") {
        const classes = withClass(node, "table");
        if (classes) {
          context.setProperty(node, "className", classes);
        }
        return;
      }
      context.setProperty(node, "tabIndex", 0);
    },
  },
};

/** An element with children, as `wrapNode` takes one. */
interface HastParentElement {
  type: "element";
  tagName: string;
  properties: Record<string, unknown>;
  children: unknown[];
}

/** The heading step's context, as much of it as it uses. */
interface HeadingVisitorContext {
  /** The file being rendered, for the language the link is named in. */
  readonly fileURL: URL | undefined;
  /**
   * The text of one element's descendants, as a screen reader would read it.
   *
   * @param node - The element to read.
   * @returns Its text without markup.
   */
  textContent(node: Readonly<HastElement>): string;
  /**
   * Wraps one node in a parent, placing the parent's own children after it.
   *
   * @param node - The node to wrap.
   * @param parent - The element it becomes the first child of.
   */
  wrapNode(node: Readonly<HastElement>, parent: HastParentElement): void;
}

/** The wrapper a heading and its permalink share, and the permalink's class. */
const HEADING_WRAPPER = "heading-with-anchor";
const HEADING_ANCHOR = "heading-anchor";

/**
 * Puts a link back to a section beside every heading in the article body.
 *
 * The link is a **sibling** of the heading inside a wrapper, never a child: a
 * child's accessible name is appended to the heading's own, and an `aria-hidden`
 * child would be a focusable link with no name at all. Beside it, the heading
 * keeps its name and its text content - which is also what the slug and the
 * table of contents are computed from - and the link carries its own.
 *
 * Two headings are left alone. The renderer's footnote label is `sr-only` and
 * absolutely positioned, so an anchor hooked to it would hang over the article
 * at that spot; and a heading with no `id` has nothing to link to.
 *
 * The glyph is the whole affordance, so the label names the section rather than
 * describing the picture.
 */
export const markdownHeadings = {
  name: "articles/heading-anchors",
  element: {
    filter: ["h2", "h3", "h4", "h5", "h6"],
    /**
     * Wraps one heading and appends its permalink.
     *
     * @param node - The heading, whose `id` the anchor points at.
     * @param context - The visitor's context.
     */
    visit(node: Readonly<HastElement>, context: HeadingVisitorContext): void {
      const id = node.properties?.id;
      if (typeof id !== "string") {
        return;
      }
      const classes = node.properties?.className;
      if (Array.isArray(classes) && classes.includes("sr-only")) {
        return;
      }

      const { locale } = localeOf(context.fileURL);
      context.wrapNode(node, {
        type: "element",
        tagName: "div",
        properties: { className: [HEADING_WRAPPER] },
        children: [
          {
            type: "element",
            tagName: "a",
            properties: {
              className: [HEADING_ANCHOR],
              href: `#${id}`,
              ariaLabel: t(
                locale,
                "text-action-permalink",
                context.textContent(node),
              ),
            },
            children: [
              {
                type: "element",
                tagName: "span",
                properties: { ariaHidden: "true" },
                children: [{ type: "raw", value: ICONS.link2 }],
              },
            ],
          },
        ],
      });
    },
  },
};

/** An element or a text node, as much of it as the steps below read. */
interface TreeNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: readonly TreeNode[];
}

/** The alert step's context, as much of it as it uses. */
interface AlertVisitorContext {
  /**
   * The file being rendered, as the processor was told it.
   *
   * An article file is named after its locale, so this is where the alert's
   * title learns which language to speak; `undefined` when the caller gave no
   * URL at all.
   */
  readonly fileURL: URL | undefined;
  /**
   * Removes one child of an element.
   *
   * @param node - The parent.
   * @param index - The child's position.
   */
  removeChildAt(node: Readonly<TreeNode>, index: number): void;
  /**
   * Inserts a node as an element's first child.
   *
   * @param node - The parent.
   * @param child - The node to insert.
   */
  prependChild(node: Readonly<TreeNode>, child: unknown): void;
  /**
   * Sets one property on one node.
   *
   * @param node - The node to change.
   * @param key - The property's name, in hast's camelCase form (`className`).
   * @param value - The value; an array becomes a space-separated attribute.
   */
  setProperty(node: Readonly<TreeNode>, key: string, value: unknown): void;
  /**
   * Records a diagnostic for the build to print.
   *
   * @param options - What to say, and how loudly.
   */
  report(options: {
    message: string;
    severity?: "error" | "warning" | "info";
  }): void;
}

/**
 * The name of the file being rendered.
 *
 * @param fileURL - The document's URL, when the processor was given one.
 * @returns Its last path segment, or a placeholder when there is none.
 */
function fileNameOf(fileURL: URL | undefined): string {
  return fileURL?.pathname.split("/").pop() ?? "(unknown file)";
}

/**
 * The locale an article file is written in.
 *
 * Every article file is named after its locale - `zh-hans.md` - which is the
 * identity the rest of the site treats as authoritative, so the file name is
 * the only thing this step needs from the document it is rendering.
 *
 * @param fileURL - The document's URL, when the processor was given one.
 * @returns The locale, and whether the file named one.
 */
function localeOf(fileURL: URL | undefined): {
  locale: Locale;
  named: boolean;
} {
  const name = fileNameOf(fileURL).replace(/\.mdx?$/, "");
  if (!localeIdentities.includes(name as Locale)) {
    return { locale: defaultLocale, named: false };
  }
  return { locale: name as Locale, named: true };
}

/**
 * The alert's half of the glyph wrapper: `.text-icon` in `base.scss` puts the
 * glyph on the title's baseline, and this name is the gap before the title.
 */
const ALERT_ICON = "alert-icon";

/**
 * Turns a GitHub alert into an alert block with a localized title.
 *
 * The marker is GitHub's, so the source stays portable and an author writes
 * what they would write in a GitHub comment. What the marker becomes is this
 * site's: a block on Bootstrap's `.alert` plus the kind's own color family, a
 * title that names the kind in the article's own language, and the kind's
 * glyph.
 *
 * It stays a `<blockquote>`: measured, `setProperty(node, "tagName", "div")`
 * writes a `tagName="div"` attribute rather than renaming the element, and the
 * visitor's return value is not a replacement path for a node that keeps its
 * own children. `base.scss` therefore excludes `.alert` from its blockquote
 * rule - the quotation's dimming and left border belong to a quotation.
 *
 * The title has three sources, in order: text the author wrote after the
 * marker, other inline nodes on that same line, and the message table. A marker
 * that names no kind is reported and left as text - printing `[!NOTEA]` is a
 * worse failure than a warning in the build output.
 */
export const markdownAlerts = {
  name: "articles/alerts",
  element: {
    filter: ["blockquote"],
    /**
     * Recognizes the marker and rebuilds the blockquote's first paragraph.
     *
     * @param node - The blockquote.
     * @param context - The visitor's context.
     */
    visit(node: Readonly<TreeNode>, context: AlertVisitorContext): void {
      // The tree keeps the newlines between blocks, so the first child is
      // usually a whitespace text node; the marker lives in the first element.
      const paragraph = (node.children ?? []).find(
        (child) => child.type === "element",
      );
      if (!paragraph || paragraph.tagName !== "p") {
        return;
      }
      const inline = paragraph.children ?? [];
      const at = inline.findIndex(
        (child) => !(child.type === "text" && !(child.value ?? "").trim()),
      );
      const marker = at >= 0 ? inline[at] : undefined;
      if (
        !marker ||
        marker.type !== "text" ||
        typeof marker.value !== "string"
      ) {
        return;
      }
      const parsed = parseAlertMarker(marker.value);
      if (!parsed) {
        return;
      }
      const kind = ALERT_KINDS[parsed.kind];
      if (!kind) {
        // Left alone on purpose: a marker naming no kind stays the paragraph
        // it was. The processor's diagnostics never reach the build, and a
        // throw here would make the content loader drop the article's whole
        // body while the build still exits 0 - both measured - so the report
        // comes from `assertAlertMarkers()` in `src/content-layout.ts`, where
        // a throw is fatal.
        return;
      }

      const { locale, named } = localeOf(context.fileURL);
      if (!named) {
        context.report({
          message:
            "An alert needs the article's locale, and this file is not named after one; its title falls back to the default locale.",
          severity: "warning",
        });
      }

      const title = parsed.title || t(locale, kind.key);
      const tail = inline
        .slice(at + 1)
        .some(
          (child) => !(child.type === "text" && !(child.value ?? "").trim()),
        );
      if (parsed.title || !tail) {
        context.setProperty(marker, "value", title);
      } else {
        // The title is the rest of the line - emphasis the author wrote - so
        // only the marker itself goes.
        context.removeChildAt(paragraph, at);
      }
      context.setProperty(paragraph, "className", ["alert-title"]);
      // Two classes on the span: the shared wrapper from `base.scss`, and the
      // alert's own gap. `aria-hidden` keeps the glyph out of the name the
      // title already states.
      context.prependChild(paragraph, {
        type: "element",
        tagName: "span",
        properties: {
          className: ["text-icon", ALERT_ICON],
          ariaHidden: "true",
        },
        children: [{ type: "raw", value: ICONS[kind.icon] }],
      });

      context.setProperty(node, "className", [
        "alert",
        `alert-${kind.variant}`,
      ]);
      // The kind stays readable even where two kinds share a variant, and it is
      // the word a rule or a test keys on rather than a class name that has to
      // be decoded back into one.
      context.setProperty(node, "dataAlertKind", parsed.kind);
    },
  },
};

/** The id the renderer gives the notes' own heading, and what a reference points at. */
const FOOTNOTE_LABEL_ID = "footnote-label";

/** The footnote step's context, as much of it as it uses. */
interface FootnoteVisitorContext {
  /**
   * The file being rendered, as the processor was told it.
   *
   * An article file is named after its locale, so this is where the label
   * learns which language to speak; `undefined` when the caller gave no URL.
   */
  readonly fileURL: URL | undefined;
  /**
   * Puts one node in another's place.
   *
   * @param node - The node to replace.
   * @param newNode - What takes its place.
   */
  replaceNode(node: Readonly<TreeNode>, newNode: unknown): void;
  /**
   * Sets one property on one node.
   *
   * @param node - The node to change.
   * @param key - The property's name, in hast's camelCase form (`ariaLabel`).
   * @param value - The value; an array becomes a space-separated attribute.
   */
  setProperty(node: Readonly<TreeNode>, key: string, value: unknown): void;
}

/**
 * The back references inside one note, in document order.
 *
 * @param node - The note's list item.
 * @returns Its links, outermost first.
 */
function footnoteBackReferences(node: Readonly<TreeNode>): TreeNode[] {
  const found: TreeNode[] = [];
  for (const child of node.children ?? []) {
    if (child.type !== "element") {
      continue;
    }
    if (
      child.tagName === "a" &&
      "dataFootnoteBackref" in (child.properties ?? {})
    ) {
      found.push(child);
    } else {
      found.push(...footnoteBackReferences(child));
    }
  }
  return found;
}

/**
 * The mark a back reference shows in place of the renderer's `↩`.
 *
 * @returns A fresh node, because one is inserted per back reference.
 */
function footnoteBackReferenceMark(): TreeNode {
  return {
    type: "element",
    tagName: "span",
    properties: { className: ["text-icon"], ariaHidden: "true" },
    children: [{ type: "raw", value: ICONS.keyboardReturn }],
  };
}

/**
 * Speaks the renderer's two footnote strings in the article's own language.
 *
 * The notes' heading and every back reference's label are the renderer's own
 * text, and the one option that carries both - Sätteri's
 * `features.gfm.footnotes` - is read once when the processor is built, so it
 * can serve only one language per build. The file's name is the locale here,
 * exactly as it is for the alert titles.
 *
 * The reference a back reference returns to is rebuilt rather than read out of
 * the English label: the item's position among the notes answers which note,
 * and the link's position inside it answers which citation - the `n` and `n-k`
 * the renderer substitutes into its own label.
 *
 * The mark itself is redrawn for a reason of its own: `↩` is a character the
 * site's webfont does not cover, so its shape would be the platform's choice -
 * and on Android the color emoji font's. It becomes the site's own glyph, in
 * the same `1em` `currentColor` box as every other inline icon.
 */
export const markdownFootnotes = {
  name: "articles/footnotes",
  element: {
    filter: ["section"],
    /**
     * Renames the label and every back reference in one notes section.
     *
     * @param node - The section, when it is the notes' own.
     * @param context - The visitor's context.
     */
    visit(node: Readonly<TreeNode>, context: FootnoteVisitorContext): void {
      if (!("dataFootnotes" in (node.properties ?? {}))) {
        return;
      }
      const { locale } = localeOf(context.fileURL);
      let note = 0;

      for (const child of node.children ?? []) {
        if (child.type !== "element") {
          continue;
        }
        if (child.tagName === "h2") {
          const text = child.children?.[0];
          if (
            child.properties?.id === FOOTNOTE_LABEL_ID &&
            text?.type === "text"
          ) {
            context.replaceNode(text, {
              type: "text",
              value: t(locale, "text-heading-footnotes"),
            });
          }
          continue;
        }
        if (child.tagName !== "ol") {
          continue;
        }
        for (const item of child.children ?? []) {
          if (item.type !== "element" || item.tagName !== "li") {
            continue;
          }
          note += 1;
          footnoteBackReferences(item).forEach((link, index) => {
            const reference = index === 0 ? `${note}` : `${note}-${index + 1}`;
            context.setProperty(
              link,
              "ariaLabel",
              t(locale, "text-action-footnote-backref", reference),
            );
            const arrow = (link.children ?? []).find(
              (child) => child.type === "text",
            );
            if (arrow) {
              context.replaceNode(arrow, footnoteBackReferenceMark());
            }
          });
        }
      }
    },
  },
};

/**
 * The steps `astro.config.mjs` installs, in the order they have to run.
 *
 * `satteriHeadingIdsPlugin()` comes first for one reason: the processor pushes
 * its own copy of that plugin after every user plugin, so a step here that needs
 * a heading's `id` would otherwise find none. Its later run finds an `id`
 * already set and adopts it, so one slug stands behind both the permalinks and
 * the table of contents.
 */
export const markdownPlugins = [
  satteriHeadingIdsPlugin(),
  markdownHeadings,
  markdownFootnotes,
  markdownStep,
  markdownAlerts,
];

/** A heading, as `render()` reports it and the table of contents consumes. */
export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

/** The shallowest heading level the table of contents lists. */
const SHALLOWEST = 2;

/** The deepest heading level the table of contents lists. */
const DEEPEST = 3;

/**
 * The table of contents for a rendered article.
 *
 * The renderer injects a heading of its own - `<h2 id="footnote-label">`, the
 * notes' label - and it is not part of the article's structure, so it is
 * dropped here rather than shown as a section. The list covers `h2` and `h3`:
 * articles start at `##` and are not numbered, so those two are the article's
 * own levels, and needing a fourth is a sign the article should be split.
 *
 * @param headings - The `headings` array `render()` hands back.
 * @returns The headings to list, in document order.
 */
export function tableOfContents(headings: readonly Heading[]): Heading[] {
  return headings.filter(
    (heading) =>
      heading.depth >= SHALLOWEST &&
      heading.depth <= DEEPEST &&
      heading.slug !== FOOTNOTE_LABEL_ID,
  );
}
