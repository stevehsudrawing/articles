import type { APIRoute } from "astro";
import type { Locale } from "../../../../i18n/locales";
import {
  licenseEntries,
  licenseSlug,
  type License,
} from "../../../../licenses";
import { licenseMarkdown } from "../../../../llms";

const locale: Locale = "zh-hans";

// A markdown copy of each document, beside the `index.html` the page route
// writes. A locale that does not hold the document has no copy: its page is a
// redirect, and a redirect has no content to copy.

export async function getStaticPaths() {
  return (await licenseEntries(locale)).map((license) => ({
    params: { slug: licenseSlug(license) },
    props: { license },
  }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(licenseMarkdown({ locale, license: props.license as License }), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
