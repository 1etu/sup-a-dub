import type { AvatarLoadout } from './visuals';

export function avatarKey(skin: string, loadout?: AvatarLoadout): string {
  return `${skin}:${loadout?.head ?? ''}:${loadout?.face ?? ''}:${loadout?.neck ?? ''}`;
}

export function previewLoadout(element: HTMLElement): AvatarLoadout {
  return {
    head: element.dataset.head || null,
    face: element.dataset.face || null,
    neck: element.dataset.neck || null,
  };
}
