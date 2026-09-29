export type Instrument =
  | 'piano'
  | 'flute'
  | 'pizzicato'
  | 'marimba'
  | 'glockenspiel'
  | 'strings'
  | 'bass'
  | 'kick'
  | 'snare'
  | 'tom'
  | 'shaker'
  | 'cymbal';
export type Layer = 'melody' | 'harmony' | 'bass' | 'rhythm';
export type Note = {
  beat: number;
  length: number;
  midi: number;
  velocity: number;
  instrument: Instrument;
  pan: number;
  layer: Layer;
};
type Motif = readonly (readonly [number, number, number])[];
type Section = {
  name: string;
  bars: number;
  progression: readonly number[];
  energy: number;
  motif: 'a' | 'b' | 'c';
  lead: Instrument;
};
export type Score = {
  id: string;
  title: string;
  bpm: number;
  key: number;
  mode: readonly number[];
  motifs: Record<'a' | 'b' | 'c', Motif>;
  sections: readonly Section[];
  description: string;
};
const major = [0, 2, 4, 5, 7, 9, 11];
const dorian = [0, 2, 3, 5, 7, 9, 10];
const minor = [0, 2, 3, 5, 7, 8, 10];

export const SCORES: readonly Score[] = [
  {
    id: 'bubble-lobby',
    title: 'Bubble Lobby',
    bpm: 112,
    key: 60,
    mode: major,
    description: 'A light piano invitation, a flute answer, and a warm hand-drum refrain in C major.',
    motifs: {
      a: [
        [0, 0.75, 2],
        [1, 0.5, 4],
        [1.75, 0.75, 5],
        [3, 0.75, 4],
        [4, 1, 1],
        [5.5, 0.5, 2],
        [6.25, 0.5, 4],
        [7, 0.75, 2],
        [8, 0.75, 0],
        [9, 0.5, 2],
        [9.75, 0.75, 4],
        [11, 0.75, 5],
        [12, 0.75, 4],
        [13, 0.5, 2],
        [14, 1.6, 1],
      ],
      b: [
        [0, 1.25, 7],
        [1.5, 0.5, 6],
        [2.5, 1, 4],
        [4, 0.5, 5],
        [4.75, 0.5, 4],
        [5.5, 0.5, 2],
        [6.5, 1.25, 3],
        [8, 0.75, 5],
        [9, 0.75, 7],
        [10, 0.5, 8],
        [11, 0.75, 7],
        [12, 1, 4],
        [13.5, 0.5, 2],
        [14.5, 1.1, 0],
      ],
      c: [
        [0, 0.5, 4],
        [0.75, 0.5, 5],
        [1.5, 0.5, 7],
        [2.5, 0.5, 5],
        [3.25, 0.5, 4],
        [4, 1, 2],
        [5.5, 0.5, 1],
        [6.5, 1, 2],
        [8, 0.75, 4],
        [9, 0.75, 7],
        [10.25, 0.5, 6],
        [11, 0.75, 4],
        [12, 0.75, 2],
        [13, 0.75, 1],
        [14, 1.8, 0],
      ],
    },
    sections: [
      { name: 'Invitation', bars: 8, progression: [0, 0, 3, 4], energy: 0.25, motif: 'a', lead: 'piano' },
      { name: 'Bubbles', bars: 16, progression: [0, 5, 3, 4], energy: 0.46, motif: 'a', lead: 'flute' },
      { name: 'Tile Garden', bars: 8, progression: [5, 3, 0, 4], energy: 0.38, motif: 'b', lead: 'marimba' },
      {
        name: 'Sunlit Refrain',
        bars: 16,
        progression: [0, 4, 5, 3],
        energy: 0.78,
        motif: 'c',
        lead: 'piano',
      },
      { name: 'Home Again', bars: 8, progression: [3, 4, 0, 0], energy: 0.3, motif: 'a', lead: 'flute' },
    ],
  },
  {
    id: 'tile-trails',
    title: 'Tile Trails',
    bpm: 108,
    key: 62,
    mode: dorian,
    description:
      'Dorian woodwinds explore an open fifth, then pizzicato steps and brushed percussion join the trail.',
    motifs: {
      a: [
        [0, 1.25, 0],
        [1.5, 0.5, 2],
        [2.5, 1, 3],
        [4, 0.75, 4],
        [5, 0.5, 5],
        [6, 1.5, 4],
        [8, 1, 2],
        [9.5, 0.75, 0],
        [11, 0.5, -1],
        [12, 1.25, 1],
        [14, 1.5, 0],
      ],
      b: [
        [0, 0.75, 7],
        [1, 0.75, 5],
        [2.5, 1, 4],
        [4, 0.75, 3],
        [5, 0.75, 2],
        [6.5, 0.75, 0],
        [8, 1.25, 1],
        [9.75, 0.5, 3],
        [11, 0.5, 4],
        [12, 0.75, 5],
        [13, 0.75, 3],
        [14, 1.6, 2],
      ],
      c: [
        [0, 0.5, 0],
        [0.75, 0.5, 2],
        [1.5, 0.5, 3],
        [2.5, 1, 4],
        [4, 0.5, 5],
        [4.75, 0.5, 4],
        [5.5, 0.5, 2],
        [6.5, 1, 0],
        [8, 0.75, 3],
        [9, 0.75, 5],
        [10.5, 1, 7],
        [12, 0.75, 4],
        [13, 0.75, 2],
        [14, 1.5, 0],
      ],
    },
    sections: [
      { name: 'Trailhead', bars: 8, progression: [0, 3, 0, 6], energy: 0.2, motif: 'a', lead: 'flute' },
      {
        name: 'Blue Paths',
        bars: 16,
        progression: [0, 6, 3, 0],
        energy: 0.48,
        motif: 'a',
        lead: 'pizzicato',
      },
      { name: 'Hidden Pool', bars: 8, progression: [2, 5, 3, 4], energy: 0.32, motif: 'b', lead: 'piano' },
      { name: 'Together', bars: 8, progression: [0, 3, 6, 0], energy: 0.77, motif: 'c', lead: 'flute' },
      { name: 'Trail Return', bars: 8, progression: [3, 6, 0, 0], energy: 0.28, motif: 'a', lead: 'marimba' },
    ],
  },
  {
    id: 'rubber-run',
    title: 'Rubber Run',
    bpm: 128,
    key: 67,
    mode: major,
    description:
      'A syncopated marimba run grows into a piano and low-drum chase, with a quiet bridge before the final lift.',
    motifs: {
      a: [
        [0, 0.45, 0],
        [0.75, 0.45, 2],
        [1.5, 0.45, 4],
        [2.25, 0.45, 2],
        [3, 0.75, 5],
        [4, 0.5, 4],
        [4.75, 0.5, 2],
        [5.5, 0.5, 1],
        [6.5, 1, 0],
        [8, 0.5, 2],
        [8.75, 0.5, 4],
        [9.5, 0.5, 5],
        [10.5, 0.5, 7],
        [11.25, 0.5, 5],
        [12, 0.75, 4],
        [13, 0.5, 2],
        [14, 1.5, 0],
      ],
      b: [
        [0, 1.5, 5],
        [2, 1.5, 4],
        [4, 1.5, 2],
        [6, 1.5, 1],
        [8, 0.75, 0],
        [9, 0.75, 2],
        [10, 1.5, 4],
        [12, 0.75, 3],
        [13, 0.75, 1],
        [14, 1.5, 2],
      ],
      c: [
        [0, 0.5, 7],
        [0.75, 0.5, 5],
        [1.5, 0.5, 4],
        [2.25, 0.5, 2],
        [3, 0.5, 4],
        [4, 0.5, 5],
        [4.75, 0.5, 7],
        [5.5, 0.5, 9],
        [6.5, 1, 7],
        [8, 0.5, 5],
        [8.75, 0.5, 4],
        [9.5, 0.5, 2],
        [10.5, 0.5, 1],
        [11.25, 0.5, 2],
        [12, 0.75, 4],
        [13, 0.75, 2],
        [14, 1.5, 0],
      ],
    },
    sections: [
      { name: 'Ready', bars: 8, progression: [0, 3, 0, 4], energy: 0.42, motif: 'a', lead: 'marimba' },
      { name: 'Duck Dash', bars: 16, progression: [0, 4, 5, 3], energy: 0.75, motif: 'a', lead: 'piano' },
      { name: 'Breath', bars: 8, progression: [5, 1, 3, 4], energy: 0.3, motif: 'b', lead: 'flute' },
      { name: 'Rapid Tiles', bars: 16, progression: [0, 5, 3, 4], energy: 0.97, motif: 'c', lead: 'marimba' },
      { name: 'Last Bend', bars: 8, progression: [3, 4, 0, 4], energy: 0.68, motif: 'a', lead: 'piano' },
    ],
  },
  {
    id: 'deep-end',
    title: 'Deep End',
    bpm: 100,
    key: 57,
    mode: minor,
    description:
      'Low piano and breathy flute cross a minor pool. Toms build in measured waves before the open-fifth release.',
    motifs: {
      a: [
        [0, 1.5, 0],
        [2, 0.75, 2],
        [3, 0.75, 1],
        [4, 1.5, -1],
        [6, 1.5, 0],
        [8, 1.5, 3],
        [10, 0.75, 2],
        [11, 0.75, 0],
        [12, 1.25, 1],
        [14, 1.5, -1],
      ],
      b: [
        [0, 0.75, 4],
        [1, 0.75, 5],
        [2.5, 1, 7],
        [4, 1.5, 6],
        [6, 1.5, 4],
        [8, 0.75, 2],
        [9, 0.75, 3],
        [10.5, 1, 5],
        [12, 0.75, 4],
        [13, 0.75, 2],
        [14, 1.5, 0],
      ],
      c: [
        [0, 0.5, 0],
        [0.75, 0.5, 0],
        [1.5, 0.5, 2],
        [2.5, 1, 4],
        [4, 0.5, 3],
        [4.75, 0.5, 2],
        [5.5, 0.5, 1],
        [6.5, 1, 0],
        [8, 0.75, 4],
        [9, 0.75, 6],
        [10, 1.5, 7],
        [12, 0.75, 5],
        [13, 0.75, 2],
        [14, 1.5, 0],
      ],
    },
    sections: [
      { name: 'Below the Lip', bars: 8, progression: [0, 0, 5, 6], energy: 0.2, motif: 'a', lead: 'piano' },
      { name: 'Watchful Water', bars: 8, progression: [0, 5, 2, 6], energy: 0.44, motif: 'a', lead: 'flute' },
      {
        name: 'Silver Fins',
        bars: 8,
        progression: [3, 0, 5, 4],
        energy: 0.66,
        motif: 'b',
        lead: 'pizzicato',
      },
      { name: 'Undertow', bars: 16, progression: [0, 6, 5, 4], energy: 0.96, motif: 'c', lead: 'piano' },
      { name: 'Clear Water', bars: 8, progression: [5, 6, 0, 0], energy: 0.28, motif: 'a', lead: 'flute' },
    ],
  },
  {
    id: 'flock-frenzy',
    title: 'Flock Frenzy',
    bpm: 144,
    key: 62,
    mode: major,
    description:
      'A bright mallet call passes to piano and flute. Driving toms and snare lead a full final refrain.',
    motifs: {
      a: [
        [0, 0.5, 0],
        [0.5, 0.5, 2],
        [1.25, 0.5, 4],
        [2, 0.75, 7],
        [3, 0.75, 5],
        [4, 0.5, 4],
        [4.75, 0.5, 2],
        [5.5, 0.5, 4],
        [6.5, 1, 5],
        [8, 0.5, 2],
        [8.5, 0.5, 4],
        [9.25, 0.5, 5],
        [10, 0.75, 7],
        [11, 0.75, 9],
        [12, 0.75, 7],
        [13, 0.75, 4],
        [14, 1.5, 2],
      ],
      b: [
        [0, 1.5, 7],
        [2, 1.5, 5],
        [4, 0.75, 4],
        [5, 0.75, 2],
        [6, 1.5, 0],
        [8, 1.5, 3],
        [10, 0.75, 5],
        [11, 0.75, 4],
        [12, 0.75, 2],
        [13, 0.75, 1],
        [14, 1.5, 0],
      ],
      c: [
        [0, 0.5, 7],
        [0.5, 0.5, 9],
        [1.25, 0.5, 7],
        [2, 0.75, 5],
        [3, 0.75, 4],
        [4, 0.5, 2],
        [4.75, 0.5, 4],
        [5.5, 0.5, 5],
        [6.5, 1, 7],
        [8, 0.5, 9],
        [8.5, 0.5, 7],
        [9.25, 0.5, 5],
        [10, 0.75, 4],
        [11, 0.75, 2],
        [12, 0.75, 1],
        [13, 0.75, 2],
        [14, 1.5, 0],
      ],
    },
    sections: [
      { name: 'Little Feet', bars: 8, progression: [0, 4, 0, 4], energy: 0.4, motif: 'a', lead: 'marimba' },
      { name: 'Gather', bars: 16, progression: [0, 5, 3, 4], energy: 0.68, motif: 'a', lead: 'piano' },
      { name: 'Breathing Room', bars: 8, progression: [5, 3, 1, 4], energy: 0.3, motif: 'b', lead: 'flute' },
      { name: 'All Together', bars: 16, progression: [0, 4, 5, 3], energy: 1, motif: 'c', lead: 'piano' },
      { name: 'Victory Lap', bars: 8, progression: [3, 4, 0, 5], energy: 0.85, motif: 'c', lead: 'marimba' },
      { name: 'A Little Bow', bars: 8, progression: [3, 4, 0, 4], energy: 0.45, motif: 'a', lead: 'flute' },
    ],
  },
  {
    id: 'home-with-ducks',
    title: 'Home With Ducks',
    bpm: 96,
    key: 65,
    mode: major,
    description:
      'Piano and a high bell welcome the flock home. Strings and soft drums open into a warm, earned reprise.',
    motifs: {
      a: [
        [0, 1.5, 2],
        [2, 0.75, 1],
        [3, 0.75, 0],
        [4, 1.5, 4],
        [6, 1.5, 2],
        [8, 1, 5],
        [9.5, 0.75, 4],
        [11, 0.5, 2],
        [12, 1.5, 1],
        [14, 1.5, 0],
      ],
      b: [
        [0, 1.25, 7],
        [1.5, 0.5, 5],
        [2.5, 1, 4],
        [4, 1.5, 2],
        [6, 1.5, 3],
        [8, 1.5, 5],
        [10, 0.75, 7],
        [11, 0.75, 6],
        [12, 0.75, 4],
        [13, 0.75, 2],
        [14, 1.5, 1],
      ],
      c: [
        [0, 0.75, 2],
        [1, 0.75, 4],
        [2, 1.5, 7],
        [4, 0.75, 5],
        [5, 0.75, 4],
        [6, 1.5, 2],
        [8, 0.75, 3],
        [9, 0.75, 5],
        [10, 1.5, 7],
        [12, 0.75, 4],
        [13, 0.75, 1],
        [14, 1.7, 0],
      ],
    },
    sections: [
      { name: 'Welcome', bars: 8, progression: [0, 5, 3, 4], energy: 0.24, motif: 'a', lead: 'piano' },
      { name: 'Safe at Last', bars: 8, progression: [0, 3, 1, 4], energy: 0.42, motif: 'a', lead: 'flute' },
      {
        name: 'Remember the Journey',
        bars: 8,
        progression: [5, 2, 3, 4],
        energy: 0.36,
        motif: 'b',
        lead: 'glockenspiel',
      },
      { name: 'Homecoming', bars: 16, progression: [0, 4, 5, 3], energy: 0.8, motif: 'c', lead: 'piano' },
      { name: 'Goodnight Ducks', bars: 8, progression: [3, 4, 0, 0], energy: 0.2, motif: 'a', lead: 'flute' },
    ],
  },
];

