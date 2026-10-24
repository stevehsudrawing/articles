import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";
import { satteri } from "@astrojs/markdown-satteri";
import { defaultLocale, localeIdentities } from "./src/i18n/locales.ts";
import { markdownAlerts, markdownStep } from "./src/markdown.ts";

// `site` and `base` are the single home of the deployment location: every URL
// and asset URL is built from them, and no absolute site URL is written
// anywhere else.
export default defineConfig({
  site: "https://stevehsudrawing.github.io",
  base: "/articles",
  trailingSlash: "always",
  // The interaction layer: Vue renders the shell's one island. `vue()` takes no
  // `appEntrypoint`, because the plugin that option exists for registers no
  // components - BootstrapVueNext is imported by the component that uses it.
  integrations: [vue()],
  i18n: {
    defaultLocale,
    locales: localeIdentities,
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  markdown: {
    // Prism rather than the default Shiki: Shiki writes a fixed theme's colors
    // into the markup as a style attribute, which no stylesheet can override,
    // while Prism emits classes and leaves every color to
    // `src/styles/syntax.css`.
    syntaxHighlight: "prism",
    // Sätteri is Astro's default processor; naming it is what lets the steps in
    // `src/markdown.ts` be installed. The first adds what the renderer leaves
    // out - Bootstrap's `table` class on a GFM table, and `tabindex="0"` on a
    // scrollable `<pre>` so a keyboard can reach it; the second turns a GitHub
    // alert's marker into an alert block with a localized title. Only
    // `hastPlugins` is passed, so every other default - GFM, footnotes, smart
    // punctuation - is the processor's own, unchanged.
    processor: satteri({ hastPlugins: [markdownStep, markdownAlerts] }),
  },
});
