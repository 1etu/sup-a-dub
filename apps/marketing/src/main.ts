import './styles.css';
import { element } from './dom';
import { WaterSurface } from './water';
import { PageSound } from './sound';
import { mountToys } from './toys';
import { mountGallery } from './gallery';

const sound = new PageSound();
const water = new WaterSurface(element<HTMLCanvasElement>('#water'));
mountToys(() => sound.play('select'));
mountGallery(() => sound.play('bubble'));

document.querySelectorAll<HTMLAnchorElement>('[data-play]').forEach((link) => {
  link.href = import.meta.env.VITE_GAME_URL || (import.meta.env.DEV ? 'http://localhost:5173' : '/');
});

document.querySelectorAll<HTMLElement>('.bubble-field').forEach((field, fieldIndex) => {
  for (let index = 0; index < (fieldIndex ? 5 : 10); index++) {
    const bubble = document.createElement('span');
    bubble.className = 'decor-bubble';
    const size = 25 + ((index * 43) % 89);
    bubble.style.cssText = `width:${size}px;height:${size}px;left:${(index * 31 + 3) % 95}%;top:${(index * 29 + 8) % 85}%;animation-delay:${-index * 1.7}s;opacity:${0.22 + (index % 3) * 0.09}`;
    field.append(bubble);
  }
});

document.querySelectorAll<HTMLElement>('[data-quack]').forEach((duck) => {
  duck.addEventListener('click', () => {
    duck.classList.remove('squeezing');
    void duck.offsetWidth;
    duck.classList.add('squeezing');
    sound.play('quack');
  });
  duck.addEventListener('animationend', () => duck.classList.remove('squeezing'));
});
document.querySelectorAll<HTMLElement>('a, .film-start').forEach((link) => {
  link.addEventListener('click', () => sound.play('confirm'));
});

const film = element<HTMLVideoElement>('#game-film');
const filmStart = element<HTMLButtonElement>('.film-start');
const filmScreen = element('.film-screen');
filmStart.hidden = false;
film.controls = false;
filmStart.addEventListener('click', () => {
  void film.play().catch(() => {
    filmStart.hidden = true;
    film.controls = true;
  });
});
film.addEventListener('play', () => {
  filmStart.hidden = true;
  film.controls = true;
  filmScreen.classList.add('is-playing');
  sound.film(true);
});
film.addEventListener('pause', () => sound.film(false));
film.addEventListener('ended', () => {
  filmStart.hidden = false;
  film.controls = false;
  filmScreen.classList.remove('is-playing');
  sound.film(false);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) film.pause();
});
window.addEventListener('pagehide', (event) => {
  film.pause();
  if (event.persisted) return;
  sound.dispose();
  water.dispose();
});
