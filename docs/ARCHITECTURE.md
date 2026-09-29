# Architecture

Sup-a-Dub runs one authoritative Bun server and a Three.js browser client. SQLite stores accounts, controls, rewards, profiles, rankings, and moderation records. The live pool stays in memory.

## Game state

Clients send input intent. The server validates the message and owns movement, collection, mass, collisions, rewards, and permissions. A browser cannot award itself an item or set its score.

The simulation runs at a fixed rate. Snapshots have a separate delivery rate and include only the nearby world. The client predicts local movement, corrects against server state, and interpolates remote ducks.

World chunks are deterministic and bounded. The server removes inactive chunks. Snapshot queues retain recent state instead of an unlimited backlog. Slow connections have queue and rate limits.

## Engines and content

The engine packages expose small contracts and controllers. They do not import the game's asset catalog.

- `graphics` supplies renderer ownership, factories, passes, and viewport tools. `gameengine` assembles cameras, scenes, and visual state.
- `audioengine` supplies adapters, a mixer, a scheduler, a voice pool, and stem transport. Individual sound recipes and compositions live in `assets`.
- `inputengine` maps device bindings to actions and contexts. The client supplies its menus and game actions.
- `network` supplies transport, channels, bounds, and reconnect behavior. `protocol` defines the messages that this game accepts.
- `core` and `features` supply shared lifecycle and feature registration. Chat, rankings, and moderation connect through those interfaces.

Cosmetic and achievement catalogs define IDs, requirements, rewards, and equipment slots. The server checks ownership when a player changes an outfit. Cosmetics do not change collision rules.

## Resource ownership

Every renderer, scene, sound controller, and connection has a lifetime owner. Shared meshes have shared resource owners. A menu preview borrows its model and does not dispose that model while another view needs it.

Particle pools, preview caches, active voices, decoded music, histories, and queues have explicit limits. Normal music quality allows 48 MiB of decoded buffers. Low quality allows 24 MiB.

## Changes

Import another package through its public exports. Keep strict types at the internal boundary and runtime validation at the external boundary. Put one behavior in each small module. Keep source free of comments and explain design decisions in documentation.

To add a cosmetic, register its definition, asset factory, and unlock rule. To add a sound, supply a recipe and request it by ID. To add a server action, define and validate its protocol message before connecting its handler.

## Deployment boundary

The current server is a single process. Two processes have separate live pools. SQLite needs persistent storage, and public browser sessions need HTTPS. See [Hosting](HOSTING.md).
