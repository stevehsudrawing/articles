import {
  createSatteriMarkdownProcessor,
  type SatteriProcessorOptions,
} from "@astrojs/markdown-satteri";
import { describe, expect, it } from "vitest";
import { parseAlertMarker } from "../src/alerts";
import { ICONS } from "../src/icons";
import {
  markdownAlerts,
  markdownCodeBlocks,
  markdownFootnotes,
  markdownHeadings,
  markdownPlugins,
  markdownRawHtml,
  markdownStep,
  tableOfContents,
} from "../src/markdown";

/** An element of the shape the visitor is handed. */
interface Element {
  type: string;
  tagName: string;
  properties?: Record<string, unknown>;
}

/** What the visitor set, in call order. */
type Patch = { key: string; value: unknown };

/**
 * Runs the visitor over one element, the way the processor does.
 *
 * @param tagName - The element's tag.
 * @param properties - The properties it already carries.
 * @returns The element and the patches the visitor applied.
 */
function run(tagName: string, properties: Record<string, unknown> = {}) {
  const element: Element = { type: "element", tagName, properties };
  const patches: Patch[] = [];

  markdownStep.element.visit(element, {
    setProperty: (_node, key, value) => {
      patches.push({ key, value });
    },
  });

  return { element, patches };
}

describe("markdownStep", () => {
  it("filters for the tags it changes", () => {
    expect(markdownStep.element.filter).toEqual(["table", "input", "pre"]);
    expect(markdownStep.name).toBe("articles/renderer-step");
  });

  it("adds Bootstrap's table class", () => {
    const { patches } = run("table");

    expect(patches).toEqual([{ key: "className", value: ["table"] }]);
  });

  it("keeps a class the table already carries", () => {
    const { patches } = run("table", { className: ["table-striped"] });

    expect(patches).toEqual([
      { key: "className", value: ["table-striped", "table"] },
    ]);
  });

  it("does not add the class twice", () => {
    const { patches } = run("table", { className: ["table", "table-sm"] });

    expect(patches).toEqual([]);
  });

  it("gives a task list's checkbox Bootstrap's control", () => {
    const { patches } = run("input", { type: "checkbox", disabled: true });

    expect(patches).toEqual([
      { key: "className", value: ["form-check-input"] },
    ]);
  });

  it("leaves another kind of input alone", () => {
    expect(run("input", { type: "text" }).patches).toEqual([]);
    expect(run("input").patches).toEqual([]);
  });

  it("makes a code block focusable", () => {
    const { patches } = run("pre", { className: ["language-yaml"] });

    expect(patches).toEqual([{ key: "tabIndex", value: 0 }]);
  });
});

/** A heading, wrapped the way the processor hands one to the visitor. */
interface Wrapped {
  node: unknown;
  parent: {
    tagName: string;
    properties: Record<string, unknown>;
    children: {
      properties: Record<string, unknown>;
      children: {
        properties?: Record<string, unknown>;
        children: { value: string }[];
      }[];
    }[];
  };
}

/**
 * Runs the heading step over one heading, the way the processor does.
 *
 * @param properties - What the heading already carries.
 * @param text - The text the context reports for it.
 * @param file - The document's URL, which names the locale.
 * @returns The heading, and what the step asked to wrap.
 */
function runHeading(
  properties: Record<string, unknown>,
  text = "1. 它要验证什么",
  file = "file:///content/2026-10-11-seed/zh-hans.mdx",
) {
  const element: Element = { type: "element", tagName: "h2", properties };
  const wrapped: Wrapped[] = [];

  markdownHeadings.element.visit(element, {
    fileURL: new URL(file),
    textContent: () => text,
    wrapNode: (node, parent) => {
      wrapped.push({ node, parent } as Wrapped);
    },
  });

  return { element, wrapped };
}

