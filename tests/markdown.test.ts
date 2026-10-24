import { describe, expect, it } from "vitest";
import { parseAlertMarker } from "../src/alerts";
import { markdownStep, tableOfContents } from "../src/markdown";

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
