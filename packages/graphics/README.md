# Graphics framework

This package owns renderer setup, typed factories, render passes, viewport bounds, frame samples, and object overlays. It has no game catalog or artwork. Applications inject asset factories and own their disposal order.

## Public interfaces

| Interface                   | Use                                                                     |
| --------------------------- | ----------------------------------------------------------------------- |
| `GraphicsBackend<Renderer>` | Common `renderer`, `resize()`, and `dispose()` contract                 |
| `WebGLBackend`              | Owns one Three.js renderer with explicit pixel ratio and color settings |
| `GraphicsCatalog<T>`        | Typed `create(name, ...args)` contract                                  |
| `FactoryCatalog<T>`         | Registers unique factories and creates their objects                    |
| `RenderPipeline<Context>`   | Runs named passes in order and disposes them in reverse order           |
| `FrameBudget`               | Stores bounded frame durations and reports frame rate and percentiles   |
| `clippedViewport()`         | Computes normalized viewport and clip bounds with a scroll offset       |
| `ObjectOverlay`             | Draws one borrowed object at a screen position                          |

## Object overlays

`ObjectOverlay` owns a scene and an orthographic camera. Its options accept a shared environment texture and an environment intensity. The supplied object owns its artwork and lights. Keep that object centered at the origin with a radius of one.

```ts
const overlay = new ObjectOverlay({ environment });
overlay.setObject(object);
overlay.prepare(renderer, worldTarget);
overlay.render(renderer, width, height, { x, y, diameter });
overlay.setObject(null);
overlay.dispose();
```

Use Cascading Style Sheets (CSS) pixels for `width`, `height`, and the placement. The placement origin is the top-left corner. The overlay maps those values to the active target dimensions. For a canvas, it uses the drawing buffer dimensions. This applies the device pixel ratio once, including targets with a different resolution.

Call `render()` after the world pass and before the final picture pass. It draws into the current target. It clears depth only inside the clipped object rectangle. It also obeys an active scissor rectangle. It restores the physical viewport, scissor rectangle, scissor test, and `autoClear` after the draw, including a failed draw.

An on-screen object needs two graphics state queries per frame. These read the active scissor rectangle and test. Hidden, missing, invalid, or off-screen objects need no state query. The overlay leaves the renderer's logical viewport and scissor defaults unchanged.

`prepare()` starts shader compilation with the supplied target flags. Call it after the environment and lights are ready. It restores the previous target, cube face, and mipmap level. It does not create a polling timer. Geometry uploads and first-use work can still occur on the first draw.

## Ownership and bounds

| Resource                     | Bound or owner                                   |
| ---------------------------- | ------------------------------------------------ |
| Factory registry             | 128 entries by default, with a constructor limit |
| Render pipeline              | 32 passes                                        |
| Frame history                | 120 samples by default, with a constructor limit |
| Backend pixel ratio          | Maximum 2 by default, with a settings limit      |
| Object overlay               | One scene, one camera, and one object slot       |
| Overlay targets and textures | No owned target or texture                       |
| Overlay object children      | Asset owner sets the limit                       |

`setObject()` detaches the previous object. It does not dispose that object's geometry, materials, or textures. The overlay also borrows the renderer and environment. Its `dispose()` detaches the object and releases its references. Repeated disposal is safe. The application must dispose the asset after detachment and the shared environment after every dependent scene.
