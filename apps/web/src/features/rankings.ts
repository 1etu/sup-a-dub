import { api } from '../api';
import type { ClientContext, ClientFeature } from './contracts';
import type { GameMode, RankingPeriod } from '@supadub/protocol';

export class RankingsFeature implements ClientFeature {
  private generation = 0;
  constructor(private readonly context: ClientContext) {}
  async action(name: string): Promise<boolean> {
    if (!['scores', 'refresh-scores'].includes(name)) return false;
    await this.load();
    return true;
  }
  async click(target: HTMLElement): Promise<boolean> {
    const period = target.dataset.rankingPeriod;
    const mode = target.dataset.rankingMode;
    if (!period && !mode) return false;
    if (period && ['day', 'week', 'all-time'].includes(period))
      this.context.state.rankingPeriod = period as RankingPeriod;
    if (mode && ['endless', 'practice'].includes(mode)) this.context.state.rankingMode = mode as GameMode;
    await this.load();
    return true;
  }
  private async load(): Promise<void> {
    const { state, show, refresh, fail } = this.context;
    const generation = ++this.generation;
    state.loading = true;
    show('scores');
    const currentView = this.context.checkpoint();
    const current = () => generation === this.generation && currentView();
    try {
      const ranking = await api.rankings(state.rankingMode, state.rankingPeriod);
      if (!current()) return;
      state.ranking = ranking;
      state.loading = false;
      if (state.screen === 'scores') refresh();
    } catch (error) {
      if (current()) {
        state.loading = false;
        fail(error);
      }
    }
  }
  dispose(): void {
    this.generation++;
  }
}
