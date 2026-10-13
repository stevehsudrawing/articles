// The renderer's own step. Three things the built markup needs and the Markdown
// pipeline does not supply are added here, in one pass over the tree, because
// none of the three needs a dependency:
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
//
// The Astro 7 processor is Sätteri, so the hook is a Sätteri hast visitor and
// not a unified plugin: `markdown.rehypePlugins` is the legacy path and needs
// `@astrojs/markdown-remark` installed, which replaces the processor. A
// visitor also filters in the parser rather than in JavaScript - only the
// elements named in `filter` are handed across - so the walk costs nothing on
// the rest of the document.

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
