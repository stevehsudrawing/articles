// The extracted Material Symbols glyphs, imported once so both an Astro
// component and the header island read the same set. `?raw` keeps the SVG's
// `currentColor` fill, which is the whole reason the glyphs are inlined rather
// than served as files.
import arrowOutward from "./assets/icons/arrow_outward.svg?raw";
import calendarToday from "./assets/icons/calendar_today.svg?raw";
import chevronLeft from "./assets/icons/chevron_left.svg?raw";
import chevronRight from "./assets/icons/chevron_right.svg?raw";
import contrast from "./assets/icons/contrast.svg?raw";
import darkMode from "./assets/icons/dark_mode.svg?raw";
import info from "./assets/icons/info.svg?raw";
import language from "./assets/icons/language.svg?raw";
import lightMode from "./assets/icons/light_mode.svg?raw";
import lightbulb from "./assets/icons/lightbulb.svg?raw";
import menu from "./assets/icons/menu.svg?raw";
import person from "./assets/icons/person.svg?raw";
import report from "./assets/icons/report.svg?raw";
import settings from "./assets/icons/settings.svg?raw";
import smsFailed from "./assets/icons/sms_failed.svg?raw";
import update from "./assets/icons/update.svg?raw";
import warning from "./assets/icons/warning.svg?raw";

/** The glyphs the site uses, by the name the extraction tool wrote. */
export const ICONS = {
  arrowOutward,
  calendarToday,
  chevronLeft,
  chevronRight,
  contrast,
  darkMode,
  info,
  language,
  lightMode,
  lightbulb,
  menu,
  person,
  report,
  settings,
  smsFailed,
  update,
  warning,
} as const;

/** The name of a glyph in `ICONS`. */
export type IconName = keyof typeof ICONS;
