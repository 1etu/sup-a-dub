import {
  ENDLESS,
  WORLD,
  bodyRadius,
  bodySpeed,
  type ActionMessage,
  type GameEvent,
  type InputMessage,
  type Skin,
  type Vec2,
  type WorldSnapshot,
} from '@supadub/protocol';
import type { Metric } from '@supadub/achievements';
import { applyAction } from './actions';
import { createChunkObjects, chunkCoordinates } from './chunks';
import { applyInput, collideObstacles, createPlayer, seededRandom, sweptDistance } from './common';
import { stepPellets, stepSharks } from './sharks';
import { SpatialIndex } from './spatial';
import { createSnapshotFrame, type SnapshotReader } from './snapshot-frame';
import type { Chunk, SimBody, SimPellet, SimShark, SimulationPlayer, WorldOptions } from './types';
import { observeTravel, observeFeedingChunk } from './observed-metrics';
import { addBodyMass, decayBody } from './mass';

const botNames = ['Bubbles', 'Sir Quacks', 'Waddles', 'Ducky', 'Floaty', 'Puddles'];

export class EndlessWorld {
  readonly mode = 'endless' as const;
  readonly players = new Map<string, SimulationPlayer>();
  readonly chunks = new Map<string, Chunk>();
  readonly bodies = new Map<string, SimBody>();
  readonly pellets = new Map<string, SimPellet>();
  readonly sharks = new Map<string, SimShark>();
  readonly sharkRespawns = new Map<string, { x: number; z: number; at: number }>();
  readonly bodyIndex = new SpatialIndex<SimBody>();
  readonly sharkIndex = new SpatialIndex<SimShark>();
  readonly feedingIndex = new SpatialIndex<SimBody>();
  readonly bounds = null;
  readonly exits = [];
  readonly practice = null;
  readonly seed: number;
  readonly maxChunks: number;
  tick = 0;
  time = 0;
  private serial = 0;
  private readonly owned = new Map<string, Set<string>>();
  private readonly botCount: number;
  private lastChunkUpdate = -Infinity;
  private lastBotUpdate = -Infinity;

  constructor(private readonly options: WorldOptions) {
    this.seed = options.seed ?? 731;
    this.maxChunks = options.maxChunks ?? ENDLESS.maxChunks;
    this.botCount = Math.min(ENDLESS.maxBots, Math.max(0, options.bots ?? ENDLESS.maxBots));
  }

  nextId(kind: string): string {
    return `${kind}:${++this.serial}`;
  }

  addPlayer(
    id: string,
    name: string,
    skin: Skin,
    now: number,
    position?: Vec2,
    bot = false,
  ): SimulationPlayer {
    if (this.players.has(id)) this.removePlayer(id);
    const player = createPlayer(id, name, skin, now, position ?? this.spawnPosition(id), bot);
    this.players.set(id, player);
    this.owned.set(id, new Set());
    this.createBody(player, ENDLESS.startMass, player, now);
    this.time = now;
    this.refreshPlayer(player, now);
    this.maintainChunks(now, true);
    return player;
  }

  removePlayer(id: string): SimulationPlayer | undefined {
    const player = this.players.get(id);
    for (const body of this.ownedBodies(id)) this.removeBody(body.id, false);
    this.owned.delete(id);
    this.players.delete(id);
    return player;
  }

  ownedBodies(id: string): SimBody[] {
    return [...(this.owned.get(id) ?? [])].map((key) => this.bodies.get(key)!).filter(Boolean);
  }

  createBody(player: SimulationPlayer, mass: number, position: Vec2, now: number): SimBody {
    if ((this.owned.get(player.id)?.size ?? 0) >= ENDLESS.maxBodies)
      throw new Error('A player cannot have more than sixteen ducks.');
    const id = this.nextId('body');
    const body: SimBody = {
      id,
      ownerId: player.id,
      x: position.x,
      z: position.z,
      previousX: position.x,
      previousZ: position.z,
      vx: 0,
      vz: 0,
      angle: player.angle,
      mass: Math.min(ENDLESS.maxMass, Math.max(1, Math.floor(mass))),
      decayRemainder: 0,
      radius: bodyRadius(mass),
      skin: player.skin,
      launchUntil: 0,
      mergeAt: 0,
      protectedUntil: player.protectedUntil,
      launchX: 0,
      launchZ: 0,
      launchStartedAt: 0,
      launchDurationMs: ENDLESS.launchMs,
      launchSource: null,
      separatedAt: now,
    };
    body.radius = bodyRadius(body.mass);
    this.bodies.set(id, body);
    const owned = this.owned.get(player.id) ?? new Set<string>();
    owned.add(id);
    this.owned.set(player.id, owned);
    return body;
  }

