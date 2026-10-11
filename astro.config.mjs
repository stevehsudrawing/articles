import { defineConfig } from "astro/config";
import { defaultLocale, localeIdentities } from "./src/i18n/locales.ts";

// `site` and `base` are the single home of the deployment location: every URL
// and asset URL is built from them, and no absolute site URL is written
// anywhere else.
export default defineConfig({
  site: "https://stevehsudrawing.github.io",
  base: "/articles",
  trailingSlash: "always",
  i18n: {
    defaultLocale,
    locales: localeIdentities,
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
});
