import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";
import { defaultLocale, localeIdentities } from "./src/i18n/locales.ts";
import { markdownPlugins } from "./src/markdown.ts";
import { BASE, SITE } from "./site.config.mjs";

// `site` and `base` come from `site.config.mjs`, the single home of the
// deployment location: every URL and asset URL is built from them, and no
// absolute site URL is written anywhere else.
export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: "always",
  i18n: {
    defaultLocale,
    locales: localeIdentities,
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  build: {
    // The purge reads `_astro/*.css`; an inlined sheet is invisible to it, and
    // a small scoped sheet is cached better as a shared file than as a
    // per-page `<style>` block.
    inlineStylesheets: "never",
  },
  markdown: {
    // Prism rather than the default Shiki: Shiki writes a fixed theme's colors
    // into the markup as a style attribute, which no stylesheet can override,
    // while Prism emits classes and leaves every color to
    // `src/styles/syntax.css`.
    syntaxHighlight: "prism",
    // Sätteri is Astro's default processor; naming it is what lets the steps in
    // `src/markdown.ts` be installed, and they arrive as one list because their
    // order matters - the heading ids have to exist before the permalinks that
    // point at them. The steps add what the renderer leaves out: Bootstrap's
    // `table` class on a GFM table, `tabindex="0"` on a scrollable `<pre>` so a
    // keyboard can reach it, a link back to each section, and a GitHub alert's
    // marker turned into an alert block with a localized title. Only
    // `hastPlugins` is passed, so every other default - GFM, footnotes, smart
    // punctuation - is the processor's own, unchanged.
    processor: satteri({ hastPlugins: markdownPlugins }),
  },
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          // Bootstrap 5.3.8 still uses `@import`, and its color helpers call
          // deprecated global functions; both warn on every compile.
          loadPaths: ["node_modules"],
          silenceDeprecations: [
            "import",
            "global-builtin",
            "color-functions",
            "if-function",
          ],
        },
      },
    },
  },
});