  removeBody(id: string, death = true): void {
    const body = this.bodies.get(id);
    if (!body) return;
    this.bodies.delete(id);
    this.owned.get(body.ownerId)?.delete(id);
    if (death && !this.owned.get(body.ownerId)?.size) {
      const player = this.players.get(body.ownerId)!;
      player.alive = false;
      player.score = 0;
      player.totalMass = 0;
      player.bodyCount = 0;
      player.sharkSurvivalAt.length = 0;
      this.maxMetric(player, 'runDurationMs', this.time - player.startedAt);
      this.options.onRunEnded?.(player.id, {
        runId: player.runId,
        totalMass: 0,
        peakMass: player.bestScore,
        absorbed: player.metrics.absorptions ?? 0,
      });
    }
  }

  addMass(body: SimBody, mass: number, decayRemainder = 0): number {
    return addBodyMass(this, body, mass, decayRemainder);
  }

  canGrow(body: SimBody): boolean {
    return (
      body.mass < ENDLESS.maxMass ||
      (this.owned.get(body.ownerId)?.size ?? ENDLESS.maxBodies) < ENDLESS.maxBodies
    );
  }

  emit(id: string, event: GameEvent['event'], amount: number): void {
    this.options.onEvent?.(id, { type: 'event', event, amount });
  }
  addMetric(player: SimulationPlayer, metric: Metric, amount: number): void {
    player.metrics[metric] = (player.metrics[metric] ?? 0) + amount;
    player.metricSequence++;
  }
  maxMetric(player: SimulationPlayer, metric: Metric, amount: number): void {
    if (amount > (player.metrics[metric] ?? 0)) {
      player.metrics[metric] = amount;
      player.metricSequence++;
    }
  }

  endProtection(player: SimulationPlayer): void {
    player.protectedUntil = 0;
    for (const body of this.ownedBodies(player.id)) body.protectedUntil = 0;
  }

  setInput(id: string, input: InputMessage, now: number): boolean {
    return applyInput(this.players.get(id), input, now, true);
  }
  action(id: string, message: ActionMessage, now: number) {
    const player = this.players.get(id);
    return player
      ? applyAction(this, player, message, now)
      : { accepted: false, reason: 'Join the pool first.' };
  }
  restartPractice(id: string, runId: string, now: number): boolean {
    return false;
  }

  refreshPlayer(player: SimulationPlayer, now: number): void {
    const bodies = this.ownedBodies(player.id);
    let mass = 0;
    let x = 0;
    let z = 0;
    let largest: SimBody | undefined;
    for (const body of bodies) {
      mass += body.mass;
      x += body.x * body.mass;
      z += body.z * body.mass;
      if (!largest || body.mass > largest.mass) largest = body;
    }
    player.score = mass;
    player.totalMass = mass;
    player.bodyCount = bodies.length;
    player.alive = bodies.length > 0;
    player.chain = Math.min(18, Math.max(0, Math.floor((mass - ENDLESS.startMass) / 10)));
    player.bestScore = Math.max(player.bestScore, mass);
    if (mass) {
      player.x = x / mass;
      player.z = z / mass;
      player.angle = largest!.angle;
    }
    this.maxMetric(player, 'bodyMass', largest?.mass ?? 0);
    this.maxMetric(player, 'totalMass', mass);
    this.maxMetric(player, 'bodyCount', bodies.length);
    if (player.lostHumanBody && player.alive) this.maxMetric(player, 'comebackMass', mass);
    if (now - player.startedAt <= 120000) this.maxMetric(player, 'fastMass', mass);
    if (player.alive) this.maxMetric(player, 'runDurationMs', now - player.startedAt);
  }

