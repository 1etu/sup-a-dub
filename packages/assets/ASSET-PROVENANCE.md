# Asset credits

Sup-a-Dub combines a licensed sample duck with original toys, shaders, effects, music, and interface artwork. These are not extracted assets from the released PlayStation 3 game.

## Duck

The [Khronos Duck sample](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Duck) credits Sony, 2006. The model uses the [SCEA Shared Source License 1.0](models/SCEA.txt). Khronos metadata uses [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

`models/duck.glb` retains the downloaded binary. Runtime code centers, rotates, and scales it, then supplies new materials. `scripts/generate-duck-lods.ts` creates reduced-detail index sets with meshoptimizer. The high, medium, and low levels have 4,212, 1,600, and 1,088 triangles. The source notices remain beside the model.

## Fonts

| Font            | Source                                                                           | License and changes                                                                                              |
| --------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Supadub Display | [Righteous, Astigmatic](https://github.com/google/fonts/tree/main/ofl/righteous) | [SIL OFL 1.1](fonts/Supadub-Display-OFL.txt). Wider and heavier outlines, redesigned M/N/W/C/Y, new family name. |
| Audiowide       | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/audiowide)          | [SIL OFL 1.1](fonts/Audiowide-OFL.txt). Unchanged font.                                                          |
| Rajdhani Bold   | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/rajdhani)           | [SIL OFL 1.1](fonts/Rajdhani-OFL.txt). Unchanged font.                                                           |

`fonts/build_display.py` rebuilds the renamed derivative from `fonts/Righteous-source.ttf`. It needs Python, fontTools, and skia-pathops. The original reserved font name remains protected by its license.

## Original artwork and sound

The shark and other toy families use authored geometry. The duck variations use original materials and patterns. Soap bubbles, water, ceramic, clouds, and menu distortion use project shaders and textures.

Achievement medals, role badges, moderation icons, control glyphs, and cosmetics use authored drawings. Country flags are simplified geometric illustrations under the notice in [flags/LICENSE.txt](flags/LICENSE.txt).

Six original compositions use synthesized instrument samples and adaptive stems. No original game soundtrack or externally downloaded sample library enters the music. See [music/README.md](music/README.md).

The [brand files](../../docs/marketing/brand/) include outlined Supadub Display lettering and an avatar rendered from the licensed duck. Their notices travel with them. The hero is separate illustrated key art. Screenshots in the marketing gallery show the running game.

## Distribution

`bun run assets` copies runtime files and notices into the web public directory. Keep those notices in hosted builds. Third-party assets retain their own licenses. The [dependency notices](../../THIRD_PARTY_NOTICES.md) include the Three.js MIT text.
