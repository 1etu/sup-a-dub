import { Acknowledgments } from '@supadub/network';
import type { ClientMessage, CommandResult } from '@supadub/protocol';
import { api } from '../api';
import type { PoolChat } from '../ui/chat';

export class ChatCommands {
  private readonly replies = new Acknowledgments<CommandResult>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private generation = 0;
  private refreshGeneration = 0;
  private disposed = false;
  constructor(
    private readonly chat: Pick<PoolChat, 'setCommands' | 'commandResult' | 'error'>,
    private readonly send: (message: ClientMessage) => void,
  ) {}
  start(): void {
    if (this.disposed) return;
    if (!this.timer) this.timer = setInterval(() => this.replies.expire(), 500);
    void this.refresh();
  }
  async refresh(): Promise<void> {
    if (this.disposed) return;
    const generation = ++this.refreshGeneration;
    const result = await api.commands().catch(() => ({ suggestions: [] }));
    if (this.disposed || generation !== this.refreshGeneration) return;
    this.chat.setCommands(result.suggestions);
  }
  submit(text: string): void {
    if (this.disposed) return;
    const generation = this.generation;
    try {
      const request = this.replies.request();
      void request.result
        .then((result) => {
          if (!this.disposed && generation === this.generation) this.chat.commandResult(result);
        })
        .catch((error: unknown) => {
          if (!this.disposed && generation === this.generation)
            this.chat.error(error instanceof Error ? error.message : 'The command failed.');
        });
      this.send({ type: 'command', requestId: request.id, text });
    } catch (error) {
      this.chat.error(error instanceof Error ? error.message : 'The command queue is full.');
    }
  }
  receive(message: CommandResult): void {
    if (!this.disposed) this.replies.accept(message.requestId, message);
  }
  reset(): void {
    this.generation++;
    this.refreshGeneration++;
    this.replies.reset();
    if (!this.disposed) this.chat.setCommands([]);
  }
  dispose(): void {
    this.disposed = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.reset();
  }
}