  step(deltaSeconds: number, now: number): void {
    this.time = now;
    this.tick++;
    const dt = Math.max(0, Math.min(deltaSeconds, 0.1));
    if (![...this.players.values()].some((player) => !player.bot)) {
      this.players.clear();
      this.bodies.clear();
      this.owned.clear();
      this.chunks.clear();
      this.pellets.clear();
      this.sharks.clear();
      this.sharkRespawns.clear();
      return;
    }
    this.ensureBots(now);
    this.maintainChunks(now);
    if (now - this.lastBotUpdate >= 400) this.updateBots(now);
    for (const player of this.players.values()) {
      if (now - player.lastInputAt > 400)
        player.input = { ...player.input, x: 0, z: 0, boost: false, target: undefined };
      const owned = this.ownedBodies(player.id);
      let distance = 0;
      for (const body of owned) {
        decayBody(body, dt);
        distance += this.moveBody(body, player, dt, now);
      }
      if (owned.length) this.addMetric(player, 'distance', distance / owned.length);
      observeTravel(this, player, owned.length ? distance / owned.length : 0, owned);
      if (player.alive) {
        const survived = player.sharkSurvivalAt.filter((at) => at <= now).length;
        if (survived) {
          this.addMetric(player, 'sharkSurvivals', survived);
          this.maxMetric(
            player,
            'burstRecoveryMass',
            owned.reduce((sum, body) => sum + body.mass, 0),
          );
        }
        player.sharkSurvivalAt = player.sharkSurvivalAt.filter((at) => at > now);
      }
    }
    this.bodyIndex.rebuild(this.bodies.values());
    this.collideOwned(now);
    this.bodyIndex.rebuild(this.bodies.values());
    for (const body of this.bodies.values()) this.collect(body, now);
    this.collideEnemies(now, dt);
    this.bodyIndex.rebuild(this.bodies.values());
    this.feedingIndex.rebuild([...this.bodies.values()].filter((body) => this.canGrow(body)));
    stepPellets(this, dt, now);
    stepSharks(this, dt, now);
    if (this.tick % WORLD.tickRate === 0) this.respawn(now);
    for (const player of this.players.values()) this.refreshPlayer(player, now);
  }

  collidePosition(next: Vec2, previous: Vec2, radius: number): Vec2 {
    const walls = this.nearChunks(previous, radius + 8).flatMap((chunk) => chunk.obstacles);
    const result = collideObstacles(next, previous, radius, walls);
    return { x: Math.max(-1e7, Math.min(1e7, result.x)), z: Math.max(-1e7, Math.min(1e7, result.z)) };
  }

  private moveBody(body: SimBody, player: SimulationPlayer, dt: number, now: number): number {
    body.previousX = body.x;
    body.previousZ = body.z;
    let x = player.input.x;
    let z = player.input.z;
    if (player.input.target || Math.hypot(x, z) > 0.01) {
      const target = player.input.target ?? { x: player.x + x * 64, z: player.z + z * 64 };
      x = target.x - body.x;
      z = target.z - body.z;
      const length = Math.max(1, Math.hypot(x, z));
      x /= length;
      z /= length;
    }
    const speed = bodySpeed(body.mass);
    const remaining = Math.max(
      0,
      Math.min(1, 1 - (now - body.launchStartedAt - dt * 500) / body.launchDurationMs),
    );
    body.vx = x * speed + body.launchX * remaining;
    body.vz = z * speed + body.launchZ * remaining;
    const next = this.collidePosition(
      { x: body.x + body.vx * dt, z: body.z + body.vz * dt },
      body,
      body.radius,
    );
    body.x = next.x;
    body.z = next.z;
    if (Math.hypot(body.vx, body.vz) > 0.01) body.angle = Math.atan2(body.vx, body.vz);
    return Math.min(Math.hypot(next.x - body.previousX, next.z - body.previousZ), speed * dt);
  }