describe("markdownHeadings", () => {
  it("filters for the headings an article body can carry", () => {
    expect(markdownHeadings.element.filter).toEqual([
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
    ]);
    expect(markdownHeadings.name).toBe("articles/heading-anchors");
  });

  it("wraps the heading and puts the anchor after it", () => {
    const { element, wrapped } = runHeading({ id: "1-它要验证什么" });

    expect(wrapped).toHaveLength(1);
    expect(wrapped[0].node).toBe(element);
    expect(wrapped[0].parent.tagName).toBe("div");
    expect(wrapped[0].parent.properties.className).toEqual([
      "heading-with-anchor",
    ]);
    expect(wrapped[0].parent.children).toHaveLength(1);
  });

  it("points the anchor at the heading's own id", () => {
    const { wrapped } = runHeading({ id: "1-它要验证什么" });
    const anchor = wrapped[0].parent.children[0];

    expect(anchor.properties.className).toEqual(["heading-anchor"]);
    expect(anchor.properties.href).toBe("#1-它要验证什么");
  });

  it("names the link after the heading, in the file's locale", () => {
    const zh = runHeading({ id: "a" });
    const en = runHeading({ id: "a" }, "1. What it checks", "file:///x/en.mdx");

    expect(zh.wrapped[0].parent.children[0].properties.ariaLabel).toBe(
      "「1. 它要验证什么」的章节链接",
    );
    expect(en.wrapped[0].parent.children[0].properties.ariaLabel).toBe(
      'Section link: "1. What it checks"',
    );
  });

  it("keeps the glyph out of the link's name", () => {
    const { wrapped } = runHeading({ id: "a" });
    const glyph = wrapped[0].parent.children[0].children[0];

    expect(glyph.properties?.ariaHidden).toBe("true");
    expect(glyph.children[0].value).toContain("<svg");
  });

  it("leaves the renderer's footnote label alone", () => {
    const { wrapped } = runHeading({
      id: "footnote-label",
      className: ["sr-only"],
    });

    expect(wrapped).toEqual([]);
  });

  it("leaves a heading with no id alone", () => {
    expect(runHeading({}).wrapped).toEqual([]);
  });
});

/** A node the footnote step reads, for the fixtures below. */
interface FixtureNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: FixtureNode[];
}

/**
 * One notes section as the renderer writes it: a label, two notes, and the
 * first one cited twice.
 *
 * @returns A fresh tree for each call.
 */
function notesSection(): FixtureNode {
  const backref = (href: string, label: string): FixtureNode => ({
    type: "element",
    tagName: "a",
    properties: {
      href,
      dataFootnoteBackref: "",
      ariaLabel: label,
      className: ["data-footnote-backref"],
    },
    children: [{ type: "text", value: "↩" }],
  });
  const note = (id: string, ...links: FixtureNode[]): FixtureNode => ({
    type: "element",
    tagName: "li",
    properties: { id },
    children: [
      {
        type: "element",
        tagName: "p",
        properties: {},
        children: [{ type: "text", value: "The note. " }, ...links],
      },
    ],
  });

  return {
    type: "element",
    tagName: "section",
    properties: { dataFootnotes: "", className: ["footnotes"] },
    children: [
      {
        type: "element",
        tagName: "h2",
        properties: { className: ["sr-only"], id: "footnote-label" },
        children: [{ type: "text", value: "Footnotes" }],
      },
      {
        type: "element",
        tagName: "ol",
        properties: {},
        children: [
          note(
            "user-content-fn-a",
            backref("#user-content-fnref-a", "Back to reference 1"),
            backref("#user-content-fnref-a-2", "Back to reference 1-2"),
          ),
          note(
            "user-content-fn-b",
            backref("#user-content-fnref-b", "Back to reference 2"),
          ),
        ],
      },
    ],
  };
}

/**
 * Runs the footnote step over one section, the way the processor does.
 *
 * @param section - The tree to hand it.
 * @param file - The document's URL, which names the locale.
 * @returns What the step asked to replace and to set.
 */
