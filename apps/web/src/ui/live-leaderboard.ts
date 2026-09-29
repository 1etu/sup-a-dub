import type { LiveLeaderboardMessage } from '@supadub/protocol';
import { flag, rankFinish } from './community';
import { escapeHtml } from './graphics';

export class LiveLeaderboard {
  private readonly host = document.createElement('aside');
  private latestAt = -1;
  constructor(root: HTMLElement) {
    this.host.className = 'live-leaderboard';
    this.host.setAttribute('aria-label', 'Pool leaderboard');
    this.host.hidden = true;
    root.append(this.host);
  }
  setVisible(visible: boolean): void {
    this.host.hidden = !visible;
  }
  update(message: LiveLeaderboardMessage, profiles: boolean): void {
    if (message.at <= this.latestAt) return;
    this.latestAt = message.at;
    const entries = [...message.entries];
    if (message.viewer && !entries.some((entry) => entry.id === message.viewer?.id))
      entries.push(message.viewer);
    this.host.innerHTML = `<h2>TOP DUCKS</h2>${entries
      .slice(0, 11)
      .map(
        (entry) =>
          `<button class="live-rank ${entry.id === message.viewer?.id ? 'viewer' : ''}" ${entry.profileId && profiles ? `data-profile="${escapeHtml(entry.profileId)}"` : 'disabled'}><b>${entry.rank}</b>${flag(entry.countryCode)}<span class="rank-name ${rankFinish(entry.rank)}">${escapeHtml(entry.name)}${entry.bot ? '<small> BOT</small>' : ''}</span><strong>${Math.round(entry.score).toLocaleString()}</strong></button>`,
      )
      .join('')}`;
  }
  reset(): void {
    this.latestAt = -1;
    this.host.replaceChildren();
  }
  dispose(): void {
    this.host.remove();
  }
}
