import type { PracticeResult } from '@supadub/protocol';
import type { ResultTiming } from '@supadub/assets';

const progress = (time: number, range: readonly [number, number]) =>
  Math.max(0, Math.min(1, (time - range[0]) / (range[1] - range[0])));
const ease = (value: number) => value * value * (3 - 2 * value);
const smooth = (time: number, range: readonly [number, number]) => ease(progress(time, range));
const forever = [Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER] as const;

export type ResultCue = { alpha: number; scale: number };

function label(
  time: number,
  entry: readonly [number, number],
  exit = forever as readonly [number, number],
): ResultCue {
  const scale = smooth(time, entry) * (1 - smooth(time, exit));
  return { alpha: Math.min(1, scale * 8), scale };
}

function count(
  time: number,
  entry: readonly [number, number, number],
  exit: readonly [number, number],
  peak: number,
): ResultCue {
  const alpha = smooth(time, [entry[0], entry[1]]) * (1 - smooth(time, exit));
  const scale = time >= exit[0] ? peak : peak - (peak - 1) * smooth(time, [entry[1], entry[2]]);
  return { alpha, scale };
}

export function resultTimeline(
  result: PracticeResult,
  elapsedMs: number,
  timing: ResultTiming,
  reduced = false,
) {
  const elapsed = reduced ? timing.controls[1] : Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const deductedSeconds =
    elapsed < timing.deduction[0]
      ? 0
      : Math.floor((elapsed - timing.deduction[0] + 0.002) / timing.deductionStep) + 1;
  const remainingBonusMs = Math.max(0, result.chainBonusMs - deductedSeconds * 1000);
  const timeMs = Math.max(result.finalTimeMs, result.rawTimeMs - result.chainBonusMs + remainingBonusMs);
  const completed = elapsed >= timing.controls[0];
  const coinGrowth =
    elapsed < timing.medalEntry[1]
      ? smooth(elapsed, [timing.medalEntry[0], timing.medalEntry[1]])
      : elapsed < timing.medalEntry[2]
        ? 1 + 0.2 * smooth(elapsed, [timing.medalEntry[1], timing.medalEntry[2]])
        : 1.2 - 0.2 * smooth(elapsed, [timing.medalEntry[2], timing.medalEntry[3]]);
  const coinExit =
    elapsed < timing.medalExit[1]
      ? 1 + 0.2 * smooth(elapsed, [timing.medalExit[0], timing.medalExit[1]])
      : 1.2 * (1 - smooth(elapsed, [timing.medalExit[1], timing.medalExit[2]]));
  const recordScale =
    elapsed < timing.record[1]
      ? 1.2 * smooth(elapsed, [timing.record[0], timing.record[1]])
      : 1.2 - 0.2 * smooth(elapsed, [timing.record[1], timing.record[2]]);
  const recordExit =
    elapsed < timing.recordExit[1]
      ? 1 + 0.2 * smooth(elapsed, [timing.recordExit[0], timing.recordExit[1]])
      : 1.2 * (1 - smooth(elapsed, [timing.recordExit[1], timing.recordExit[2]]));
  const record = recordScale * recordExit;
  return {
    phase: completed
      ? 'choices'
      : elapsed >= timing.medalEntry[0]
        ? 'medal'
        : elapsed >= timing.bonusStart
          ? 'bonus'
          : 'score',
    heading: label(elapsed, timing.heading),
    time: count(elapsed, timing.rawTime, forever, timing.countPeak),
    timeMs,
    remainingBonusMs,
    bonus: elapsed >= timing.bonusStart && elapsed < timing.bonusEnd,
    bonusLime: smooth(elapsed, timing.bonusColor) * (1 - smooth(elapsed, timing.bonusWhite)),
    savedLabel: label(elapsed, timing.savedLabel, timing.savedExit),
    savedCount: count(elapsed, timing.savedCount, timing.savedCountExit, timing.countPeak),
    chainLabel: label(elapsed, timing.chainLabel, timing.chainExit),
    chainCount: count(elapsed, timing.chainCount, timing.chainCountExit, timing.countPeak),
    medal: coinGrowth * coinExit,
    record: { alpha: Math.min(1, record * 8), scale: record },
    controls: smooth(elapsed, timing.controls),
    completed,
  };
}

export type ResultFrame = ReturnType<typeof resultTimeline>;
