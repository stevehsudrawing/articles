<script setup lang="ts">
// The shell's one island: the brand, the navigation, and the two controls that
// need state. It is server-rendered and hydrated with `client:idle`, so the
// first render has to agree with the server's - the theme choice and the media
// query are therefore read in `onMounted` and never in the setup body.
//
// Wide: one row - the mark, the navigation, then the two dropdowns.
// Narrow: the same 64 px row with the mark centered, a menu button on the left
// and a settings button on the right, so the navigation and the two settings
// live in two offcanvas panels. A panel rather than a collapse because the bar
// has to stay one row: `--shar-header-height` is what the sticky header, the
// article's sidebar and `scroll-padding-top` all read, and a panel that grew
// the header would make every one of them wrong while it was open.
//
// BootstrapVueNext is imported here rather than registered globally: its
// `createBootstrap()` plugin registers no components, and a component that
// relied on it would render nothing at build time.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { BDropdown, BDropdownItem, BOffcanvas } from "bootstrap-vue-next";
import mark from "../assets/brand/mark.svg?raw";
import { ICONS, type IconName } from "../icons";

/** One link in the header's navigation. */
interface NavLink {
  href: string;
  label: string;
  current: boolean;
}

/** One entry in the language switcher. */
interface LanguageLink {
  /** The BCP-47 tag, for `hreflang`. */
  tag: string;
  /** The language's own name. */
  name: string;
  href: string;
  current: boolean;
}

/** One theme choice. */
interface ThemeOption {
  value: "auto" | "light" | "dark";
  label: string;
  icon: IconName;
}

interface Props {
  /** The site's name, which titles the navigation panel. */
  siteName: string;
  /** The navigation's links, in order. */
  nav: NavLink[];
  /** The same page in every locale. */
  languages: LanguageLink[];
  /** The language control's name, in the dropdown and in the panel. */
  languageLabel: string;
  /** The theme group's name inside the settings panel. */
  themeLabel: string;
  /** The narrow-screen menu button's accessible name. */
  menuLabel: string;
  /** The settings button's accessible name, and the panel's title. */
  settingsLabel: string;
  /** A panel's close button. */
  closeLabel: string;
  /** The three theme choices, in the main site's order. */
  themes: ThemeOption[];
}

const {
  siteName,
  nav,
  languages,
  languageLabel,
  themeLabel,
  menuLabel,
  settingsLabel,
  closeLabel,
  themes,
} = defineProps<Props>();

/** Whether the navigation panel is open; closed until asked for. */
const navOpen = ref(false);

/** Whether the settings panel is open; closed until asked for. */
const settingsOpen = ref(false);

/** The stored theme choice. The server has no storage, so the shared default. */
const choice = ref<ThemeOption["value"]>("auto");

const current = computed(
  () => themes.find((option) => option.value === choice.value) ?? themes[0],
);
const currentLanguage = computed(
  () => languages.find((entry) => entry.current) ?? languages[0],
);

// Bootstrap's `md`. The panels' `d-md-none` is the other half of the same fact:
// below it they exist, at or above it they do not, so a panel left open across
// the breakpoint would leave the page locked with nothing to show.
const WIDE = "(min-width: 768px)";
let wide: MediaQueryList | undefined;

/** The panels exist only below the breakpoint, so leaving it closes them. */
function closePanels(): void {
  if (wide?.matches) {
    navOpen.value = false;
    settingsOpen.value = false;
  }
}

onMounted(() => {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark" || stored === "auto") {
    choice.value = stored;
  }
  wide = window.matchMedia(WIDE);
  wide.addEventListener("change", closePanels);
});

onBeforeUnmount(() => wide?.removeEventListener("change", closePanels));

/**
 * Stores a theme choice and asks the pre-paint script to apply it.
 *
 * The script owns the application - it runs before the first paint and watches
 * the system preference - so this only writes the key and dispatches the event
 * it listens for. That keeps one home for the theme logic.
 *
 * @param value - The chosen theme.
 */
function setTheme(value: ThemeOption["value"]): void {
  localStorage.setItem("theme", value);
  choice.value = value;
  document.dispatchEvent(new Event("shar:theme"));
}
</script>

