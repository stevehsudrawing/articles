import type { APIRoute } from "astro";
import { published, type Article } from "../../../articles";
import type { Locale } from "../../../i18n/locales";
import { mirrorMarkdown } from "../../../llms";

const locale: Locale = "zh-hant";

// A markdown copy of each article, in the language it was written in: `index.md`
// beside the `index.html` the page route writes. Only a published article has
// one - the page route redirects a locale that lacks the article, and a redirect
// has no content to copy.

export async function getStaticPaths() {
  return (await published(locale)).map((article) => ({
    params: { slug: article.id },
    props: { article },
  }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(mirrorMarkdown({ locale, article: props.article as Article }), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
