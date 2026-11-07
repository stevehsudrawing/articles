import type { APIRoute } from "astro";
import { published } from "../articles";
import { defaultLocale, localeIdentities } from "../i18n/locales";
import { t } from "../i18n/messages";
import { llmsTxt } from "../llms";

// The file an agent reads first: the site's inventory, naming every published
// article and the address of its markdown copy. It is an endpoint rather than a
// page because nothing renders it, and its path carries a file extension, so
// Astro writes `dist/llms.txt` - the file every page's `rel="describedby"`
// points at.
export const GET: APIRoute = async () => {
  const locales = await Promise.all(
    localeIdentities.map(async (locale) => ({
      locale,
      articles: await published(locale),
    })),
  );

  const text = llmsTxt({
    siteName: t(defaultLocale, "text-site-name"),
    summary: t(defaultLocale, "text-hero-description-home"),
    locales,
  });

  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
