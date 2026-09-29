import type { AvatarFamily, CosmeticDefinition, Skin } from './types';

function avatar(
  id: Skin,
  name: string,
  color: string,
  accentColor: string,
  modelFamily: AvatarFamily = 'duck',
  metalness = 0.02,
  roughness = 0.28,
): CosmeticDefinition {
  return Object.freeze({
    id,
    name,
    kind: 'avatar',
    modelFamily,
    color,
    accentColor,
    beakColor: '#f28b08',
    starter: false,
    category: null,
    description: 'Earn this toy through an achievement.',
    metalness,
    roughness,
    pattern: modelFamily === 'duck' ? (id as CosmeticDefinition['pattern']) : 'solid',
  });
}

export const EXPANSION_AVATARS: readonly CosmeticDefinition[] = Object.freeze([
  avatar('lifeguard', 'Lifeguard', '#f6dc43', '#e64a3c'),
  avatar('explorer', 'Explorer', '#dcae63', '#61774b'),
  avatar('mosaic', 'Mosaic', '#f4eac8', '#2f8caa'),
  avatar('lemon-sorbet', 'Lemon Sorbet', '#fbef88', '#a8d969'),
  avatar('speckled-egg', 'Speckled Egg', '#d7ebdf', '#788d98'),
  avatar('peach-jelly', 'Peach Jelly', '#ffa48c', '#ffd5a7', 'duck', 0, 0.17),
  avatar('tin-toy', 'Tin Toy', '#91b2c6', '#e46246', 'duck', 0.75, 0.24),
  avatar('clockwork', 'Clockwork', '#b79453', '#5d4930', 'duck', 0.7, 0.27),
  avatar('deep-sea', 'Deep Sea', '#24466b', '#6ae1d4'),
  avatar('fiesta', 'Fiesta', '#f4c947', '#ed638f'),
  avatar('aurora', 'Aurora', '#687acc', '#82e2c3', 'duck', 0.15, 0.23),
  avatar('patchwork', 'Patchwork', '#e3c696', '#e78083'),
  avatar('shark-blue', 'Blue Shark', '#7da9c9', '#e3eef3', 'shark'),
  avatar('shark-coral', 'Coral Shark', '#e38a88', '#ffe3ca', 'shark'),
  avatar('axolotl-rose', 'Rose Axolotl', '#f3b1c6', '#c95788', 'axolotl'),
  avatar('axolotl-lime', 'Lime Axolotl', '#c5e88b', '#6faf85', 'axolotl'),
  avatar('turtle-jade', 'Jade Turtle', '#7abc91', '#397663', 'turtle'),
  avatar('turtle-sand', 'Sand Turtle', '#dfc799', '#97784b', 'turtle'),
  avatar('frog-pond', 'Pond Frog', '#8ec57e', '#e6edb3', 'frog'),
  avatar('frog-sunset', 'Sunset Frog', '#edaf66', '#d87870', 'frog'),
  avatar('whale-blue', 'Blue Whale', '#749bc9', '#dae8ee', 'whale'),
  avatar('whale-lilac', 'Lilac Whale', '#ada0d8', '#eddef2', 'whale'),
  avatar('octopus-plum', 'Plum Octopus', '#ac7eb9', '#e8b6d5', 'octopus'),
  avatar('octopus-coral', 'Coral Octopus', '#ef9986', '#ffd4ab', 'octopus'),
]);
