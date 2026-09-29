import { art, element } from './dom';

const toys = [
  { name: 'GOLD', file: 'gold', alt: 'Glossy gold rubber duck', line: 'Top of the pecking order.' },
  {
    name: 'YELLOW',
    file: 'yellow',
    alt: 'Classic yellow rubber duck with an orange beak',
    line: 'The original bath buddy.',
  },
  { name: 'PINK', file: 'pink', alt: 'Bubblegum pink rubber duck', line: 'Sweet face. Big appetite.' },
  { name: 'MINT', file: 'mint', alt: 'Mint green rubber duck', line: 'Fresh out of the toy box.' },
  {
    name: 'CAPTAIN',
    file: 'captain',
    alt: 'Yellow rubber duck wearing a captain’s hat',
    line: 'All ducklings on deck!',
  },
  {
    name: 'SHARK',
    file: 'shark',
    alt: 'Blue toy shark with a wide toothy mouth',
    line: 'There goes the neighborhood.',
  },
] as const;

export function mountToys(selectSound: () => void): void {
  const root = element('.toy-selector');
  const image = element<HTMLImageElement>('#toy-image');
  const preview = element('.toy-preview');
  const name = element('#toy-name');
  const description = element('#toy-description');
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-toy]')];
  let selected = 0;
  let revision = 0;
  const select = async (index: number) => {
    selected = (index + toys.length) % toys.length;
    const current = ++revision;
    const toy = toys[selected];
    const next = new Image();
    next.src = art(`${toy.file}.webp`);
    try {
      await next.decode();
    } catch {
      return;
    }
    if (current !== revision) return;
    preview.classList.remove('is-changing');
    image.src = next.src;
    image.alt = toy.alt;
    name.textContent = toy.name;
    description.textContent = toy.line;
    buttons.forEach((button, position) => button.setAttribute('aria-pressed', String(position === selected)));
    void preview.offsetWidth;
    preview.classList.add('is-changing');
    selectSound();
  };
  preview.addEventListener('animationend', () => preview.classList.remove('is-changing'));
  element('.previous', root).addEventListener('click', () => {
    void select(selected - 1);
  });
  element('.next', root).addEventListener('click', () => {
    void select(selected + 1);
  });
  buttons.forEach((button, index) =>
    button.addEventListener('click', () => {
      void select(index);
    }),
  );
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    void select(selected + (event.key === 'ArrowLeft' ? -1 : 1));
  });
}