<template>
  <header class="site-header sticky-top bg-body">
    <nav class="navbar navbar-expand-md">
      <!--
        Below `md` this is a grid: the two buttons take the outer columns and
        the mark takes the middle one. At `md` it is Bootstrap's flex row.
      -->
      <div
        class="container site-header-row d-grid d-md-flex align-items-center"
      >
        <button
          class="site-header-control d-md-none"
          type="button"
          aria-controls="site-nav"
          :aria-expanded="navOpen"
          :aria-label="menuLabel"
          @click="navOpen = !navOpen"
        >
          <span
            class="site-header-icon"
            aria-hidden="true"
            v-html="ICONS.menu"
          ></span>
        </button>

        <a
          class="navbar-brand site-header-brand m-0"
          :href="nav[0].href"
          :aria-label="siteName"
        >
          <span
            class="site-header-mark"
            aria-hidden="true"
            v-html="mark"
          ></span>
        </a>

        <ul class="navbar-nav d-none d-md-flex me-auto ms-2">
          <li v-for="link in nav" :key="link.href" class="nav-item">
            <a
              class="nav-link"
              :class="{ active: link.current }"
              :href="link.href"
              :aria-current="link.current ? 'page' : undefined"
            >
              {{ link.label }}
            </a>
          </li>
        </ul>

        <ul class="navbar-nav d-none d-md-flex">
          <BDropdown is-nav :aria-label="languageLabel">
            <template #button-content>
              <span
                class="site-header-icon me-1"
                aria-hidden="true"
                v-html="ICONS.language"
              ></span>
              <span>{{ currentLanguage.name }}</span>
            </template>
            <BDropdownItem
              v-for="language in languages"
              :key="language.tag"
              :href="language.href"
              :lang="language.tag"
              :hreflang="language.tag"
              :active="language.current"
            >
              {{ language.name }}
            </BDropdownItem>
          </BDropdown>

          <BDropdown is-nav>
            <template #button-content>
              <span
                class="site-header-icon me-1"
                aria-hidden="true"
                v-html="ICONS[current.icon]"
              ></span>
              <span>{{ current.label }}</span>
            </template>
            <BDropdownItem
              v-for="option in themes"
              :key="option.value"
              :active="option.value === choice"
              @click="setTheme(option.value)"
            >
              <span
                class="site-header-icon me-2"
                aria-hidden="true"
                v-html="ICONS[option.icon]"
              ></span>
              {{ option.label }}
            </BDropdownItem>
          </BDropdown>
        </ul>

        <button
          class="site-header-control d-md-none"
          type="button"
          aria-controls="site-settings"
          :aria-expanded="settingsOpen"
          :aria-label="settingsLabel"
          @click="settingsOpen = !settingsOpen"
        >
          <span
            class="site-header-icon"
            aria-hidden="true"
            v-html="ICONS.settings"
          ></span>
        </button>
      </div>
    </nav>
  </header>

  <!--
    `teleport-disabled` is what keeps a panel in the server-rendered HTML:
    without it each one renders as an empty teleport, and the links inside it
    exist only after hydration.
  -->
  <BOffcanvas
    v-model="navOpen"
    id="site-nav"
    class="d-md-none"
    placement="start"
    :title="siteName"
    :header-close-label="closeLabel"
    width="min(320px, 85vw)"
    :teleport-disabled="true"
  >
    <ul class="navbar-nav">
      <li v-for="link in nav" :key="link.href" class="nav-item">
        <a
          class="nav-link"
          :class="{ active: link.current }"
          :href="link.href"
          :aria-current="link.current ? 'page' : undefined"
        >
          {{ link.label }}
        </a>
      </li>
    </ul>
  </BOffcanvas>

  <BOffcanvas
    v-model="settingsOpen"
    id="site-settings"
    class="d-md-none"
    placement="end"
    :title="settingsLabel"
    :header-close-label="closeLabel"
    width="min(320px, 85vw)"
    :teleport-disabled="true"
  >
    <h6 id="site-settings-language" class="site-panel-group">
      {{ languageLabel }}
    </h6>
    <ul class="navbar-nav" aria-labelledby="site-settings-language">
      <li v-for="language in languages" :key="language.tag" class="nav-item">
        <a
          class="nav-link"
          :class="{ active: language.current }"
          :href="language.href"
          :lang="language.tag"
          :hreflang="language.tag"
          :aria-current="language.current ? 'true' : undefined"
        >
          {{ language.name }}
        </a>
      </li>
    </ul>

    <h6 id="site-settings-theme" class="site-panel-group mt-3">
      {{ themeLabel }}
    </h6>
    <ul class="navbar-nav" aria-labelledby="site-settings-theme">
      <li v-for="option in themes" :key="option.value" class="nav-item">
        <button
          class="nav-link"
          type="button"
          :class="{ active: option.value === choice }"
          :aria-pressed="option.value === choice"
          @click="setTheme(option.value)"
        >
          <span
            class="site-header-icon me-2"
            aria-hidden="true"
            v-html="ICONS[option.icon]"
          ></span>
          {{ option.label }}
        </button>
      </li>
    </ul>
  </BOffcanvas>
