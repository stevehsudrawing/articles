import { describe, expect, it } from "vitest";
import { parseAlertMarker } from "../src/alerts";
import {
  markdownAlerts,
  markdownHeadings,
  markdownPlugins,
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
  file = "file:///content/2026-10-11-seed/zh-hans.md",
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
    const en = runHeading({ id: "a" }, "1. What it checks", "file:///x/en.md");

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

describe("markdownPlugins", () => {
  it("runs the heading ids before the permalinks that point at them", () => {
    expect(markdownPlugins).toHaveLength(4);
    expect(typeof markdownPlugins[0]).toBe("function");
    expect(markdownPlugins[1]).toBe(markdownHeadings);
    expect(markdownPlugins[2]).toBe(markdownStep);
    expect(markdownPlugins[3]).toBe(markdownAlerts);
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
