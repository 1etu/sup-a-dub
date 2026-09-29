# Sup-a-Dub brand artwork

These files combine project lettering, a rendered avatar, and separate promotional key art. The palette uses blue, pink, and lime.

| File | Size | Use |
| --- | --- | --- |
| `supadub-hero.png` | 1672 by 941 | README and social image |
| `supadub-wordmark.png` | 1452 by 265 | Transparent wordmark |
| `supadub-avatar.png` | 1024 by 1024 | Square profile image |
| `supadub-avatar-512.png` | 512 by 512 | App icon |
| `supadub-avatar-192.png` | 192 by 192 | Small app icon |
| `badges.svg` | 912 by 44 | README technology strip |

The avatar and wordmark also have SVG sources. Every letter is a path. Each SVG embeds its model renders. The SVGs need no external fonts or image files.

Their metadata records the sources and notices. `manifest.json` records dimensions, hashes, browser version, and render results.

## Sources and licenses

The duck mesh and base texture come from the Sony Duck sample of 2006. [Khronos](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Duck) archives that sample. The [SCEA license](licenses/SCEA.txt) governs its use. The render uses yellow, pink, and mint materials from this project. The sailor cap uses authored project geometry. The sample has no proven identity as a shipped retail game asset.

The wordmark uses Supadub Display, a modified derivative of [Righteous](https://github.com/google/fonts/tree/main/ofl/righteous). Brian J. Bonislawsky, Astigmatic, created the source font. The [font notice](licenses/Supadub-Display-OFL.txt) retains its SIL Open Font License.

Supporting lettering uses [Rajdhani Bold](https://github.com/google/fonts/tree/main/ofl/rajdhani), by Indian Type Foundry. This folder includes its [SIL Open Font License](licenses/Rajdhani-OFL.txt).

Chrome rendered the avatar from the Three.js scene. The transparent wordmark has zero alpha at all four corners. The export run reports no browser errors.

## Hero

The hero is an ImageGen illustration directed as a 2007-era console-game wallpaper. The project wordmark and duck renders supplied the subject references. The original game's promotional art supplied a study of clouds, scale, and composition. The result is new promotional artwork, not an in-game screenshot or a literal mesh render.

The direction uses a central glossy title, yellow and gold ducks, peach clouds, blue sky, and soap bubbles. It contains no sales copy, interface panels, platform logos, or rating marks. The earlier website-style banner is retired.