  private collideOwned(now: number): void {
    for (const player of this.players.values()) {
      const bodies = this.ownedBodies(player.id);
      for (let first = 0; first < bodies.length; first++)
        for (let second = first + 1; second < bodies.length; second++) {
          const a = bodies[first]!;
          const b = bodies[second]!;
          if (!this.bodies.has(a.id) || !this.bodies.has(b.id)) continue;
          const distance = Math.hypot(a.x - b.x, a.z - b.z);
          const radius = a.radius + b.radius;
          if (distance > radius) continue;
          if (now >= a.mergeAt && now >= b.mergeAt && a.mass + b.mass <= ENDLESS.maxMass) {
            const mass = a.mass + b.mass;
            a.x = (a.x * a.mass + b.x * b.mass) / mass;
            a.z = (a.z * a.mass + b.z * b.mass) / mass;
            this.addMass(a, b.mass, b.decayRemainder);
            this.removeBody(b.id, false);
            this.addMetric(player, 'reunions', 1);
            this.emit(player.id, 'merge', 1);
          } else if (now >= a.separatedAt && now >= b.separatedAt) {
            const dx = distance > 0.001 ? (a.x - b.x) / distance : 1;
            const dz = distance > 0.001 ? (a.z - b.z) / distance : 0;
            const push = Math.min(1.5, (radius - distance) / 2);
            const nextA = this.collidePosition({ x: a.x + dx * push, z: a.z + dz * push }, a, a.radius);
            const nextB = this.collidePosition({ x: b.x - dx * push, z: b.z - dz * push }, b, b.radius);
            a.x = nextA.x;
            a.z = nextA.z;
            b.x = nextB.x;
            b.z = nextB.z;
          }
        }
    }
  }

  private collect(body: SimBody, now: number): void {
    if (!this.canGrow(body)) return;
    let count = 0;
    const radius = body.radius + 0.5;
    const player = this.players.get(body.ownerId)!;
    for (const chunk of this.nearChunks(body, radius + 6)) {
      for (const [id, duck] of chunk.ducks) {
        if (!this.canGrow(body)) break;
        if (Math.hypot(body.x - duck.x, body.z - duck.z) > body.radius + 0.5) continue;
        chunk.ducks.delete(id);
        chunk.respawns.set(id, now + 45000);
        this.addMass(body, ENDLESS.foodMass);
        count++;
        observeFeedingChunk(this, player, chunk.key);
      }
    }
    if (!count) return;
    player.totalCollected += count;
    this.addMetric(player, 'naturalDucks', count);
    this.addMetric(player, 'runDucks', count);
    player.collectedAt = player.collectedAt.filter((at) => now - at < 60000);
    for (let index = 0; index < count; index++) player.collectedAt.push(now);
    if (player.collectedAt.length > 4096) player.collectedAt.splice(0, player.collectedAt.length - 4096);
    this.maxMetric(player, 'quickDucks', player.collectedAt.length);
    this.emit(player.id, 'collect', count);
  }

  private collideEnemies(now: number, dt: number): void {
    let minimum = Infinity;
    let maximum = 0;
    for (const body of this.bodies.values()) {
      minimum = Math.min(minimum, body.mass);
      maximum = Math.max(maximum, body.mass);
    }
    if (maximum * 100 < minimum * 110) return;
    for (const a of this.bodies.values()) {
      const reach = a.radius + 16 + Math.hypot(a.x - a.previousX, a.z - a.previousZ);
      for (const b of this.bodyIndex.query(a.x, a.z, reach)) {
        if (a.id >= b.id || a.ownerId === b.ownerId || !this.bodies.has(a.id) || !this.bodies.has(b.id))
          continue;
        const larger = a.mass >= b.mass ? a : b;
        const smaller = larger === a ? b : a;
        const launched = larger.launchUntil > now - dt * 1000;
        if (larger.mass * 100 < smaller.mass * (launched ? 133 : 110)) continue;
        if (sweptDistance(larger, smaller) > larger.radius - smaller.radius / 3) continue;
        const winner = this.players.get(larger.ownerId)!;
        const loser = this.players.get(smaller.ownerId)!;
        this.endProtection(winner);
        if (smaller.protectedUntil > now) continue;
        const credited = this.addMass(larger, smaller.mass, smaller.decayRemainder);
        const finalBody = this.owned.get(loser.id)?.size === 1;
        this.removeBody(smaller.id);
        if (!winner.bot && !loser.bot && winner.identityId !== loser.identityId) {
          loser.lostHumanBody = true;
          this.addMetric(winner, 'humanMassAbsorbed', credited);
          this.addMetric(winner, 'absorptions', 1);
          if (finalBody) {
            this.addMetric(winner, 'eliminations', 1);
            this.addMetric(winner, 'runEliminations', 1);
          }
          if (launched && larger.launchSource === 'manual') this.addMetric(winner, 'splitAbsorptions', 1);
        }
        this.emit(winner.id, 'steal', Math.max(1, credited));
        this.emit(loser.id, 'lost', smaller.mass);
      }
    }
  }

