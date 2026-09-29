import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve(import.meta.dir, '../packages/assets/icons');
const duck =
  '<path d="M33 73C27 86 35 99 56 99H78C96 98 107 86 106 69L96 78C91 78 84 75 81 72C88 61 86 47 75 41C65 35 50 38 46 49C41 62 46 72 56 77C47 79 40 78 33 73Z"/><path d="M49 61L33 64L47 69Z"/><circle cx="57" cy="53" r="3" fill="var(--shade)"/>';
const smallDuck = `<g transform="translate(19 20) scale(.72)">${duck}</g>`;
const clock =
  '<circle cx="64" cy="68" r="29" fill="none" stroke="currentColor" stroke-width="8"/><path d="M64 49V69L78 76M57 29H71M64 29V38" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>';
const star = '<path d="M64 31L73 53L98 55L79 71L85 95L64 82L43 95L49 71L30 55L55 53Z"/>';
const crown =
  '<path d="M30 48L48 60L64 34L80 60L98 48L91 88H37Z"/><rect x="36" y="91" width="56" height="7" rx="3"/>';
const arrow = '<path d="M58 92V58H43L64 34L85 58H70V92Z"/>';
const ring = '<ellipse cx="64" cy="82" rx="35" ry="14" fill="none" stroke="currentColor" stroke-width="8"/>';
const shark =
  '<path d="M27 72L43 54L62 50L78 34L82 51L101 59L91 71L105 88L83 80C62 96 37 92 27 72Z"/><path d="M34 73L44 65L50 77L58 66L65 78L74 66L82 77L89 68" fill="none" stroke="var(--shade)" stroke-width="4"/><circle cx="48" cy="59" r="3" fill="var(--shade)"/>';
const shield =
  '<path d="M64 29L94 41V67C94 85 77 98 64 103C51 98 34 85 34 67V41Z"/><path d="M48 65L59 77L81 52" fill="none" stroke="var(--shade)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>';
const wave =
  '<path d="M27 80Q40 68 52 80T77 80T102 80M27 93Q40 81 52 93T77 93T102 93" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>';
const lightning = '<path d="M72 27L39 69H59L50 104L89 58H68Z"/>';
const heart = '<path d="M64 96C42 80 27 65 32 48C37 32 57 34 64 46C71 34 91 32 96 48C101 65 86 80 64 96Z"/>';
const masteryWreath =
  '<path d="M39 100C16 84 18 53 35 36M89 100C112 84 110 53 93 36" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M28 80L18 72L28 69M27 63L19 52L31 55M32 47L29 34L40 39M100 80L110 72L100 69M101 63L109 52L97 55M96 47L99 34L88 39" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>';
const mastery = (glyph: string) =>
  `${masteryWreath}<g transform="translate(15 11) scale(.77)">${glyph}</g><path d="M52 25L64 18L76 25L72 31H56Z"/>`;
const compass =
  '<circle cx="64" cy="65" r="30" fill="none" stroke="currentColor" stroke-width="5"/><path d="M79 44L70 73L48 86L57 57Z"/><path d="M64 28V36M64 94V102M27 65H35M93 65H101" stroke="currentColor" stroke-width="4"/>';
const map =
  '<path d="M28 43L52 33L78 42L101 31V88L78 100L52 91L28 101Z"/><path d="M52 34V90M78 44V98M36 76L48 66L64 76L86 56" stroke="var(--shade)" stroke-width="4" fill="none" stroke-linejoin="round"/>';
const parcel =
  '<path d="M34 48L64 33L95 48V86L64 103L34 86Z"/><path d="M35 49L64 64L94 49M64 64V101M49 41L80 57V74" stroke="var(--shade)" stroke-width="4" fill="none"/>';
const flock = `${pieces(5, 28, 9)}<g transform="translate(33 28) scale(.48)">${duck}</g>`;
const wardrobe =
  '<path d="M48 38L64 46L80 38L101 60L85 74L82 98H46L43 74L27 60Z"/><path d="M52 39Q64 64 76 39M64 64V97" stroke="var(--shade)" stroke-width="4" fill="none"/>';
