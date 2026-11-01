# License

Copyright (c) 2026 Steve Hsu (什五). All rights reserved.

This repository is **source-available, not open source**. It is published
publicly alongside the live website at
<https://stevehsudrawing.github.io/articles>. Except for the permission
expressly granted in [§3](#3-permitted-use), no license or permission of any
kind is granted to use, copy, modify, adapt, publish, distribute, sublicense,
sell, or deploy any part of this repository. All rights are reserved.

## 1. Scope

This license covers the source code, build scripts, configuration, text, and
documentation in this repository, except for the material excluded in
[§2](#2-exclusions).

## 2. Exclusions

- **Article content** under `src/content/**` is not covered by this license.
  Each article declares its own license in its frontmatter, and that declaration
  governs it.
- **Third-party components** (dependencies, brand logos, social-media icons, and
  other third-party trademarks) remain the property of their respective owners
  and are governed by their own licenses.
- **What the built site redistributes** carries each work's license text with
  it, served from `public/licenses/`. Every other dependency is a build-time
  tool whose output is a file in the build, never code in it.

| Work                                                               | Use                                                                                                              | License                   | Copyright                                           |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------- |
| [Astro](public/licenses/astro-LICENSE.txt)                         | The island loader inlined into every page that has one, and `@astrojs/vue`'s client renderer                     | MIT                       | Copyright (c) 2021 Fred K. Schott                   |
| [Bootstrap](public/licenses/bootstrap-LICENSE.txt)                 | The compiled CSS: Reboot, the grid and the utilities                                                             | MIT                       | Copyright (c) 2011-2025 The Bootstrap Authors       |
| [BootstrapVueNext](public/licenses/bootstrap-vue-next-LICENSE.txt) | The header island's dropdowns and offcanvas                                                                      | MIT                       | Copyright (c) BootstrapVueNext                      |
| [Floating UI](public/licenses/floating-ui-LICENSE.txt)             | The positioning engine, inside BootstrapVueNext's own bundle: `core`, `dom`, `utils` and `vue`                   | MIT                       | Copyright (c) 2021-present Floating UI contributors |
| [focus-trap](public/licenses/focus-trap-LICENSE.txt)               | The focus trap that keeps a keyboard inside the open offcanvas                                                   | MIT                       | Copyright (c) 2015-2016 David Clark                 |
| [Prism](public/licenses/prism-themes-LICENSE.txt)                  | The fenced-code syntax theme in `src/styles/syntax.css`, adapted from prism-themes' One Light and One Dark       | MIT                       | Copyright (c) 2015 PrismJS                          |
| [tabbable](public/licenses/tabbable-LICENSE.txt)                   | The tabbable-node walk the trap is built on                                                                      | MIT                       | Copyright (c) 2015 David Clark                      |
| [Vue](public/licenses/vue-LICENSE.txt)                             | The island's runtime: the DOM renderer, the reactive core and the hydrator                                       | MIT                       | Copyright (c) 2018-present, Yuxi (Evan) You         |
| [VueUse](public/licenses/vueuse-LICENSE.txt)                       | The key, click-outside, breakpoint and DOM helpers, inside that same bundle: `core`, `shared` and `integrations` | MIT                       | Copyright (c) 2019-present Anthony Fu               |
| [Inter](public/licenses/inter-LICENSE.txt)                         | The Latin webfonts for prose, and the `@font-face` rules that serve them                                         | SIL Open Font License 1.1 | Copyright (c) 2016 The Inter Project Authors        |
| [Roboto Mono](public/licenses/roboto-mono-LICENSE.txt)             | The Latin webfonts for code, and the `@font-face` rules that serve them                                          | SIL Open Font License 1.1 | Copyright (c) 2015 The Roboto Mono Project Authors  |
| [Source Serif 4](public/licenses/source-serif-4-LICENSE.txt)       | The Latin webfonts for the article's serif face, and the `@font-face` rules that serve them                      | SIL Open Font License 1.1 | Copyright 2014 The Source Serif 4 Project Authors   |
| [Material Symbols](public/licenses/material-symbols-LICENSE.txt)   | The icon SVGs in `src/assets/icons/`, extracted from the Sharp font as glyph outlines                            | Apache License 2.0        | Copyright Google LLC                                |

Six of those arrive through another work's bundle rather than through this
repository's dependencies: BootstrapVueNext publishes Floating UI's, VueUse's,
focus-trap's and tabbable's code inside its own, and Astro's loader is written
into the page instead of being served from `_astro/`. They are listed separately
because they are separate works, and each ships its own license text.

## 3. Permitted Use

You may view the live website and read the source materials as presented on
GitHub. This is the only permission granted; it does not extend to any copying,
modification, distribution, hosting, or deployment of the materials.

## 4. Prohibited Use

Without prior written permission from the author, you may not:

- copy, reproduce, mirror, or otherwise duplicate any part of the materials;
- modify, adapt, translate, or create derivative works based on them;
- redistribute, sublicense, or sell them, in source or built form;
- deploy, host, publish, or otherwise make them available as a website or online
  service, including republishing them under a different name, account, or
  domain;
- remove or alter any copyright notice, attribution, or watermark.

## 5. Note on GitHub

This is a public repository hosted on GitHub. GitHub's Terms of Service allow
other users to view and fork public repositories through GitHub's own
functionality. Any such fork is limited to display within GitHub and grants no
rights beyond those described in [§3](#3-permitted-use); all other rights remain
reserved.

## 6. AI / Machine Learning

The materials may not be used as training data, fine-tuning data, or input for
any artificial-intelligence or machine-learning model, dataset, or system.

## 7. Contributions

No contributions are accepted; please do not submit pull requests or patches.

## 8. Disclaimer

The materials are published "as is", without warranty of any kind, express or
implied. The author is not liable for any claim, damage, or other liability
arising from any use of the materials.

## 9. Contact

For permission requests, contact Steve Hsu (什五) at
[stevehsudrawing@outlook.com](mailto:stevehsudrawing@outlook.com).
