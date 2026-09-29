import { ENDLESS, bodyRadius, type ActionMessage } from '@supadub/protocol';
import type { EndlessWorld } from './endless';
import type { ActionResult, SimulationPlayer } from './types';

export function applyAction(
  world: EndlessWorld,
  player: SimulationPlayer,
  message: ActionMessage,
  now: number,
): ActionResult {
  if (message.controlEpoch !== player.controlEpoch)
    return { accepted: false, reason: 'This controller is no longer active.' };
  const cached = player.actionResults.get(message.commandId);
  if (cached) return cached;
  if (message.seq <= player.lastActionSeq) return { accepted: false, reason: 'This action is stale.' };
  player.lastActionSeq = message.seq;
  let result: ActionResult;
  if (!player.alive) result = { accepted: false, reason: 'This run has ended.' };
  else if (message.action === 'split') result = split(world, player, message.x, message.z, now);
  else result = eject(world, player, message.x, message.z, now);
  player.actionResults.set(message.commandId, result);
  while (player.actionResults.size > 128)
    player.actionResults.delete(player.actionResults.keys().next().value!);
  return result;
}

function split(
  world: EndlessWorld,
  player: SimulationPlayer,
  x: number,
  z: number,
  now: number,
): ActionResult {
  if (now < player.splitReadyAt) return { accepted: false, reason: 'Wait before another split.' };
  const original = world.ownedBodies(player.id).sort((a, b) => b.mass - a.mass || a.id.localeCompare(b.id));
  let available = ENDLESS.maxBodies - original.length;
  let count = 0;
  for (const body of original) {
    if (!available || body.mass < ENDLESS.splitMinimum) continue;
    const parentMass = body.mass;
    const pendingDecay = body.decayRemainder;
    const childMass = Math.floor(body.mass / 2);
    body.mass -= childMass;
    body.radius = bodyRadius(body.mass);
    body.mergeAt = now + ENDLESS.mergeMs;
    body.separatedAt = now + 300;
    const child = world.createBody(player, childMass, body, now);
    child.decayRemainder = pendingDecay * (childMass / parentMass);
    body.decayRemainder = pendingDecay - child.decayRemainder;
    child.launchX = x * ENDLESS.launchSpeed;
    child.launchZ = z * ENDLESS.launchSpeed;
    child.launchStartedAt = now;
    child.launchDurationMs = ENDLESS.launchMs;
    child.launchUntil = now + ENDLESS.launchMs;
    child.launchSource = 'manual';
    child.mergeAt = now + ENDLESS.mergeMs;
    child.separatedAt = now + 300;
    count++;
    available--;
  }
  if (!count)
    return {
      accepted: false,
      reason:
        original.length >= ENDLESS.maxBodies
          ? 'Your flock has sixteen bodies.'
          : 'A split needs at least eighty mass.',
    };
  player.splitReadyAt = now + ENDLESS.splitCooldownMs;
  world.endProtection(player);
  world.addMetric(player, 'splitActions', 1);
  world.emit(player.id, 'split', count);
  world.refreshPlayer(player, now);
  return { accepted: true };
}

function eject(
  world: EndlessWorld,
  player: SimulationPlayer,
  x: number,
  z: number,
  now: number,
): ActionResult {
  if (now < player.ejectReadyAt) return { accepted: false, reason: 'Wait before another ejection.' };
  const ownCount = [...world.pellets.values()].filter((pellet) => pellet.ownerId === player.id).length;
  let available = Math.min(ENDLESS.maxPellets - world.pellets.size, ENDLESS.pelletsPerOwner - ownCount);
  let count = 0;
  for (const body of world
    .ownedBodies(player.id)
    .sort((a, b) => b.mass - a.mass || a.id.localeCompare(b.id))) {
    if (available <= 0) break;
    if (body.mass - ENDLESS.ejectCost < ENDLESS.startMass) continue;
    body.mass -= ENDLESS.ejectCost;
    body.radius = bodyRadius(body.mass);
    const distance = body.radius + bodyRadius(ENDLESS.pelletMass) + 0.15;
    const id = world.nextId('pellet');
    world.pellets.set(id, {
      id,
      ownerId: player.id,
      x: body.x + x * distance,
      z: body.z + z * distance,
      originX: body.x + x * distance,
      originZ: body.z + z * distance,
      vx: x * ENDLESS.pelletSpeed,
      vz: z * ENDLESS.pelletSpeed,
      mass: ENDLESS.pelletMass,
      directionX: x,
      directionZ: z,
      createdAt: now,
      expiresAt: now + ENDLESS.pelletLifeMs,
      sourceIdentity: player.identityId,
      sourceBot: player.bot,
    });
    available--;
    count++;
  }
  if (!count)
    return {
      accepted: false,
      reason: available <= 0 ? 'The pellet limit is full.' : 'Ejection must leave forty mass.',
    };
  player.ejectReadyAt = now + ENDLESS.ejectCooldownMs;
  world.endProtection(player);
  world.emit(player.id, 'eject', count);
  world.maxMetric(player, 'simultaneousEjections', count);
  world.refreshPlayer(player, now);
  return { accepted: true };
}