  private nearChunks(position: Vec2, radius: number): Chunk[] {
    const result: Chunk[] = [];
    for (
      let x = Math.floor((position.x - radius) / WORLD.chunkSize);
      x <= Math.floor((position.x + radius) / WORLD.chunkSize);
      x++
    ) {
      for (
        let z = Math.floor((position.z - radius) / WORLD.chunkSize);
        z <= Math.floor((position.z + radius) / WORLD.chunkSize);
        z++
      ) {
        const chunk = this.chunks.get(`${x}:${z}`);
        if (chunk) result.push(chunk);
      }
    }
    return result;
  }

  private maintainChunks(now: number, force = false): void {
    const pinned = new Set<string>();
    for (const body of this.bodies.values()) {
      const radius = body.radius + ENDLESS.pinMargin;
      for (
        let x = Math.floor((body.x - radius) / WORLD.chunkSize);
        x <= Math.floor((body.x + radius) / WORLD.chunkSize);
        x++
      )
        for (
          let z = Math.floor((body.z - radius) / WORLD.chunkSize);
          z <= Math.floor((body.z + radius) / WORLD.chunkSize);
          z++
        )
          pinned.add(`${x}:${z}`);
    }
    for (const key of pinned) {
      const chunk = this.chunks.get(key);
      if (chunk) chunk.lastSeen = now;
      else this.loadChunk(key, now, pinned);
    }
    if (!force && now - this.lastChunkUpdate < 1000) return;
    this.lastChunkUpdate = now;
    const desired = new Map<string, number>();
    for (const body of this.bodies.values()) {
      const center = chunkCoordinates(body);
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          const key = `${center.x + dx}:${center.z + dz}`;
          desired.set(key, Math.min(desired.get(key) ?? Infinity, dx * dx + dz * dz));
        }
    }
    for (const [key] of [...desired].sort((a, b) => a[1] - b[1])) {
      const existing = this.chunks.get(key);
      if (existing) existing.lastSeen = now;
      else if (this.chunks.size < this.maxChunks) this.loadChunk(key, now, pinned);
    }
    for (const [key, chunk] of this.chunks)
      if (!pinned.has(key) && now - chunk.lastSeen > 15000) this.chunks.delete(key);
    for (const [id, shark] of this.sharks)
      if (!this.chunks.has(`${Math.floor(shark.x / 64)}:${Math.floor(shark.z / 64)}`)) this.sharks.delete(id);
    for (const [id, respawn] of this.sharkRespawns)
      if (!this.chunks.has(`${Math.floor(respawn.x / 64)}:${Math.floor(respawn.z / 64)}`))
        this.sharkRespawns.delete(id);
  }

  private loadChunk(key: string, now: number, pinned: ReadonlySet<string>): void {
    if (this.chunks.size >= this.maxChunks) {
      let oldest: Chunk | undefined;
      for (const chunk of this.chunks.values())
        if (!pinned.has(chunk.key) && (!oldest || chunk.lastSeen < oldest.lastSeen)) oldest = chunk;
      if (!oldest) return;
      this.chunks.delete(oldest.key);
    }
    const [x, z] = key.split(':').map(Number) as [number, number];
    const generated = createChunkObjects(x, z, this.seed);
    this.chunks.set(key, {
      key,
      x,
      z,
      ducks: new Map(generated.ducks.map((duck) => [duck.id, duck])),
      obstacles: generated.obstacles,
      respawns: new Map(),
      lastSeen: now,
    });
    if (
      (Math.abs(x) + Math.abs(z)) % 3 === 1 &&
      this.sharks.size < ENDLESS.maxSharks &&
      !this.sharkRespawns.has(`spawn:${key}`)
    )
      this.spawnShark(x * 64 + 12, z * 64 + 12, now, `spawn:${key}`);
  }

  spawnShark(x: number, z: number, now: number, spawnId: string): SimShark | undefined {
    if (this.sharks.size >= ENDLESS.maxSharks) return undefined;
    const id = this.nextId('shark');
    const shark: SimShark = {
      id,
      x,
      z,
      vx: 0,
      vz: 0,
      mass: ENDLESS.sharkMass,
      radius: bodyRadius(ENDLESS.sharkMass),
      feedCount: 0,
      launchUntil: 0,
      directionX: 0,
      directionZ: 0,
      launchStartedAt: now,
      spawnId,
      originX: x,
      originZ: z,
    };
    this.sharks.set(id, shark);
    return shark;
  }

  private respawn(now: number): void {
    for (const chunk of this.chunks.values()) {
      const ready = [...chunk.respawns].filter(([, at]) => at <= now);
      if (!ready.length) continue;
      const generated = new Map(
        createChunkObjects(chunk.x, chunk.z, this.seed).ducks.map((duck) => [duck.id, duck]),
      );
      for (const [id] of ready) {
        const duck = generated.get(id);
        if (duck) chunk.ducks.set(id, duck);
        chunk.respawns.delete(id);
      }
    }
    for (const [id, item] of this.sharkRespawns)
      if (item.at <= now && this.spawnShark(item.x, item.z, now, id)) this.sharkRespawns.delete(id);
  }

  private spawnPosition(id: string): Vec2 {
    const first = [...this.players.values()].find((player) => !player.bot && player.alive);
    if (!first) return { x: 0, z: 0 };
    let hash = 0;
    for (const character of id) hash = Math.imul(hash, 31) + character.charCodeAt(0);
    const random = seededRandom(hash);
    const angle = random() * Math.PI * 2;
    return { x: first.x + Math.cos(angle) * 12, z: first.z + Math.sin(angle) * 12 };
  }

  private ensureBots(now: number): void {
    for (let index = 0; index < this.botCount; index++) {
      const id = `bot:${index}`;
      const existing = this.players.get(id);
      if (existing?.alive) continue;
      if (existing) this.removePlayer(id);
      this.addPlayer(
        id,
        botNames[index]!,
        (['yellow', 'pink', 'mint'] as const)[index % 3]!,
        now,
        undefined,
        true,
      );
    }
  }

  private updateBots(now: number): void {
    this.lastBotUpdate = now;
    for (const player of this.players.values()) {
      if (!player.bot || !player.alive) continue;
      let target: Vec2 | undefined;
      let distance = Infinity;
      for (const chunk of this.nearChunks(player, 64))
        for (const duck of chunk.ducks.values()) {
          const d = Math.hypot(duck.x - player.x, duck.z - player.z);
          if (d < distance) {
            distance = d;
            target = duck;
          }
        }
      if (!target) target = { x: player.x + Math.sin(now / 7000), z: player.z + Math.cos(now / 7000) };
      const dx = target.x - player.x;
      const dz = target.z - player.z;
      const length = Math.max(1, Math.hypot(dx, dz));
      this.setInput(
        player.id,
        {
          type: 'input',
          seq: player.lastInputSeq + 1,
          controlEpoch: player.controlEpoch,
          x: dx / length,
          z: dz / length,
          target,
          boost: false,
        },
        now,
      );
      if (player.score > 400 && this.ownedBodies(player.id).length < 4 && now % 7000 < 500)
        this.action(
          player.id,
          {
            type: 'action',
            action: 'split',
            seq: player.lastActionSeq + 1,
            commandId: `bot:${now}`,
            controlEpoch: player.controlEpoch,
            x: dx / length,
            z: dz / length,
          },
          now,
        );
    }
  }

  snapshot(id: string): WorldSnapshot {
    return this.prepareSnapshots()(id);
  }

  prepareSnapshots(): SnapshotReader {
    return createSnapshotFrame(this);
  }
}