function pieces(count: number, radius: number, size: number): string {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    return `<circle cx="${64 + Math.cos(angle) * radius}" cy="${66 + Math.sin(angle) * radius}" r="${size}"/>`;
  }).join('');
}
const glyphs: Record<string, string> = {
  'natural-ducks': duck,
  'run-collector': `<g transform="translate(-11 6) scale(.77)">${duck}</g><g transform="translate(40 28) scale(.56)">${duck}</g>`,
  'quick-collector': `<g transform="translate(-7 0) scale(.8)">${duck}</g><g transform="translate(62 47) scale(.37)">${lightning}</g>`,
  'ducks-saved': `${ring}<g transform="translate(8 -1) scale(.86)">${duck}</g>`,
  'practice-finisher':
    '<path d="M42 99V31M47 34H96L85 49L96 64H47" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/><path d="M47 34H96L85 49L96 64H47Z"/>',
  'duck-chain': `${pieces(3, 28, 12)}<path d="M43 50L49 80H81L85 50" fill="none" stroke="currentColor" stroke-width="6"/>`,
  'speed-rescue': `${clock}<g transform="translate(66 44) scale(.39)">${duck}</g>`,
  'single-chain':
    '<path d="M51 47L68 34V94M48 94H88" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/><ellipse cx="43" cy="74" rx="9" ry="15" fill="none" stroke="currentColor" stroke-width="6"/>',
  'completion-streak': `${star}<path d="M30 84L43 101M97 36L104 49M23 48L31 41" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`,
  'body-mass': `${smallDuck}<path d="M31 90H97M31 83V96M97 83V96" fill="none" stroke="currentColor" stroke-width="6"/>`,
  'flock-mass': `${pieces(5, 26, 12)}<circle cx="64" cy="66" r="15"/>`,
  'fast-growth': `${arrow}<path d="M34 77L42 90M87 77L95 64" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  'body-absorber': `<g transform="translate(-12 -3) scale(.97)">${duck}</g><circle cx="95" cy="48" r="10"/><path d="M93 68L78 68L82 61M78 68L82 75" fill="none" stroke="currentColor" stroke-width="5"/>`,
  'pool-champion': crown,
  'split-absorber':
    '<path d="M42 36L61 59L51 65L70 88M86 36L67 59L77 65L58 88" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/><circle cx="64" cy="96" r="7"/>',
  'full-flock': Array.from(
    { length: 16 },
    (_, index) => `<circle cx="${38 + (index % 4) * 17}" cy="${40 + Math.floor(index / 4) * 17}" r="6"/>`,
  ).join(''),
  'split-master':
    '<path d="M64 98V66M64 66L39 42M64 66L89 42M39 42V61M39 42H58M89 42V61M89 42H70" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
  reunion:
    '<path d="M31 41L56 66M97 41L72 66M56 66H38M56 66V48M72 66H90M72 66V48" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><circle cx="64" cy="88" r="14"/>',
  'shark-feeder': `${shark}<circle cx="26" cy="45" r="7"/>`,
  'shark-launcher': `<g transform="translate(-2 1) scale(.86)">${shark}</g><path d="M75 88H102M83 100H102" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  'shark-survivor': `${shield}<path d="M51 45L62 35L70 47" fill="none" stroke="var(--shade)" stroke-width="4"/>`,
  'long-swim': `<g transform="translate(20 3) scale(.69)">${clock}</g>${wave}`,
  'distance-swimmer':
    '<path d="M31 88C52 91 38 69 60 71S75 50 93 43" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-dasharray="8 11"/><path d="M81 34H99V53" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
  'generous-duck': `${heart}<g transform="translate(30 30) scale(.52)">${duck}</g>`,
  'collection-mastery': mastery(duck),
  'rescue-mastery': mastery(`${ring}<g transform="translate(8 -1) scale(.86)">${duck}</g>`),
  'practice-mastery': mastery(clock),
  'growth-mastery': mastery(`${arrow}<circle cx="36" cy="89" r="9"/><circle cx="91" cy="79" r="14"/>`),
  'combat-mastery': mastery(crown),
  'control-mastery': mastery(`${pieces(5, 27, 9)}<circle cx="64" cy="66" r="13"/>`),
  'sharks-mastery': mastery(shark),
  'endurance-mastery': mastery(`${smallDuck}${wave}`),
  'charted-pool': map,
  'distant-shores': `${compass}<path d="M29 107Q42 96 55 107T81 107T107 107" fill="none" stroke="currentColor" stroke-width="4"/>`,
  'feeding-grounds': `${map}<circle cx="82" cy="51" r="12" fill="var(--shade)"/><circle cx="82" cy="51" r="7"/>`,
  'exploration-mastery': mastery(compass),
  'careful-deliveries': `${parcel}<g transform="translate(60 54) scale(.4)">${heart}</g>`,
  'prompt-deliveries': `<g transform="translate(-9 6) scale(.86)">${parcel}</g><g transform="translate(62 51) scale(.42)">${clock}</g>`,
  'efficient-rescue': `${ring}<path d="M44 62L59 76L85 44" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>`,
  'rescue-craft-mastery': mastery(parcel),
  'distant-feeding': `<g transform="translate(37 29) scale(.67)">${shark}</g><path d="M24 64H50" stroke="currentColor" stroke-width="5" stroke-dasharray="4 6"/><circle cx="23" cy="64" r="6"/>`,
  'burst-recovery': `<g transform="translate(29 23) scale(.55)">${shark}</g><path d="M36 50A33 33 0 1 0 90 48M36 50V32M36 50H54" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  'shark-harvest': `<g transform="translate(-3 -7) scale(.91)">${shark}</g><circle cx="42" cy="99" r="8"/><circle cx="64" cy="103" r="8"/><circle cx="86" cy="99" r="8"/>`,
  'shark-tactics-mastery': mastery(shark),
  'shared-snacks': `${flock}<path d="M39 30L49 42M89 30L79 42" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`,
  'flock-voyage': `<g transform="translate(9 -4) scale(.84)">${flock}</g>${wave}`,
  'balanced-flock':
    '<path d="M64 34V101M36 100H92M30 53H98M38 53L24 81H52ZM90 53L76 81H104Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><circle cx="64" cy="36" r="8"/>',
  'flock-craft-mastery': mastery(flock),
  'rival-mass': `${crown}<circle cx="37" cy="104" r="7"/><circle cx="64" cy="105" r="11"/><circle cx="91" cy="104" r="7"/>`,
  'rival-streak': `<g transform="translate(8 4) scale(.86)">${crown}</g><path d="M24 90L36 99M22 69L33 71M28 46L38 54" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  'comeback-flock': `${arrow}<path d="M35 44A31 31 0 0 0 39 94M35 44H21M35 44V59" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  'rivalry-mastery': mastery(crown),
  'wardrobe-tour': wardrobe,
  'dressed-traveler': `<g transform="translate(-3 7) scale(.8)">${wardrobe}</g><g transform="translate(57 49) scale(.44)">${compass}</g>`,
  'earned-collection': `${wardrobe}<g transform="translate(51 47) scale(.45)">${star}</g>`,
  'collection-craft-mastery': mastery(wardrobe),
};
const tiers = {
  bronze: {
    top: '#ffddb1',
    light: '#e7a46a',
    middle: '#bc773d',
    dark: '#73421d',
    center: '#dc995b',
    stars: 1,
  },
  silver: {
    top: '#ffffff',
    light: '#e4effb',
    middle: '#a4b3d2',
    dark: '#576880',
    center: '#c0d3e8',
    stars: 2,
  },
  gold: { top: '#fffbd1', light: '#ffe97a', middle: '#e6b73a', dark: '#9b681e', center: '#f3d452', stars: 3 },
};

function medal(id: string, glyph: string, tier: keyof typeof tiers): string {
  const color = tiers[tier];
  const stars = Array.from(
    { length: color.stars },
    (_, index) =>
      `<path d="M0 -4L1.2 -1.3L4 -.9L2 1.1L2.4 4L0 2.5L-2.4 4L-2 1.1L-4 -.9L-1.2 -1.3Z" transform="translate(${64 + (index - (color.stars - 1) / 2) * 12} 111)" fill="${color.top}"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${id.replaceAll('-', ' ')} ${tier} medal"><defs><linearGradient id="rim" x2=".2" y2="1"><stop stop-color="${color.top}"/><stop offset=".24" stop-color="${color.light}"/><stop offset=".5" stop-color="${color.dark}"/><stop offset=".73" stop-color="${color.middle}"/><stop offset="1" stop-color="${color.top}"/></linearGradient><radialGradient id="face" cx=".35" cy=".2" r=".9"><stop stop-color="${color.light}"/><stop offset=".5" stop-color="${color.center}"/><stop offset="1" stop-color="${color.dark}"/></radialGradient><linearGradient id="relief" x2="0" y2="1"><stop stop-color="${color.top}"/><stop offset=".48" stop-color="${color.light}"/><stop offset="1" stop-color="${color.middle}"/></linearGradient></defs><circle cx="64" cy="66" r="59" fill="${color.dark}" opacity=".3"/><circle cx="64" cy="62" r="59" fill="url(#rim)" stroke="${color.dark}" stroke-width="1.3"/><circle cx="64" cy="62" r="53" fill="url(#face)" stroke="${color.top}" stroke-width="1.6"/><circle cx="64" cy="62" r="48" fill="none" stroke="${color.dark}" opacity=".5"/><path d="M23 34A51 51 0 0 1 104 34" fill="none" stroke="${color.top}" stroke-width="4" stroke-linecap="round" opacity=".7"/><g transform="translate(0 -5)" style="color:${color.top};--shade:${color.dark}" fill="url(#relief)" stroke="${color.dark}" stroke-width="1.2" stroke-linejoin="round">${glyph}</g>${stars}</svg>`;
}

function badge(name: string, glyph: string, face: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${name}"><defs><linearGradient id="rim" x2="0" y2="1"><stop stop-color="#f3ffff"/><stop offset=".47" stop-color="#bcd9ef"/><stop offset="1" stop-color="#edf7ff"/></linearGradient><radialGradient id="face" cx=".32" cy=".2" r=".92"><stop stop-color="#f5ffff"/><stop offset=".2" stop-color="${face}"/><stop offset="1" stop-color="#214879"/></radialGradient></defs><circle cx="64" cy="67" r="58" fill="#193352" opacity=".28"/><circle cx="64" cy="62" r="58" fill="url(#rim)"/><circle cx="64" cy="62" r="51" fill="url(#face)" stroke="white" stroke-width="2"/><path d="M28 31Q62 6 99 33" fill="none" stroke="white" stroke-width="4" opacity=".67" stroke-linecap="round"/><g transform="translate(0 -4)" fill="#f3fcff" stroke="#28567b" stroke-width="1.5" style="color:#f3fcff;--shade:#28567b" stroke-linejoin="round">${glyph}</g></svg>`;
}

const roles: Record<string, [string, string]> = {
  player: [duck, '#4bd4ef'],
  guest: [smallDuck, '#a0b8ce'],
  bot: [
    '<rect x="34" y="44" width="60" height="47" rx="11"/><path d="M64 44V33M25 58V76M103 58V76" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><circle cx="64" cy="29" r="5"/><circle cx="49" cy="64" r="6" fill="var(--shade)"/><circle cx="79" cy="64" r="6" fill="var(--shade)"/><path d="M51 79H77" stroke="var(--shade)" stroke-width="5"/>',
    '#8ca7d5',
  ],
  admin: [crown, '#95df47'],
  moderator: [shield, '#759fee'],
};
const moderation: Record<string, [string, string]> = {
  ban: [
    '<circle cx="64" cy="65" r="31" fill="none" stroke="currentColor" stroke-width="10"/><path d="M43 44L85 86" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>',
    '#ef7297',
  ],
  unban: [shield, '#8fdf72'],
  mute: [
    '<path d="M31 56H45L65 40V90L45 74H31Z"/><path d="M81 53L98 77M98 53L81 77" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    '#e5a25e',
  ],
  unmute: [
    '<path d="M29 56H43L63 40V90L43 74H29Z"/><path d="M76 52Q88 65 76 78M86 41Q106 65 86 90" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    '#79d9a6',
  ],
  inspect: [
    '<circle cx="58" cy="59" r="23" fill="none" stroke="currentColor" stroke-width="8"/><path d="M75 77L97 99" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round"/><path d="M48 59H68M58 49V69" stroke="currentColor" stroke-width="5"/>',
    '#76cfed',
  ],
  audit: [
    '<path d="M41 31H86V99H41Z"/><path d="M51 48H76M51 63H76M51 78H71" fill="none" stroke="var(--shade)" stroke-width="5" stroke-linecap="round"/>',
    '#ae91e6',
  ],
  kick: [
    '<path d="M57 31H35V99H57M56 65H99M83 49L100 65L83 81" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
    '#f3a75f',
  ],
};

const glasses =
  '<circle cx="43" cy="66" r="18" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="85" cy="66" r="18" fill="none" stroke="currentColor" stroke-width="7"/><path d="M61 63Q64 57 67 63M25 65L20 58M103 65L108 58" fill="none" stroke="currentColor" stroke-width="5"/>';
const sparkle = '<path d="M64 27L73 56L103 66L73 75L64 105L55 75L25 66L55 56Z"/>';
const bubbles =
  '<circle cx="53" cy="74" r="24" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="87" cy="45" r="15" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="89" cy="93" r="9"/><path d="M39 64Q42 55 51 55M79 41L84 37" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>';
const flower = `${Array.from({ length: 6 }, (_, index) => {
  const a = (index * Math.PI) / 3;
  return `<ellipse cx="${64 + Math.sin(a) * 19}" cy="${65 + Math.cos(a) * 19}" rx="12" ry="18" transform="rotate(${-index * 60} ${64 + Math.sin(a) * 19} ${65 + Math.cos(a) * 19})"/>`;
}).join('')}<circle cx="64" cy="65" r="10" fill="var(--shade)"/>`;
const faceBase =
  '<circle cx="64" cy="65" r="32"/><path d="M42 48Q48 39 58 39" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" opacity=".6"/>';
const cosmetics: Record<string, [string, string]> = {
  'head-sail-cap': [
    '<path d="M27 78L64 36L101 78L87 95H41Z"/><path d="M27 78H101M64 37V77" stroke="var(--shade)" stroke-width="4" fill="none"/>',
    '#79c8e6',
  ],
  'head-bucket': [
    '<path d="M43 40H84L95 83H32Z"/><ellipse cx="64" cy="85" rx="43" ry="10"/><path d="M47 54H81" stroke="var(--shade)" stroke-width="5"/>',
    '#69c9c3',
  ],
  'head-crown': [crown, '#e6ba4e'],
  'head-flower': [flower, '#e8a6c9'],
  'head-propeller': [
    '<path d="M31 82C31 48 96 48 96 82Z"/><path d="M30 85H98M64 56V38" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><ellipse cx="64" cy="36" rx="34" ry="8"/><circle cx="64" cy="36" r="6" fill="var(--shade)"/>',
    '#ef849b',
  ],
  'head-diver': [
    '<path d="M34 87V66C34 28 94 28 94 66V87Z"/><rect x="29" y="85" width="70" height="12" rx="5"/><circle cx="64" cy="65" r="18" fill="var(--shade)"/><path d="M64 48V82M47 65H81" stroke="currentColor" stroke-width="4"/>',
    '#d4ab65',
  ],
  'head-captain': [
    '<path d="M28 62C26 32 102 32 100 62L91 77H37Z"/><path d="M37 71H91V82C75 101 51 101 37 82Z" fill="var(--shade)"/><g transform="translate(40 25) scale(.38)">' +
      star +
      '</g>',
    '#99bdd5',
  ],
  'head-party': [
    '<path d="M64 29L96 98H32Z"/><path d="M46 68L80 62M36 88L90 80" stroke="var(--shade)" stroke-width="7"/><circle cx="64" cy="29" r="8"/>',
    '#b39bdd',
  ],
  'face-round-glasses': [glasses, '#7baaca'],
  'face-goggles': [
    '<rect x="22" y="48" width="39" height="36" rx="12"/><rect x="67" y="48" width="39" height="36" rx="12"/><path d="M61 60H67M27 61L52 55M72 61L97 55" stroke="var(--shade)" stroke-width="5"/>',
    '#7bd1d8',
  ],
  'face-sunglasses': [
    '<path d="M22 49H106L101 80C85 88 72 81 69 61H59C56 81 43 88 27 80Z"/><path d="M32 59H49M79 59H96" stroke="var(--shade)" stroke-width="4"/>',
    '#7592bc',
  ],
  'face-star-glasses': [
    `<g transform="translate(1 25) scale(.64)">${star}</g><g transform="translate(46 25) scale(.64)">${star}</g><path d="M59 63H70" stroke="currentColor" stroke-width="6"/>`,
    '#e6a0cc',
  ],
  'face-monocle': [
    '<circle cx="59" cy="59" r="25" fill="none" stroke="currentColor" stroke-width="7"/><path d="M79 75Q103 99 82 108M46 50L62 43" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
    '#dec173',
  ],
  'face-sleep-mask': [
    '<path d="M26 52Q45 37 64 53Q83 37 102 52L97 83Q79 91 64 77Q49 91 31 83Z"/><path d="M38 64Q45 73 53 64M75 64Q83 73 90 64" stroke="var(--shade)" stroke-width="4" fill="none"/>',
    '#b797da',
  ],
  'neck-bandana': [
    '<path d="M30 43Q64 55 98 43L64 102Z"/><path d="M43 57L64 86L85 57" fill="none" stroke="var(--shade)" stroke-width="4"/>',
    '#e59b9f',
  ],
  'neck-bowtie': [
    '<path d="M61 59L30 44V90L61 75H68L99 90V44L68 59Z"/><rect x="55" y="56" width="18" height="23" rx="6" fill="var(--shade)"/>',
    '#8fd5c9',
  ],
  'neck-scarf': [
    '<path d="M30 43H99V64H80L90 99L64 105L52 66H30Z"/><path d="M68 78L84 73M72 90L88 85" stroke="var(--shade)" stroke-width="5"/>',
    '#eeaf77',
  ],
  'neck-life-ring': [
    '<circle cx="64" cy="66" r="31" fill="none" stroke="currentColor" stroke-width="18"/><path d="M42 44L50 52M78 80L86 88M86 44L78 52M50 80L42 88" stroke="var(--shade)" stroke-width="13"/>',
    '#eea390',
  ],
  'neck-medallion': [
    `<path d="M36 34L56 65M92 34L72 65" stroke="currentColor" stroke-width="5"/><circle cx="64" cy="80" r="24"/><g transform="translate(37 53) scale(.42)" fill="var(--shade)">${star}</g>`,
    '#e3c77d',
  ],
  'neck-flower-lei': [
    `${pieces(8, 29, 10)}<circle cx="64" cy="66" r="16" fill="none" stroke="currentColor" stroke-width="3"/>`,
    '#eeaec5',
  ],
  'wake-rings': [
    `${ring}<ellipse cx="64" cy="68" rx="25" ry="11" fill="none" stroke="currentColor" stroke-width="5"/>`,
    '#88d1e6',
  ],
  'wake-bubbles': [bubbles, '#91d5e8'],
  'wake-stars': [`${star}<g transform="translate(3 16) scale(.37)">${star}</g>`, '#edce75'],
  'wake-hearts': [`${heart}<g transform="translate(71 15) scale(.3)">${heart}</g>`, '#eba3c0'],
  'wake-rainbow': [
    '<path d="M30 88A34 34 0 0 1 98 88M42 88A22 22 0 0 1 86 88M53 88A11 11 0 0 1 75 88" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    '#b1bcdd',
  ],
  'wake-sparkles': [sparkle, '#a8dfea'],
  'emote-wave': [
    '<path d="M38 71V45Q38 36 45 40V60V30Q45 20 53 26V57V24Q55 17 62 24V57V30Q66 23 72 30V61L79 48Q88 42 93 52L85 82Q74 103 57 97L32 80Q23 65 31 62Z"/><path d="M22 43L17 33M91 26L99 19" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    '#97cfe6',
  ],
  'emote-heart': [heart, '#ec9ebe'],
  'emote-laugh': [
    `${faceBase}<path d="M43 57L49 51L55 57M74 57L80 51L86 57" fill="none" stroke="var(--shade)" stroke-width="4"/><path d="M45 70H84Q65 105 45 70Z" fill="var(--shade)"/>`,
    '#efca68',
  ],
  'emote-wow': [
    `${faceBase}<ellipse cx="50" cy="55" rx="4" ry="7" fill="var(--shade)"/><ellipse cx="78" cy="55" rx="4" ry="7" fill="var(--shade)"/><ellipse cx="64" cy="80" rx="9" ry="12" fill="var(--shade)"/>`,
    '#efd479',
  ],
  'emote-cheer': [
    `${faceBase}<g transform="translate(29 38) scale(.3)" fill="var(--shade)">${star}</g><g transform="translate(62 38) scale(.3)" fill="var(--shade)">${star}</g><path d="M46 72H82Q64 97 46 72Z" fill="var(--shade)"/>`,
    '#eed275',
  ],
  'emote-splash': [
    '<path d="M31 84L25 48L46 64L51 28L65 61L84 25L88 63L107 47L98 89L78 101H47Z"/><path d="M41 82Q64 94 89 81" fill="none" stroke="var(--shade)" stroke-width="4"/>',
    '#7ad1e7',
  ],
  'celebration-confetti': [
    '<path d="M34 99L45 61L75 88Z"/><path d="M51 56L60 35M73 64L96 56M68 49L81 32M84 84L103 88M39 43L32 32" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><circle cx="96" cy="33" r="6"/>',
    '#d8a6d9',
  ],
  'celebration-stars': [
    `${star}<g transform="translate(1 11) scale(.35)">${star}</g><g transform="translate(76 12) scale(.3)">${star}</g>`,
    '#e7cb7d',
  ],
  'celebration-bubbles': [
    `${bubbles}<circle cx="36" cy="31" r="7" fill="none" stroke="currentColor" stroke-width="3"/>`,
    '#8cd8dd',
  ],
  'celebration-fireworks': [
    `${sparkle}<path d="M38 37L28 27M90 37L100 27M39 95L29 105M90 95L100 105" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="105" cy="67" r="4"/><circle cx="23" cy="65" r="4"/>`,
    '#b59edb',
  ],
};

for (const folder of ['achievements', 'roles', 'moderation', 'cosmetics'])
  await mkdir(resolve(directory, folder), { recursive: true });
const manifest: {
  version: number;
  author: string;
  achievements: Record<string, Record<string, string>>;
  roles: Record<string, string>;
  moderation: Record<string, string>;
  cosmetics: Record<string, string>;
} = { version: 2, author: 'Sup-a-Dub project', achievements: {}, roles: {}, moderation: {}, cosmetics: {} };
for (const [id, glyph] of Object.entries(glyphs)) {
  manifest.achievements[id] = {};
  for (const tier of Object.keys(tiers) as (keyof typeof tiers)[]) {
    const path = `achievements/${id}-${tier}.svg`;
    await Bun.write(resolve(directory, path), medal(id, glyph, tier));
    manifest.achievements[id]![tier] = `/assets/icons/${path}`;
  }
}
for (const [category, items] of [
  ['roles', roles],
  ['moderation', moderation],
  ['cosmetics', cosmetics],
] as const) {
  for (const [id, [glyph, color]] of Object.entries(items)) {
    const path = `${category}/${id}.svg`;
    await Bun.write(resolve(directory, path), badge(id, glyph, color));
    manifest[category][id] = `/assets/icons/${path}`;
  }
}
await Bun.write(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
const rows = Object.keys(glyphs)
  .map(
    (id) =>
      `<article><span>${id}</span>${Object.keys(tiers)
        .map((tier) => `<img src="../icons/achievements/${id}-${tier}.svg" alt="${id} ${tier}"/>`)
        .join('')}</article>`,
  )
  .join('');
const actions = [
  Object.entries(roles)
    .map(
      ([id]) =>
        `<figure><img src="../icons/roles/${id}.svg" alt="${id}"/><figcaption>${id}</figcaption></figure>`,
    )
    .join(''),
  Object.entries(moderation)
    .map(
      ([id]) =>
        `<figure><img src="../icons/moderation/${id}.svg" alt="${id}"/><figcaption>${id}</figcaption></figure>`,
    )
    .join(''),
  Object.entries(cosmetics)
    .map(
      ([id]) =>
        `<figure><img src="../icons/cosmetics/${id}.svg" alt="${id}"/><figcaption>${id}</figcaption></figure>`,
    )
    .join(''),
].join('');
await mkdir(resolve(directory, '../review'), { recursive: true });
await Bun.write(
  resolve(directory, '../review/icons.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"/><link rel="icon" href="data:,"/><title>Sup-a-Dub medal review</title><style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#458ac5;color:white;font:13px Arial}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}article{display:grid;grid-template-columns:repeat(3,1fr);background:#276bad66;border:1px solid #c6ebff70;border-radius:12px;padding:8px}article span{grid-column:1/4;text-align:center;padding:0 0 5px}img{width:100%;height:auto}aside{display:flex;flex-wrap:wrap;justify-content:center;padding-top:18px}figure{margin:8px;width:72px;text-align:center}figcaption{font-size:12px}</style></head><body><main>${rows}</main><aside>${actions}</aside></body></html>`,
);
console.log(
  JSON.stringify({
    achievementIds: Object.keys(glyphs).length,
    medals: Object.keys(glyphs).length * 3,
    roles: Object.keys(roles).length,
    moderation: Object.keys(moderation).length,
    cosmetics: Object.keys(cosmetics).length,
  }),
);
