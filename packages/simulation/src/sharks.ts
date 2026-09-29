import { ENDLESS, bodyRadius } from '@supadub/protocol';
import { sweptDistance } from './common';
import type { EndlessWorld } from './endless';
import type { SimShark } from './types';

export function stepPellets(world: EndlessWorld, dt: number, now: number): void {
  world.sharkIndex.rebuild(world.sharks.values());
  for (const [id, pellet] of world.pellets) {
    if (now >= pellet.expiresAt) {
      world.pellets.delete(id);
      continue;
    }
    const remaining = Math.max(0, 1 - (now - pellet.createdAt - dt * 500) / ENDLESS.pelletLaunchMs);
    const previous = { x: pellet.x, z: pellet.z, previousX: pellet.x, previousZ: pellet.z };
    pellet.vx = pellet.directionX * ENDLESS.pelletSpeed * Math.min(1, remaining);
    pellet.vz = pellet.directionZ * ENDLESS.pelletSpeed * Math.min(1, remaining);
    pellet.x += pellet.vx * dt;
    pellet.z += pellet.vz * dt;
    const sweep = { x: pellet.x, z: pellet.z, previousX: previous.x, previousZ: previous.z };
    let fed = false;
    for (const shark of world.sharkIndex.query(
      pellet.x,
      pellet.z,
      Math.hypot(pellet.x - previous.x, pellet.z - previous.z) + 1,
    )) {
      if (sweptDistance(sweep, shark) > shark.radius + bodyRadius(pellet.mass)) continue;
      world.pellets.delete(id);
      const source = world.players.get(pellet.ownerId);
      if (source && !source.bot) {
        world.addMetric(source, 'pelletsFed', 1);
        if (
          pellet.originX !== undefined &&
          pellet.originZ !== undefined &&
          Math.hypot(pellet.x - pellet.originX, pellet.z - pellet.originZ) >= 6
        )
          world.addMetric(source, 'distantFeeds', 1);
        world.emit(source.id, 'shark-feed', 1);
      }
      shark.feedCount++;
      if (shark.feedCount === ENDLESS.sharkFeedCount) {
        shark.feedCount = 0;
        const launched =
          world.sharks.size < ENDLESS.maxSharks
            ? world.spawnShark(shark.x + pellet.directionX * 2.2, shark.z + pellet.directionZ * 2.2, now, '')
            : shark;
        if (launched) {
          launched.directionX = pellet.directionX;
          launched.directionZ = pellet.directionZ;
          launched.launchStartedAt = now;
          launched.launchUntil = now + ENDLESS.sharkLaunchMs;
          world.sharkIndex.rebuild(world.sharks.values());
        }
        if (source && !source.bot) {
          world.addMetric(source, 'sharkLaunches', 1);
          world.emit(source.id, 'shark-launch', 1);
        }
      }
      fed = true;
      break;
    }
    if (fed) continue;
    for (const body of world.feedingIndex.query(
      pellet.x,
      pellet.z,
      Math.hypot(pellet.x - previous.x, pellet.z - previous.z) + 1,
    )) {
      if (
        !world.bodies.has(body.id) ||
        !world.canGrow(body) ||
        (body.ownerId === pellet.ownerId && now - pellet.createdAt < ENDLESS.pelletRecaptureMs)
      )
        continue;
      if (sweptDistance(sweep, body) > body.radius) continue;
      world.pellets.delete(id);
      const recipient = world.players.get(body.ownerId)!;
      const source = world.players.get(pellet.ownerId);
      const credited = world.addMass(body, pellet.mass);
      if (
        source &&
        !source.bot &&
        !recipient.bot &&
        source.identityId !== recipient.identityId &&
        !pellet.sourceBot &&
        credited > 0
      )
        world.addMetric(source, 'donatedMass', credited);
      break;
    }
  }
}

export function stepSharks(world: EndlessWorld, dt: number, now: number): void {
  for (const shark of [...world.sharks.values()]) {
    const previousX = shark.x;
    const previousZ = shark.z;
    const remaining = Math.max(
      0,
      Math.min(1, 1 - (now - shark.launchStartedAt - dt * 500) / ENDLESS.sharkLaunchMs),
    );
    shark.vx = shark.directionX * ENDLESS.sharkLaunchSpeed * remaining;
    shark.vz = shark.directionZ * ENDLESS.sharkLaunchSpeed * remaining;
    const next = world.collidePosition(
      { x: shark.x + shark.vx * dt, z: shark.z + shark.vz * dt },
      shark,
      shark.radius,
    );
    shark.x = next.x;
    shark.z = next.z;
    for (const body of world.bodyIndex.query(shark.x, shark.z, 20)) {
      if (!world.bodies.has(body.id) || body.mass < ENDLESS.sharkContactMass) continue;
      if (sweptDistance(body, { ...shark, previousX, previousZ }) > body.radius - shark.radius / 3) continue;
      burst(world, shark, body.id, now);
      break;
    }
  }
}

function burst(world: EndlessWorld, shark: SimShark, bodyId: string, now: number): void {
  const body = world.bodies.get(bodyId)!;
  const player = world.players.get(body.ownerId)!;
  world.sharks.delete(shark.id);
  if (shark.spawnId)
    world.sharkRespawns.set(shark.spawnId, {
      x: shark.originX,
      z: shark.originZ,
      at: now + ENDLESS.sharkRespawnMs,
    });
  const slots = ENDLESS.maxBodies - world.ownedBodies(player.id).length + 1;
  const total = body.mass + ENDLESS.sharkMass;
  const count = Math.max(1, Math.min(slots, Math.floor(total / ENDLESS.startMass)));
  if (count === 1) {
    const credited = world.addMass(body, ENDLESS.sharkMass);
    world.addMetric(player, 'sharkHarvestMass', credited);
    world.emit(player.id, 'shark', 1);
    return;
  }
  world.addMetric(player, 'sharkHarvestMass', ENDLESS.sharkMass);
  world.removeBody(body.id, false);
  const baseMass = Math.floor(total / count);
  const remainder = total % count;
  for (let index = 0; index < count; index++) {
    const fragment = world.createBody(player, baseMass + (index < remainder ? 1 : 0), body, now);
    fragment.decayRemainder = body.decayRemainder * (fragment.mass / total);
    const angle = (index * Math.PI * 2) / count;
    fragment.launchX = Math.cos(angle) * 40;
    fragment.launchZ = Math.sin(angle) * 40;
    fragment.launchStartedAt = now;
    fragment.launchDurationMs = ENDLESS.launchMs;
    fragment.launchUntil = now + ENDLESS.launchMs;
    fragment.launchSource = 'shark';
    fragment.mergeAt = now + ENDLESS.mergeMs;
    fragment.separatedAt = now + 300;
  }
  world.endProtection(player);
  if (player.sharkSurvivalAt.length < 64) player.sharkSurvivalAt.push(now + 10000);
  world.emit(player.id, 'shark', count);
  world.refreshPlayer(player, now);
}