export function scoreNotes(score: Score): Note[] {
  const notes: Note[] = [];
  const pitch = (degree: number, octave = 0) =>
    score.key + Math.floor(degree / 7) * 12 + score.mode[((degree % 7) + 7) % 7] + octave * 12;
  const add = (
    layer: Layer,
    instrument: Instrument,
    beat: number,
    length: number,
    midi: number,
    velocity: number,
    pan = 0,
  ) => notes.push({ layer, instrument, beat, length, midi, velocity, pan });
  let firstBar = 0;
  for (const [sectionIndex, section] of score.sections.entries()) {
    for (let localBar = 0; localBar < section.bars; localBar++) {
      const bar = firstBar + localBar;
      const beat = bar * 4;
      const root = section.progression[localBar % section.progression.length];
      const chord = [root, root + 2, root + 4, root + 6];
      const energy = section.energy * (0.88 + 0.12 * Math.min(1, localBar / 4));
      const phrase = localBar % 4;
      if (!(sectionIndex === 0 && localBar < 2)) {
        for (const [at, length, degree] of score.motifs[section.motif]) {
          if (Math.floor(at / 4) !== phrase) continue;
          const answer = localBar >= 8 && localBar % 8 >= 4;
          const variation = answer && degree < 5 ? 7 : 0;
          add(
            'melody',
            section.lead,
            beat + (at % 4),
            length,
            pitch(degree + variation, section.lead === 'flute' ? 1 : 0),
            0.37 + energy * 0.3,
            -0.1,
          );
          if (energy > 0.74 && (at % 4 === 0 || at % 4 === 2))
            add('melody', 'glockenspiel', beat + (at % 4) + 0.02, 0.7, pitch(degree, 1), 0.12, 0.35);
        }
      }
      const order = energy > 0.55 ? [0, 2, 1, 2, 3, 2, 1, 2] : [0, 2, 1, 2];
      for (const [index, chordIndex] of order.entries()) {
        const at = (index * 4) / order.length;
        add(
          'harmony',
          sectionIndex % 2 === 0 ? 'pizzicato' : 'marimba',
          beat + at,
          0.62,
          pitch(chord[chordIndex], -1),
          0.16 + energy * 0.15,
          index % 2 ? 0.4 : -0.4,
        );
      }
      for (const [index, degree] of chord.slice(0, energy > 0.65 ? 4 : 3).entries()) {
        add(
          'harmony',
          'strings',
          beat + index * 0.025,
          3.85,
          pitch(degree, -1),
          0.07 + energy * 0.07,
          (index - 1.5) * 0.2,
        );
        if (localBar % 4 === 0)
          add('harmony', 'piano', beat + index * 0.035, 3.2, pitch(degree, -1), 0.13 + energy * 0.08, 0.15);
      }
      add('bass', 'bass', beat, energy > 0.6 ? 1.45 : 2.75, pitch(root, -2), 0.46 + energy * 0.18, 0);
      add('bass', 'bass', beat + (energy > 0.6 ? 1.5 : 3), 0.8, pitch(root + 4, -2), 0.3 + energy * 0.15, 0);
      if (energy > 0.6) {
        add('bass', 'bass', beat + 2.5, 0.6, pitch(root, -1), 0.25 + energy * 0.13, 0);
        add('bass', 'bass', beat + 3.25, 0.55, pitch(root + (localBar % 2 ? 3 : 4), -2), 0.3, 0);
      }
      if (energy > 0.28) {
        add('rhythm', 'kick', beat, 0.8, 36, 0.3 + energy * 0.42);
        add('rhythm', 'kick', beat + 2, 0.8, 36, 0.24 + energy * 0.37);
        for (const at of [1, 3]) add('rhythm', 'snare', beat + at, 0.4, 38, 0.14 + energy * 0.34, 0.13);
        for (let step = 0; step < (energy > 0.72 ? 16 : 8); step++)
          add(
            'rhythm',
            'shaker',
            beat + step * (energy > 0.72 ? 0.25 : 0.5),
            0.18,
            48,
            (step % 2 ? 0.08 : 0.12) + energy * 0.08,
            step % 2 ? 0.5 : -0.35,
          );
      } else for (const at of [0, 2]) add('rhythm', 'shaker', beat + at, 0.2, 48, 0.07, 0.3);
      if (energy > 0.6 && localBar % 2) add('rhythm', 'kick', beat + 2.75, 0.7, 36, 0.26);
      if (localBar % 8 === 0 && energy > 0.45)
        add('rhythm', 'cymbal', beat, 2.8, 60, 0.16 + energy * 0.1, -0.25);
      if (localBar % 8 === 7 && energy > 0.45) {
        for (let fill = 0; fill < 6; fill++)
          add(
            'rhythm',
            'tom',
            beat + 2.5 + fill * 0.25,
            0.6,
            50 - fill * 2,
            0.22 + energy * 0.18 + fill * 0.02,
            0.4 - fill * 0.15,
          );
      }
    }
    firstBar += section.bars;
  }
  return notes.sort((a, b) => a.beat - b.beat);
}
