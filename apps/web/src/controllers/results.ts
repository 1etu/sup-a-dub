import { RESULT_TIMING } from '@supadub/assets';
import type { PracticeResult } from '@supadub/protocol';
import { timecode } from '../ui/graphics';
import { resultTimeline, type ResultFrame } from './result-timeline';

type AwardPose = { x: number; y: number; diameter: number; time: number };

export class ResultsController {
  private root?: HTMLElement;
  private result?: PracticeResult;
  private started = 0;
  private record = false;
  private skipped = false;
  private completed = false;
  private width = 1280;
  private height = 720;
  private cues: [
    HTMLElement,
    keyof Pick<ResultFrame, 'heading' | 'time' | 'savedLabel' | 'savedCount' | 'chainLabel' | 'chainCount'>,
  ][] = [];
  private time?: HTMLElement;
  private bonus?: HTMLElement;
  private chain?: HTMLElement;
  private recordNode?: HTMLElement;
  private choices?: HTMLElement;
  private controls?: HTMLElement;
  private award?: HTMLElement;

  constructor(private readonly presentAward: (pose: AwardPose | null) => void) {}

  start(root: HTMLElement, result: PracticeResult, newRecord: boolean, started: number): void {
    this.clear();
    this.root = root.querySelector<HTMLElement>('.results-content')!;
    this.result = result;
    this.record = newRecord;
    this.started = started;
    this.time = root.querySelector<HTMLElement>('.result-time')!;
    this.chain = root.querySelector<HTMLElement>('.result-chain')!;
    this.bonus = root.querySelector<HTMLElement>('.chain-bonus')!;
    this.recordNode = root.querySelector<HTMLElement>('.result-record')!;
    this.choices = root.querySelector<HTMLElement>('.result-choices')!;
    this.controls = root.querySelector<HTMLElement>('.result-controls')!;
    this.award = root.querySelector<HTMLElement>('.result-award-anchor')!;
    this.cues = [
      [root.querySelector<HTMLElement>('.result-title')!, 'heading'],
      [this.time, 'time'],
      [root.querySelector<HTMLElement>('[data-result-cue="saved-label"]')!, 'savedLabel'],
      [root.querySelector<HTMLElement>('[data-result-cue="saved-count"]')!, 'savedCount'],
      [root.querySelector<HTMLElement>('[data-result-cue="chain-label"]')!, 'chainLabel'],
      [this.chain, 'chainCount'],
    ];
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  skip(): boolean {
    if (!this.result || this.completed) return false;
    this.skipped = true;
    return true;
  }

  update(now: number, reducedMotion: boolean): void {
    if (!this.result || !this.root) return;
    const elapsed = this.skipped ? RESULT_TIMING.controls[1] : now - this.started;
    const frame = resultTimeline(this.result, elapsed, RESULT_TIMING, reducedMotion);
    this.completed = frame.completed;
    this.root.dataset.resultPhase = frame.phase;
    for (const [node, key] of this.cues) {
      node.style.setProperty('--cue-alpha', String(frame[key].alpha));
      node.style.setProperty('--cue-scale', String(Math.max(0.001, frame[key].scale)));
      node.setAttribute('aria-hidden', String(frame[key].alpha === 0));
    }
    const displayTime = timecode(frame.timeMs);
    if (this.time!.textContent !== displayTime) this.time!.textContent = displayTime;
    const color = `rgb(${Math.round(247 + (133 - 247) * frame.bonusLime)},${Math.round(252 + (193 - 252) * frame.bonusLime)},${Math.round(255 + (32 - 255) * frame.bonusLime)})`;
    this.time!.style.color = color;
    this.chain!.style.color = color;
    this.bonus!.style.color = color;
    this.bonus!.hidden = !frame.bonus;
    const bonus = `−${(frame.remainingBonusMs / 1000).toFixed(2)}`;
    if (this.bonus!.textContent !== bonus) this.bonus!.textContent = bonus;
    this.recordNode!.hidden = !(frame.record.alpha > 0 && this.record);
    this.recordNode!.style.opacity = String(frame.record.alpha);
    this.recordNode!.style.transform = `scale(${frame.record.scale})`;
    this.choices!.hidden = !frame.completed;
    this.choices!.style.opacity = String(frame.controls);
    const controlLabel = this.controls!.querySelector('[data-action="result-continue"]')!.firstChild!;
    const controlText = frame.completed ? 'OK ' : 'SKIP ';
    if (controlLabel.textContent !== controlText) controlLabel.textContent = controlText;
    this.award!.hidden = frame.medal <= 0;
    if (frame.medal > 0) {
      const portrait = this.width / this.height <= 0.75;
      const designWidth = portrait ? 800 : 1280;
      const designHeight = portrait ? 1100 : 720;
      const scale = Math.min(this.width / designWidth, this.height / designHeight);
      this.presentAward({
        x: this.width / 2,
        y: (this.height - designHeight * scale) / 2 + (portrait ? 610 : 484) * scale,
        diameter: 200 * scale * frame.medal,
        time: Math.max(0, elapsed - RESULT_TIMING.medalEntry[0]) / 1000,
      });
    } else this.presentAward(null);
  }

  clear(): void {
    this.presentAward(null);
    this.root = undefined;
    this.result = undefined;
    this.cues = [];
    this.time =
      this.bonus =
      this.chain =
      this.recordNode =
      this.choices =
      this.controls =
      this.award =
        undefined;
    this.skipped = false;
    this.completed = false;
  }
}