</template>

<style scoped>
/* The header's own layer and its height come from `parameters.css`, so the
   sticky offset, the sidebar's offset and `scroll-padding-top` cannot drift
   apart - which is why the narrow layout is a panel rather than something that
   grows the bar. */
.site-header {
  height: var(--shar-header-height);
  z-index: var(--shar-z-header);

  /* The seam under the bar, drawn once the page is scrolled. The border is
     always there at its final width and only its color moves, so the bar's
     height never changes and `--shar-header-height` stays the one number the
     sticky offset, the contents' `max-height` and `scroll-padding-top` read.

     `animation-range: 0 1px` compresses the whole timeline into the page's
     first pixel, which makes "scrolled past the top" and "progress 100%" the
     same fact; `fill: both` holds it for the rest of the scroll. A 0s duration
     with a single `to` keyframe would instead say "this page can scroll" - it
     draws the line at the top of a long page, where the header is still in flow
     and nothing is under it, and it keeps the line after a viewport resize
     makes the page stop overflowing.

     Longhands, never the `animation` shorthand: folding it together with
     `animation-timeline` produces grammar the browser rejects and the whole
     declaration disappears. And no `transition`: an animation in effect
     outranks one on the same property, so it would never run - which is also
     why nothing here needs a reduced-motion guard. */
  border-bottom: var(--bs-border-width) solid transparent;
  animation-name: shar-header-edge;
  animation-duration: auto;
  animation-fill-mode: both;
  animation-timeline: scroll(root block);
  animation-range: 0 1px;
}

@keyframes shar-header-edge {
  from {
    border-bottom-color: transparent;
  }

  to {
    border-bottom-color: var(--bs-border-color);
  }
}

.site-header .navbar,
.site-header-row {
  height: 100%;
}

/* Below `md` the two buttons take the outer columns, so the mark in the middle
   one is centered whatever width the glyphs happen to have. Bootstrap's own
   `-md` breakpoint is `max-width: 767.98px`. */
@media (max-width: 767.98px) {
  .site-header-row {
    grid-template-columns: 1fr auto 1fr;
  }
}

.site-header-control {
  padding: 0;
  border: 0;
  line-height: 1;
  color: rgba(var(--bs-body-color-rgb), 0.8);
  background-color: transparent;
  height: 100%;
  width: 1.5rem;
}

.site-header-control:last-child {
  justify-self: end;
}

.site-header-brand {
  display: flex;
  align-items: center;
}

/* A glyph sits on the text's baseline box and takes its size from the font. The
   span is inline-flex so the same class serves a button, where the glyph is the
   whole content, and a menu item, where it sits before a label. */
.site-header-icon {
  display: inline-flex;
  vertical-align: -0.125em;
}

.site-header-mark :deep(svg) {
  display: block;
  width: 1em;
  height: 1em;
}

.site-header-icon :deep(svg) {
  display: block;
  width: 1.1em;
  height: 1.1em;
}

/* Below `md` the mark is the whole brand and stands alone in the bar; at `md`
   it sits beside the navigation and takes the text's size. */
.site-header-mark {
  font-size: 2rem;
  color: var(--bs-primary);
}

.site-panel-group {
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  opacity: 0.6;
}

@media (min-width: 768px) {
  .site-header-mark {
    font-size: 1.5rem;
  }
}

/* --- BDropdown toggle buttons look like nav-links, not Bootstrap buttons */
:deep(.dropdown-toggle.btn) {
  --bs-btn-padding-x: var(--bs-nav-link-padding-x, 0);
  --bs-btn-padding-y: var(--bs-nav-link-padding-y, 0);
  --bs-btn-font-size: inherit;
  --bs-btn-font-weight: inherit;
  --bs-btn-line-height: inherit;
  --bs-btn-color: var(--bs-nav-link-color, inherit);
  --bs-btn-bg: transparent;
  --bs-btn-border-width: 0;
  --bs-btn-border-radius: 0;
  --bs-btn-hover-color: var(--bs-nav-link-hover-color, inherit);
  --bs-btn-hover-bg: transparent;
  --bs-btn-hover-border-color: transparent;
  --bs-btn-active-color: var(--bs-nav-link-hover-color, inherit);
  --bs-btn-active-bg: transparent;
  --bs-btn-active-border-color: transparent;
}
</style>
