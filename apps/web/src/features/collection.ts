import type { Wardrobe } from '../controllers/wardrobe';
import type { ClientContext, ClientFeature } from './contracts';
import { COLLECTION_TABS } from '../ui/collection-items';

export class CollectionFeature implements ClientFeature {
  constructor(
    private readonly context: ClientContext,
    private readonly wardrobe: Wardrobe,
  ) {}
  async action(name: string): Promise<boolean> {
    if (name === 'collection') {
      this.context.show('collection');
      await this.wardrobe.load();
      return true;
    }
    const tab = COLLECTION_TABS.find((entry) => name === `collection-${entry}`);
    if (tab) {
      this.context.state.collectionTab = tab;
      this.context.state.collectionPage = 0;
      this.context.refresh();
      return true;
    }
    if (name === 'collection-next' || name === 'collection-previous') {
      this.context.state.collectionPage = Math.max(
        0,
        (this.context.state.collectionPage ?? 0) + (name === 'collection-next' ? 1 : -1),
      );
      this.context.refresh();
      return true;
    }
    return false;
  }
  dispose(): void {
    this.wardrobe.reset();
  }
}
