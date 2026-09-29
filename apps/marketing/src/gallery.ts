import { art, element } from './dom';

const photos = [
  {
    file: 'rescue',
    title: 'EVERYBODY, FOLLOW ME!',
    alt: 'Gold duck rescuing a trail of ducklings in Tub 01',
  },
  {
    file: 'endless',
    title: 'PLENTY OF ROOM. FOR NOW.',
    alt: 'The pink heart pool with other players and the live leaderboard',
  },
  {
    file: 'toys',
    title: 'ONE FOR EVERY MOOD.',
    alt: 'A collection of colorful duck, shark, and other bath toy skins',
  },
] as const;

export function mountGallery(selectSound: () => void): void {
  const dialog = element<HTMLDialogElement>('#photo-viewer');
  const image = element<HTMLImageElement>('#full-photo');
  const title = element('#photo-title');
  let selected = 0;
  let opener: HTMLElement | undefined;
  const select = (index: number) => {
    selected = (index + photos.length) % photos.length;
    const photo = photos[selected];
    image.src = art(`${photo.file}.webp`);
    image.alt = photo.alt;
    title.textContent = photo.title;
    selectSound();
  };
  document.querySelectorAll<HTMLElement>('[data-photo]').forEach((button, index) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      opener = button;
      select(index);
      dialog.showModal();
      document.body.classList.add('dialog-open');
    });
  });
  element('.close-viewer', dialog).addEventListener('click', () => dialog.close());
  element('[data-photo-previous]', dialog).addEventListener('click', () => select(selected - 1));
  element('[data-photo-next]', dialog).addEventListener('click', () => select(selected + 1));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    opener?.focus({ preventScroll: true });
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    select(selected + (event.key === 'ArrowLeft' ? -1 : 1));
  });
}
