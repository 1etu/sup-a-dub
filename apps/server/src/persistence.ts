import type { PracticeResult, ProgressGrant } from '@supadub/protocol';
import type { EquipResult, ProgressBatch } from './progression';
import type { Store } from './store';
import type { ProfileEdit, ControlPreferencesEdit } from '@supadub/protocol';
import type { ControlPreferencesResult } from './control-preferences';
import type { ProfileResult } from './profiles';
import type { ModerationTask, ModerationExecution } from './moderation';
import { mergeRankingObservations, type RankingObservation } from './rankings';
import { allowedSessionAccount } from './accounts';
import type { EquipRequest } from '@supadub/cosmetics';

export type PersistenceTask =
  | { kind: 'maintenance' }
  | { kind: 'progress'; batch: ProgressBatch }
  | ({
      kind: 'equip';
      userId: string;
      sessionHash?: string;
      guestId?: string;
    } & ({ edit: EquipRequest } | { itemId: string; revision: number }))
  | { kind: 'abandon'; userId: string; runId: string }
  | { kind: 'practice'; userId: string; result: PracticeResult };

export type CommunityTask =
  | { kind: 'rankings'; observations: RankingObservation[] }
  | { kind: 'profile'; sessionHash: string; edit: ProfileEdit; guestId?: string }
  | { kind: 'controls'; sessionHash: string; edit: ControlPreferencesEdit; guestId?: string }
  | { kind: 'moderation'; task: ModerationTask };
type Result =
  ProgressGrant | EquipResult | ProfileResult | ControlPreferencesResult | ModerationExecution | null;
type Pending = {
  id: number;
  task: PersistenceTask | CommunityTask;
  resolve: (result: Result) => void;
  reject: (error: Error) => void;
  followers: number;
};

export function executeTask(store: Store, task: PersistenceTask | CommunityTask): Result {
  if (task.kind === 'maintenance') {
    store.prune();
    store.progression.prune();
    store.rankings.prune();
    store.moderation.prune();
  }
  if (task.kind === 'progress') return store.progression.apply(task.batch);
  if (task.kind === 'equip') {
    if (
      task.sessionHash &&
      allowedSessionAccount(store.db, task.sessionHash, task.guestId)?.id !== task.userId
    )
      return { ok: false, status: 401, error: 'Sign in to change your duck.' };
    return 'edit' in task
      ? store.progression.equip(task.userId, task.edit)
      : store.progression.equip(task.userId, task.itemId, task.revision);
  }
  if (task.kind === 'abandon') store.progression.abandonPractice(task.userId, task.runId);
  if (task.kind === 'practice') store.savePractice(task.userId, task.result);
  if (task.kind === 'rankings') store.rankings.observe(task.observations);
  if (task.kind === 'profile')
    return store.profiles.edit(task.sessionHash, task.edit, Date.now(), task.guestId);
  if (task.kind === 'controls')
    return store.controls.edit(task.sessionHash, task.edit, Date.now(), task.guestId);
  if (task.kind === 'moderation') return store.moderation.apply(task.task);
  return null;
}

export class PersistenceQueue {
  private readonly worker: Worker | null;
  private readonly pending: Pending[] = [];
  private active: Pending | null = null;
  private serial = 0;
  private ready = false;
  private failure: Error | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private closeTask: Promise<void> | null = null;
  private closedWorker: (() => void) | null = null;

  constructor(private readonly store: Store) {
    if (store.path === ':memory:') {
      this.worker = null;
      this.ready = true;
      return;
    }
    this.worker = new Worker(new URL('./persistence-worker.ts', import.meta.url).href);
    this.worker.onmessage = (
      event: MessageEvent<{
        id?: number;
        ready?: boolean;
        closed?: boolean;
        result?: Result;
        error?: string;
      }>,
    ) => {
      if (event.data.closed) {
        this.closedWorker?.();
        return;
      }
      if (event.data.ready) {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.ready = true;
        this.pump();
        return;
      }
      if (!this.ready && event.data.error) {
        this.fail(new Error(event.data.error));
        return;
      }
      if (!this.active || event.data.id !== this.active.id) return;
      const active = this.active;
      this.active = null;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      if (event.data.error) active.reject(new Error(event.data.error));
      else active.resolve(event.data.result ?? null);
      this.pump();
    };
    this.worker.onerror = () => this.fail(new Error('Progress could not be saved.'));
    this.timer = setTimeout(() => this.fail(new Error('The save worker could not start.')), 10000);
    this.worker.postMessage({ type: 'init', path: store.path });
  }

