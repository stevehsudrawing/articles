# Steve Hsu (什五)'s Articles

The source of Steve Hsu (什五)'s personal blog. The site is built with Astro and
published with GitHub Pages at <https://stevehsudrawing.github.io/articles>.

## 1. Browser Support

Every page is static HTML and CSS, and no page downloads a JavaScript file.

| Browser | Supported | Best Experience |
| ------- | --------- | --------------- |
| Chrome  | ≥ 105     | ≥ 116           |
| Edge    | ≥ 105     | ≥ 116           |
| Firefox | ≥ 121     | ≥ 159           |
| Safari  | ≥ 15.4    | ≥ 26            |

`Supported` is the version at which every style the site ships applies. Nothing
is blocked or redirected below it, and the page still reads.

`Best Experience` is where the effects driven by the reader's scroll position
arrive: the reading-progress line and ring on an article, the seam under the
header, and the mark on the table of contents' current section. They are pure
CSS, gated by `@supports`, and simply absent before that version.

## 2. License

The site's code is source-available, not open source: its terms are in
[LICENSE.md](./LICENSE.md), and they do not permit deploying it. Each article
declares its own license in its frontmatter.