function runFootnotes(
  section: FixtureNode,
  file = "file:///content/2026-10-11-seed/zh-hans.mdx",
) {
  const replaced: { node: unknown; newNode: unknown }[] = [];
  const patches: { node: unknown; key: string; value: unknown }[] = [];

  markdownFootnotes.element.visit(section, {
    fileURL: new URL(file),
    replaceNode: (node, newNode) => {
      replaced.push({ node, newNode });
    },
    setProperty: (node, key, value) => {
      patches.push({ node, key, value });
    },
  });

  return { replaced, patches };
}

describe("markdownFootnotes", () => {
  it("filters for the section the notes live in", () => {
    expect(markdownFootnotes.element.filter).toEqual(["section"]);
    expect(markdownFootnotes.name).toBe("articles/footnotes");
  });

  it("replaces the renderer's label with the file's own word", () => {
    const { replaced } = runFootnotes(notesSection());
    const labels = replaced.filter(
      (entry) => (entry.node as FixtureNode).value === "Footnotes",
    );

    expect(labels).toHaveLength(1);
    expect(labels[0].newNode).toEqual({ type: "text", value: "脚注" });
  });

  it("redraws every back reference's mark", () => {
    const { replaced } = runFootnotes(notesSection());
    const marks = replaced.filter(
      (entry) => (entry.node as FixtureNode).value === "↩",
    );

    expect(marks).toHaveLength(3);
    for (const mark of marks) {
      expect(mark.newNode).toEqual({
        type: "element",
        tagName: "span",
        properties: { className: ["text-icon"], ariaHidden: "true" },
        children: [{ type: "raw", value: ICONS.keyboardReturn }],
      });
    }
  });

  it("names each back reference after the citation it returns to", () => {
    const { patches } = runFootnotes(notesSection());

    expect(patches.map((patch) => patch.value)).toEqual([
      "返回引用 1",
      "返回引用 1-2",
      "返回引用 2",
    ]);
    expect(patches.every((patch) => patch.key === "ariaLabel")).toBe(true);
  });

  it("speaks the other locales too", () => {
    const hant = runFootnotes(notesSection(), "file:///x/zh-hant.mdx");
    const en = runFootnotes(notesSection(), "file:///x/en.mdx");

    expect(hant.replaced[0].newNode).toEqual({ type: "text", value: "腳注" });
    expect(hant.patches[0].value).toBe("返回引用 1");
    expect(en.replaced[0].newNode).toEqual({
      type: "text",
      value: "Footnotes",
    });
    expect(en.patches[2].value).toBe("Back to reference 2");
  });

  it("leaves a section that is not the notes' alone", () => {
    const section = notesSection();
    section.properties = {};

    expect(runFootnotes(section)).toEqual({ replaced: [], patches: [] });
  });

  it("replaces the label even when the section lists no note", () => {
    const section = notesSection();
    section.children = (section.children ?? []).slice(0, 1);

    const { replaced, patches } = runFootnotes(section);

    expect(replaced).toHaveLength(1);
    expect(patches).toEqual([]);
  });
});

/** A node the step inserts, as the visitor hands it over. */
interface InsertedNode {
  type: string;
  tagName: string;
  properties?: Record<string, unknown>;
  children?: unknown[];
}

/**
 * Runs the bar step over one code block, the way the processor does.
 *
 * @param properties - The `pre`'s properties, `data-language` included.
 * @param file - The article file, whose name names the locale.
 * @returns The nodes the step inserted, in order.
 */
function runCodeBlock(
  properties: Record<string, unknown>,
  file = "file:///content/2026-10-11-seed/zh-hans.mdx",
) {
  const element: Element = { type: "element", tagName: "pre", properties };
  const inserted: InsertedNode[] = [];

  markdownCodeBlocks.element.visit(element, {
    fileURL: new URL(file),
    insertBefore: (_node, newNode) => {
      inserted.push(newNode as InsertedNode);
    },
  });

  return inserted;
}

/**
 * Reads the label out of an inserted bar.
 *
 * @param bar - The bar node.
 * @returns The label's text.
 */
