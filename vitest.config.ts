import { getViteConfig } from "astro/config";

// `astro:content` is a virtual module, so a test that imports the collection
// definition or the content API needs Astro's Vite plugin to resolve it. The
// argument stays empty: Astro's helper does not type Vitest's own options, and
// Vitest's default include already covers `tests/**/*.test.ts`.
export default getViteConfig({});
