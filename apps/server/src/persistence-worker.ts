import { Store } from './store';
import { executeTask, type PersistenceTask, type CommunityTask } from './persistence';

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent) => void;
  postMessage: (message: unknown) => void;
};
let store: Store | null = null;
scope.onmessage = (
  event: MessageEvent<{ type: string; path?: string; id?: number; task?: PersistenceTask | CommunityTask }>,
) => {
  try {
    if (event.data.type === 'init' && event.data.path && !store) {
      store = new Store(event.data.path);
      scope.postMessage({ ready: true });
    } else if (event.data.type === 'task' && store && event.data.task) {
      scope.postMessage({ id: event.data.id, result: executeTask(store, event.data.task) });
    } else if (event.data.type === 'close') {
      store?.close();
      store = null;
      scope.postMessage({ closed: true });
    }
  } catch (error) {
    scope.postMessage({
      id: event.data.id,
      error: error instanceof Error ? error.message : 'Progress could nt be saved.',
    });
  }
};
