/// <reference types="astro/client" />

// This file is load-bearing, not vestigial: without the reference above,
// `astro:i18n`'s virtual module carries no types, and `astro check` fails on
// `getRelativeLocaleUrl` even though the build succeeds.