  get size(): number {
    return this.pending.length + Number(!!this.active);
  }

  private fail(error: Error): void {
    this.failure = error;
    if (this.timer) clearTimeout(this.timer);
    this.active?.reject(error);
    this.active = null;
    for (const pending of this.pending.splice(0)) pending.reject(error);
    this.worker?.terminate();
  }

  enqueue(task: PersistenceTask | CommunityTask): Promise<Result> {
    if (this.closed || this.failure)
      return Promise.reject(this.failure ?? new Error('The save queue is closed.'));
    return new Promise((resolve, reject) => {
      if (task.kind === 'rankings') {
        const existing = this.pending.find((entry) => entry.task.kind === 'rankings');
        if (existing && existing.task.kind === 'rankings') {
          if (existing.followers >= 256) {
            reject(new Error('The save queue is full. Try again soon.'));
            return;
          }
          try {
            existing.task = {
              kind: 'rankings',
              observations: mergeRankingObservations(existing.task.observations, task.observations),
            };
          } catch (error) {
            reject(error);
            return;
          }
          existing.followers++;
          const priorResolve = existing.resolve;
          const priorReject = existing.reject;
          existing.resolve = (result) => {
            priorResolve(result);
            resolve(result);
          };
          existing.reject = (error) => {
            priorReject(error);
            reject(error);
          };
          return;
        }
      }
      if (task.kind === 'progress') {
        const existing = this.pending.find(
          (entry) => entry.task.kind === 'progress' && entry.task.batch.runId === task.batch.runId,
        );
        if (existing) {
          if (existing.followers >= 256) {
            reject(new Error('The save queue is full. Try again soon.'));
            return;
          }
          existing.followers++;
          const priorResolve = existing.resolve;
          const priorReject = existing.reject;
          const replace =
            existing.task.kind === 'progress' && existing.task.batch.sequence < task.batch.sequence;
          if (replace) existing.task = task;
          existing.resolve = (result) => {
            priorResolve(replace ? { awards: [], skinIds: [], itemIds: [] } : result);
            resolve(replace ? result : { awards: [], skinIds: [], itemIds: [] });
          };
          existing.reject = (error) => {
            priorReject(error);
            reject(error);
          };
          return;
        }
      }
      if (this.size >= 256) {
        reject(new Error('The save queue is full. Try again soon.'));
        return;
      }
      this.pending.push({ id: ++this.serial, task, resolve, reject, followers: 0 });
      this.pump();
    });
  }

  private pump(): void {
    if (!this.ready || this.active || this.failure) return;
    const pending = this.pending.shift();
    if (!pending) return;
    this.active = pending;
    if (this.worker) {
      this.timer = setTimeout(() => this.fail(new Error('The save request timed out.')), 10000);
      this.worker.postMessage({ type: 'task', id: pending.id, task: pending.task });
    } else {
      setTimeout(() => {
        try {
          pending.resolve(executeTask(this.store, pending.task));
        } catch (error) {
          pending.reject(error instanceof Error ? error : new Error('Progress could not be saved.'));
        }
        this.active = null;
        this.pump();
      }, 0);
    }
  }

  async drain(): Promise<void> {
    const deadline = Date.now() + 11000;
    while (this.size && Date.now() < deadline) await Bun.sleep(5);
    if (this.size) this.fail(new Error('The save queue could not finish.'));
    if (this.failure) throw this.failure;
  }

  close(): Promise<void> {
    this.closeTask ??= this.finishClose();
    return this.closeTask;
  }

  private async finishClose(): Promise<void> {
    this.closed = true;
    try {
      await this.drain();
      if (this.worker && !this.failure)
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('The save database could not close.')), 5000);
          this.closedWorker = () => {
            clearTimeout(timeout);
            resolve();
          };
          this.worker!.postMessage({ type: 'close' });
        });
    } finally {
      this.worker?.terminate();
    }
  }
}
