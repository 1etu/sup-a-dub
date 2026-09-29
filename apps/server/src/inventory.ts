import type { Database } from 'bun:sqlite';
import {
  STARTER_ITEMS,
  defaultLoadout,
  isSkin,
  isCosmetic,
  parseEquipRequest,
  validLoadout,
  type CosmeticId,
  type Loadout,
  type EquipRequest,
} from '@supadub/cosmetics';
import type { InventoryItem, InventoryResponse } from '@supadub/protocol';

export type EquipResult =
  { ok: true; inventory: InventoryResponse } | { ok: false; status: 400 | 401 | 403 | 409; error: string };

export class InventoryStore {
  constructor(private readonly db: Database) {}

  ensure(userId: string): void {
    this.db
      .query('INSERT OR IGNORE INTO inventory_accounts(user_id,loadout) VALUES (?,?)')
      .run(userId, JSON.stringify(defaultLoadout('gold')));
    const insert = this.db.query(
      'INSERT OR IGNORE INTO inventory_items(user_id,item_id,earned_at,source) VALUES (?,?,?,?)',
    );
    for (const item of STARTER_ITEMS) insert.run(userId, item, Date.now(), 'starter');
  }

  read(userId: string): InventoryResponse {
    const account = this.db
      .query<{ equipped_skin: string; loadout: string; revision: number }, [string]>(
        'SELECT equipped_skin,loadout,revision FROM inventory_accounts WHERE user_id = ?',
      )
      .get(userId);
    if (!account) throw new Error('This account has no collection.');
    const items = this.db
      .query<InventoryItem, [string]>(
        'SELECT item_id AS id,earned_at AS earnedAt,source FROM inventory_items WHERE user_id = ? ORDER BY earned_at,item_id',
      )
      .all(userId)
      .filter((item) => isCosmetic(item.id));
    const owned = new Set(items.map((item) => item.id));
    const avatar =
      isSkin(account.equipped_skin) && owned.has(account.equipped_skin) ? account.equipped_skin : 'gold';
    let loadout = defaultLoadout(avatar);
    try {
      const saved: unknown = JSON.parse(account.loadout);
      if (validLoadout(saved)) loadout = { ...saved, avatar, emotes: [...saved.emotes] };
    } catch {}
    for (const slot of ['head', 'face', 'neck', 'wake', 'celebration'] as const)
      if (loadout[slot] !== null && !owned.has(loadout[slot]!)) loadout[slot] = null;
    loadout.emotes = loadout.emotes.filter((id) => owned.has(id));
    return {
      revision: account.revision,
      equippedSkin: avatar,
      ownedSkinIds: items.map((item) => item.id).filter(isSkin),
      ownedItemIds: items.map((item) => item.id),
      loadout,
      items,
    };
  }

  equip(userId: string, request: EquipRequest | string, revision?: number): EquipResult {
    const edit = parseEquipRequest(typeof request === 'string' ? { itemId: request, revision } : request);
    if (!edit) return { ok: false, status: 400, error: 'Select a valid item and slot.' };
    return this.db
      .transaction((): EquipResult => {
        const current = this.read(userId);
        if (current.revision !== edit.revision)
          return { ok: false, status: 409, error: 'Your collection changed. Open it again.' };
        const chosen = edit.slot === 'emotes' ? edit.itemIds : edit.itemId ? [edit.itemId] : [];
        if (chosen.some((id) => !current.ownedItemIds.includes(id)))
          return { ok: false, status: 403, error: 'Earn this item before selecting it.' };
        const loadout: Loadout = { ...current.loadout, emotes: [...current.loadout.emotes] };
        if (edit.slot === 'emotes') loadout.emotes = [...edit.itemIds];
        else Object.assign(loadout, { [edit.slot]: edit.itemId });
        if (!validLoadout(loadout)) return { ok: false, status: 400, error: 'Select a valid item and slot.' };
        this.db
          .query(
            'UPDATE inventory_accounts SET equipped_skin = ?,loadout = ?,revision = revision + 1 WHERE user_id = ? AND revision = ?',
          )
          .run(loadout.avatar, JSON.stringify(loadout), userId, edit.revision);
        return { ok: true, inventory: this.read(userId) };
      })
      .immediate();
  }

  observeAvatar(userId: string, avatar: CosmeticId, at: number): number {
    if (
      isSkin(avatar) &&
      this.db
        .query('SELECT item_id FROM inventory_items WHERE user_id = ? AND item_id = ?')
        .get(userId, avatar)
    )
      this.db
        .query('INSERT OR IGNORE INTO inventory_avatar_uses(user_id,avatar_id,first_used_at) VALUES (?,?,?)')
        .run(userId, avatar, at);
    return this.db
      .query<{ count: number }, [string]>(
        'SELECT COUNT(*) AS count FROM inventory_avatar_uses WHERE user_id = ?',
      )
      .get(userId)!.count;
  }
}
