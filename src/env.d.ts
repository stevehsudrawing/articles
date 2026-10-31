/// <reference types="astro/client" />

// The reference above is what carries `astro:i18n`'s types: without it the
// virtual module has none, and `astro check` fails on `getRelativeLocaleUrl`
// even though the build succeeds.
