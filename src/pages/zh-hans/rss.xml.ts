import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { published } from "../../articles";
import { feedOptions } from "../../feed";

export const GET: APIRoute = async () =>
  rss(feedOptions("zh-hans", await published("zh-hans")));
