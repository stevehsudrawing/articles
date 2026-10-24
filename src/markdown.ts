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
//      Bootstrap's control, and `base.css` finishes the job - the filled state
//      and the square corner, both of which Bootstrap compiles to literals.
//   3. `tabindex="0"` on every `<pre>`. A fenced block scrolls horizontally,
//      and a scrollable box that cannot take focus cannot be scrolled by
//      keyboard. Shiki's output carried the attribute; Prism's does not.
//   4. A GitHub alert's marker turned into an alert block, with a title in the
//      article's own language - see `markdownAlerts` below.
//
// The Astro 7 processor is Sätteri, so the hook is a Sätteri hast visitor and
// not a unified plugin: `markdown.rehypePlugins` is the legacy path and needs
// `@astrojs/markdown-remark` installed, which replaces the processor. A
// visitor also filters in the parser rather than in JavaScript - only the
// elements named in `filter` are handed across - so the walk costs nothing on
// the rest of the document.

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

/** An element or a text node, as much of it as the alert step reads. */
interface AlertNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: readonly AlertNode[];
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
  removeChildAt(node: Readonly<AlertNode>, index: number): void;
  /**
   * Inserts a node as an element's first child.
   *
   * @param node - The parent.
   * @param child - The node to insert.
   */
  prependChild(node: Readonly<AlertNode>, child: unknown): void;
  /**
   * Sets one property on one node.
   *
   * @param node - The node to change.
   * @param key - The property's name, in hast's camelCase form (`className`).
   * @param value - The value; an array becomes a space-separated attribute.
   */
  setProperty(node: Readonly<AlertNode>, key: string, value: unknown): void;
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

/** The wrapper the glyph sits in, so it stays out of the accessibility tree. */
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
 * own children. `base.css` therefore excludes `.alert` from its blockquote
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
    visit(node: Readonly<AlertNode>, context: AlertVisitorContext): void {
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
      context.prependChild(paragraph, {
        type: "element",
        tagName: "span",
        properties: { className: [ALERT_ICON], ariaHidden: "true" },
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
      heading.slug !== "footnote-label",
  );
}
