import { ENDLESS, bodyRadius } from '@supadub/protocol';
import type { EndlessWorld } from './endless';
import type { SimBody } from './types';

export function decayBody(body: SimBody, deltaSeconds: number): void {
  if (deltaSeconds <= 0 || body.mass <= ENDLESS.decayFloorMass) return;
  const excess = Math.max(0, body.mass - body.decayRemainder - ENDLESS.decayFloorMass);
  const loss = excess * -Math.expm1(-ENDLESS.decayRatePerSecond * deltaSeconds);
  const pending = body.decayRemainder + loss;
  const whole = Math.min(body.mass - ENDLESS.decayFloorMass, Math.floor(pending));
  body.decayRemainder = pending - whole;
  if (!whole) return;
  body.mass -= whole;
  body.radius = bodyRadius(body.mass);
}

export function addBodyMass(
  world: EndlessWorld,
  body: SimBody,
  amount: number,
  incomingRemainder = 0,
): number {
  if (!Number.isSafeInteger(amount) || !Number.isFinite(incomingRemainder) || incomingRemainder < 0) return 0;
  const player = world.players.get(body.ownerId);
  if (!player || world.bodies.get(body.id) !== body) return 0;
  const previous = body.mass;
  const combinedRemainder = body.decayRemainder + incomingRemainder;
  const wholeLoss = Math.floor(combinedRemainder);
  const total = Math.max(1, previous + amount - wholeLoss);
  const slots = ENDLESS.maxBodies - world.ownedBodies(player.id).length;
  const count = Math.min(slots + 1, Math.ceil(total / ENDLESS.maxMass));
  const accepted = Math.min(total, count * ENDLESS.maxMass);
  const pending = combinedRemainder - wholeLoss;
  const base = Math.floor(accepted / count);
  const remainder = accepted % count;
  const pieces = [body];
  for (let index = 1; index < count; index++) {
    const child = world.createBody(player, base + Number(index < remainder), body, world.time);
    const angle = body.angle + ((index - 1) * Math.PI * 2) / (count - 1);
    child.launchX = Math.sin(angle) * ENDLESS.overflowLaunchSpeed;
    child.launchZ = Math.cos(angle) * ENDLESS.overflowLaunchSpeed;
    child.launchStartedAt = world.time;
    child.launchDurationMs = ENDLESS.overflowLaunchMs;
    child.launchUntil = world.time + ENDLESS.overflowLaunchMs;
    child.launchSource = 'overflow';
    child.protectedUntil = body.protectedUntil;
    pieces.push(child);
  }
  for (const [index, piece] of pieces.entries()) {
    piece.mass = base + Number(index < remainder);
    piece.radius = bodyRadius(piece.mass);
    piece.decayRemainder = pending * (piece.mass / accepted);
    if (count > 1) {
      piece.mergeAt = Math.max(piece.mergeAt, world.time + ENDLESS.mergeMs);
      piece.separatedAt = world.time + 300;
    }
  }
  if (count > 1) world.emit(player.id, 'split', count - 1);
  return accepted - previous;
}
