import type { APIRoute } from "astro";
import { publicPages } from "../public-pages";
import { sitemapXml } from "../sitemap";

// The one file that names every page a crawler may index. It is an endpoint
// rather than a page because nothing renders it, and its path carries a file
// extension, so Astro writes `dist/sitemap.xml` rather than a directory - which
// is the address the main site's `robots.txt` already points at.
export const GET: APIRoute = async () =>
  new Response(sitemapXml(await publicPages()), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
