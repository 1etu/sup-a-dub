import type { PracticeResult } from '@supadub/protocol';
import { chrome, footer, timecode, triangle } from './graphics';

export function renderResults(result: PracticeResult, replaying: boolean): string {
  return `<div class="results-shade"></div>${replaying ? `<div class="replay-label">${chrome('REPLAY', 'pink', 410, 63)}</div>` : ''}<div class="results-content" data-result-phase="score">
    ${chrome('TIME', 'blue', 1000, 177, 'result-title result-cue')}
    <strong class="result-time result-cue">${timecode(result.rawTimeMs)}</strong>
    <h2 class="result-cue" data-result-cue="saved-label">${chrome('DUCKS SAVED', 'blue', 660, 44)}</h2>
    <strong class="result-saved result-cue" data-result-cue="saved-count">${result.savedDucks} / ${result.totalDucks}</strong>
    <h2 class="result-cue" data-result-cue="chain-label">${chrome('DUCK CHAIN', 'blue', 660, 44)}</h2>
    <strong class="result-chain result-cue" data-result-cue="chain-count">${result.longestChain}</strong>
    <span class="chain-bonus" hidden>−${(result.chainBonusMs / 1000).toFixed(2)}</span>
    <div class="result-award-anchor" role="img" aria-label="${result.medal} medal"></div>
    <div class="result-record" hidden>${chrome('NEW RECORD', 'pink', 620, 42)}</div>
    <div class="result-choices" hidden><button class="result-retry" data-action="retry">${triangle('left')}<span>${chrome('RETRY', 'pink', 620, 78)}</span></button></div>
  </div><div class="result-controls">${footer(true, 'result-continue', 'SKIP')}</div><span class="sr-only">Final time ${timecode(result.finalTimeMs)}. Ducks saved ${result.savedDucks} of ${result.totalDucks}. Longest chain ${result.longestChain}. ${result.medal} medal. Press Enter to skip the award sequence.</span>`;
}
