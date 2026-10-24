// The alert vocabulary: what a marker is, which kinds exist, and nothing else.
//
// It has its own module because two things need it and neither should pull in
// the other's world: the renderer (`src/markdown.ts`) turns a marker into an
// alert, and the source guard (`src/content-layout.ts`) fails the build over a
// marker that names a kind GitHub does not have. The guard runs while the
// content collections are configured, so importing the renderer there would
// drag the icon set and the message tables into that phase for nothing.

import type { IconName } from "./icons";

/**
 * A blockquote line that opens an alert.
 *
 * GitHub's syntax is `> [!KIND]` as the first thing inside a blockquote, with
 * an optional title after it on the same line, and the word is matched without
 * regard to case - `[!note]` is a NOTE. Nothing else is a marker: a word
 * embedded in a sentence, a bracketed word that is not at the start, or one
 * with no closing bracket stays text.
 */
const ALERT_MARKER = /^\[!([A-Za-z]+)\](?:[ \t]+([\s\S]*))?$/;

/** One alert kind: its message key and the glyph that marks it. */
export interface AlertKind {
  /** The message key holding the kind's name in the reader's language. */
  key: string;
  /** The glyph, from the set the whole site shares. */
  icon: IconName;
}

/**
 * The five kinds GitHub defines, keyed by the marker's own word.
 *
 * The list is closed because GitHub's is: a sixth word is a typo, not a kind,
 * and the source guard reports it as one. Every kind draws the same surface -
 * the palette is one accent hue - so the label and this glyph are the only
 * things that tell them apart.
 */
export const ALERT_KINDS: Record<string, AlertKind> = {
  note: { key: "text-alert-note", icon: "info" },
  tip: { key: "text-alert-tip", icon: "lightbulb" },
  important: { key: "text-alert-important", icon: "smsFailed" },
  warning: { key: "text-alert-warning", icon: "warning" },
  caution: { key: "text-alert-caution", icon: "report" },
};

/** What a marker line says. */
export interface AlertMarker {
  /** The kind, lower-cased (`"note"`); may name no kind that exists. */
  kind: string;
  /** The title written after the marker, trimmed; empty when there is none. */
  title: string;
}

/**
 * Reads an alert marker off the first line of a blockquote.
 *
 * Pure and separate from the visitor so the rule can be tested without a
 * parser, and so the source guard can ask "does this line open an alert?"
 * without knowing how one renders.
 *
 * @param text - The line, as the paragraph's first text node holds it.
 * @returns The kind it names and any title, or `null` when it is not a marker.
 */
export function parseAlertMarker(text: string): AlertMarker | null {
  const match = ALERT_MARKER.exec(text.trim());
  if (!match) {
    return null;
  }
  return { kind: match[1].toLowerCase(), title: (match[2] ?? "").trim() };
}

/**
 * Whether a marker names one of the five kinds.
 *
 * @param kind - The kind as `parseAlertMarker()` lower-cases it.
 * @returns `true` when it is NOTE, TIP, IMPORTANT, WARNING or CAUTION.
 */
export function isAlertKind(kind: string): boolean {
  return kind in ALERT_KINDS;
}