function labelOf(bar: InsertedNode): string {
  const [span] = bar.children as InsertedNode[];
  const [text] = span.children as { type: string; value: string }[];

  return text.value;
}

describe("markdownCodeBlocks", () => {
  it("filters for the code blocks it decorates", () => {
    expect(markdownCodeBlocks.element.filter).toEqual(["pre"]);
    expect(markdownCodeBlocks.name).toBe("articles/code-block-bar");
  });

  it("wraps the marker in a bar, without rewriting it", () => {
    const [bar] = runCodeBlock({ dataLanguage: "JavaScript" });

    expect(bar.tagName).toBe("div");
    expect(bar.properties).toEqual({
      className: ["code-block-bar"],
      dataCodeBlock: "",
    });
    expect(bar.children).toEqual([
      {
        type: "element",
        tagName: "span",
        properties: { className: ["code-block-language"] },
        children: [{ type: "text", value: "JavaScript" }],
      },
    ]);
  });

  it("falls back to the label when no language was written", () => {
    expect(labelOf(runCodeBlock({})[0])).toBe("代码块");
    expect(labelOf(runCodeBlock({ dataLanguage: "  " })[0])).toBe("代码块");
    expect(labelOf(runCodeBlock({ dataLanguage: "plaintext" })[0])).toBe(
      "代码块",
    );
  });

  it("speaks the label in the article's locale", () => {
    const [bar] = runCodeBlock({}, "file:///content/2026-10-11-seed/en.mdx");

    expect(labelOf(bar)).toBe("Code block");
  });
});

describe("the rendered pipeline", () => {
  /**
   * Renders one body through the site's steps.
   *
   * @param source - The Markdown to render.
   * @param locale - The locale whose messages the render resolves.
   * @returns The rendered HTML.
   */
  async function render(source: string, locale: string) {
    const processor = await createSatteriMarkdownProcessor({
      // Each step declares the part of the visitor context it reads, which is
      // narrower than the processor's own contract, so the list is cast where it
      // crosses into that contract.
      hastPlugins:
        markdownPlugins as unknown as SatteriProcessorOptions["hastPlugins"],
    });
    const { code } = await processor.render(source, {
      fileURL: new URL(`file:///content/post/${locale}.mdx`),
    });

    return code;
  }

  it("localizes a footnote's label and its back reference", async () => {
    const source = "正文[^a]与再次引用[^a]。\n\n[^a]: 注释。\n";
    const zh = await render(source, "zh-hans");
    const en = await render(source, "en");

    expect(zh).toContain('id="footnote-label">脚注</h2>');
    expect(zh).toContain('aria-label="返回引用 1"');
    expect(zh).toContain('aria-label="返回引用 1-2"');
    expect(zh).not.toContain("Back to reference");
    expect(zh).not.toContain("↩");
    expect(zh).toContain(
      'aria-hidden="true"><!-- Material Symbols: keyboard_return -->',
    );
    expect(en).toContain('id="footnote-label">Footnotes</h2>');
    expect(en).not.toContain("返回引用");
  });

  it("puts the bar directly before the code it names", async () => {
    const html = await render("```yaml\nloader: glob\n```\n", "zh-hans");
    const barEnd = html.indexOf("</div>") + "</div>".length;

    expect(html).toContain('<span class="code-block-language">yaml</span>');
    expect(html.slice(barEnd).trimStart().startsWith("<pre")).toBe(true);
  });
});

describe("markdownPlugins", () => {
  it("runs the heading ids before the permalinks that point at them", () => {
    expect(markdownPlugins).toHaveLength(7);
    expect(typeof markdownPlugins[0]).toBe("function");
    expect(markdownPlugins[1]).toBe(markdownHeadings);
    expect(markdownPlugins[2]).toBe(markdownFootnotes);
    expect(markdownPlugins[3]).toBe(markdownStep);
    expect(markdownPlugins[4]).toBe(markdownAlerts);
    expect(markdownPlugins[5]).toBe(markdownCodeBlocks);
  });

  it("leaves the raw-html parse last, after every step that inserts one", () => {
    expect(markdownPlugins.at(-1)).toBe(markdownRawHtml);
  });
});

describe("parseAlertMarker", () => {
  it("reads a bare marker", () => {
    expect(parseAlertMarker("[!NOTE]")).toEqual({ kind: "note", title: "" });
  });

  it("reads the title written after the marker", () => {
    expect(parseAlertMarker("[!TIP] 先看文档")).toEqual({
      kind: "tip",
      title: "先看文档",
    });
  });

  it("matches the kind without regard to case, as GitHub does", () => {
    expect(parseAlertMarker("[!warning]")).toEqual({
      kind: "warning",
      title: "",
    });
  });

  it("ignores the whitespace around the line", () => {
    expect(parseAlertMarker("  [!CAUTION]  ")).toEqual({
      kind: "caution",
      title: "",
    });
  });

  it("reports a kind that is not one of the five as a marker", () => {
    expect(parseAlertMarker("[!NOTEA]")).toEqual({ kind: "notea", title: "" });
  });

  it("leaves a bracketed word inside a sentence alone", () => {
    expect(parseAlertMarker("见 [!NOTE]")).toBeNull();
  });

  it("needs a closing bracket", () => {
    expect(parseAlertMarker("[!NOTE")).toBeNull();
  });

  it("needs whitespace before the title", () => {
    expect(parseAlertMarker("[!NOTE]标题")).toBeNull();
  });
});

describe("tableOfContents", () => {
  const headings = [
    { depth: 1, slug: "title", text: "Title" },
    { depth: 2, slug: "引言", text: "引言" },
    { depth: 3, slug: "一份清单", text: "一份清单" },
    { depth: 2, slug: "footnote-label", text: "Footnotes" },
    { depth: 4, slug: "too-deep", text: "Too deep" },
  ];

  it("lists h2 and h3 only", () => {
    expect(tableOfContents(headings).map((heading) => heading.slug)).toEqual([
      "引言",
      "一份清单",
    ]);
  });

  it("drops the renderer's footnote label", () => {
    const slugs = tableOfContents(headings).map((heading) => heading.slug);

    expect(slugs).not.toContain("footnote-label");
  });

  it("returns nothing for an article without headings", () => {
    expect(tableOfContents([])).toEqual([]);
  });
});

describe("markdownRawHtml", () => {
  /**
   * Runs the raw-html visitor over one piece of HTML.
   *
   * @param value - The HTML the raw node carries.
   * @returns The nodes the visitor replaced it with.
   */
  function parse(value: string) {
    let nodes: ReturnType<typeof markdownRawNodes> = [];
    markdownRawHtml.raw(
      { type: "raw", value },
      {
        replaceNode: (_node, replacement) => {
          nodes = markdownRawNodes(replacement);
        },
      },
    );
    return nodes;
  }

  /**
   * Types the replacement the visitor handed the context.
   *
   * @param nodes - The replacement, as the context receives it.
   * @returns The same nodes, with the fields the assertions read.
   */
  function markdownRawNodes(nodes: readonly unknown[]) {
    return nodes as readonly {
      type: string;
      tagName?: string;
      properties?: Record<string, unknown>;
    }[];
  }

  it("parses the icon's markup into elements", () => {
    const nodes = parse(ICONS.keyboardReturn);
    const svg = nodes.find((node) => node.tagName === "svg");

    expect(nodes.map((node) => node.type)).toContain("element");
    expect(svg?.properties?.xmlns).toBe("http://www.w3.org/2000/svg");
    expect(svg?.properties?.viewBox).toBe("0 0 24 24");
  });

  it("writes the parser's namespaced key as the attribute it names", () => {
    const properties = parse(ICONS.link2).find(
      (node) => node.tagName === "svg",
    )?.properties;

    expect(Object.keys(properties ?? {})).not.toContain(":xmlns");
  });

  it("parses a piece of HTML once, however often it appears", () => {
    expect(parse(ICONS.link2)).toBe(parse(ICONS.link2));
  });
});
