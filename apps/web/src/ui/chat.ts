import type { ChatMessage, CommandResult, CommandSuggestion, UserProfile } from '@supadub/protocol';
import { roleIcon } from '@supadub/assets';
import './chat.css';

export class PoolChat {
  private host = document.createElement('aside');
  private messages = new Map<string, ChatMessage>();
  private expanded = false;
  private user: UserProfile | null = null;
  private moderation = false;
  private generation = 0;
  private log: HTMLElement;
  private input: HTMLInputElement;
  private status: HTMLElement;
  private readonly suggestions = document.createElement('div');
  private commands: CommandSuggestion[] = [];
  private selectedCommand = 0;
  onSend: (text: string) => void = () => {};
  onFocus: (focused: boolean) => void = () => {};
  onDelete: (id: string) => Promise<void> = async () => {};
  onMute: (id: string) => Promise<void> = async () => {};

  constructor(root: HTMLElement) {
    this.host.className = 'pool-chat';
    this.host.hidden = true;
    this.host.innerHTML =
      '<button type="button" class="chat-toggle" aria-expanded="false">POOL CHAT <span>+</span></button><div class="chat-body" hidden><div class="chat-log" role="log" aria-label="Pool messages" aria-live="polite"></div><form class="chat-form"><label class="sr-only" for="pool-chat-input">Message</label><input id="pool-chat-input" maxlength="480" autocomplete="off" placeholder="MAKE A SPLASH..."><button type="submit">SEND</button></form><p class="chat-status" role="status"></p></div>';
    root.append(this.host);
    this.log = this.host.querySelector('.chat-log')!;
    this.input = this.host.querySelector('input')!;
    this.status = this.host.querySelector('.chat-status')!;
    this.suggestions.className = 'chat-commands';
    this.suggestions.id = 'chat-command-suggestions';
    this.suggestions.setAttribute('role', 'listbox');
    this.suggestions.hidden = true;
    this.host.querySelector('form')!.before(this.suggestions);
    this.input.setAttribute('aria-controls', this.suggestions.id);
    this.input.setAttribute('aria-autocomplete', 'list');
    this.input.addEventListener('input', () => {
      this.selectedCommand = 0;
      this.renderCommands();
    });
    this.host.querySelector('.chat-toggle')!.addEventListener('click', () => this.toggle());
    this.host.querySelector('form')!.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = this.input.value.trim();
      if (!this.user || !text) return;
      if ([...text].length > 240 || new TextEncoder().encode(text).length > 768) {
        this.status.textContent = 'Use up to 240 characters.';
        return;
      }
      this.onSend(text);
      this.input.value = '';
      this.renderCommands();
      this.status.textContent = '';
    });
    this.input.addEventListener('focus', () => this.onFocus(true));
    this.input.addEventListener('blur', () => this.onFocus(false));
    this.input.addEventListener('keydown', (event) => {
      const options = [...this.suggestions.querySelectorAll<HTMLButtonElement>('button')];
      if (options.length && ['ArrowDown', 'ArrowUp', 'Tab'].includes(event.code)) {
        event.preventDefault();
        if (event.code === 'Tab') options[this.selectedCommand]?.click();
        else {
          this.selectedCommand =
            (this.selectedCommand + (event.code === 'ArrowDown' ? 1 : options.length - 1)) % options.length;
          options.forEach((button, index) =>
            button.setAttribute('aria-selected', String(index === this.selectedCommand)),
          );
        }
      }
    });
  }

  setState(visible: boolean, user: UserProfile | null, moderation = false) {
    this.host.hidden = !visible;
    const changed =
      this.user?.id !== user?.id || this.user?.role !== user?.role || this.moderation !== moderation;
    this.user = user;
    this.moderation = moderation;
    if (changed) {
      this.generation++;
      this.status.textContent = '';
      this.render();
    }
    this.input.disabled = !user;
    this.host.querySelector<HTMLButtonElement>('[type=submit]')!.disabled = !user;
    this.input.placeholder = user ? 'MAKE A SPLASH...' : 'SIGN IN TO CHAT';
    if (!visible) this.input.blur();
  }

  toggle(value = !this.expanded) {
    this.expanded = value;
    this.host.querySelector<HTMLElement>('.chat-body')!.hidden = !value;
    const button = this.host.querySelector('button')!;
    button.setAttribute('aria-expanded', String(value));
    button.querySelector('span')!.textContent = value ? '−' : '+';
    if (!value) this.input.blur();
  }

  focus() {
    if (!this.host.hidden) {
      this.toggle(true);
      if (this.user) this.input.focus();
    }
  }
  error(message: string) {
    this.status.textContent = message;
  }
  setCommands(commands: CommandSuggestion[]): void {
    this.commands = commands.slice(0, 16);
    this.renderCommands();
  }
  commandResult(result: CommandResult): void {
    this.status.replaceChildren(document.createTextNode(result.message));
    this.status.classList.toggle('command-failed', !result.ok);
    if (result.suggestions) this.setCommands(result.suggestions);
    if (result.profileId || result.ranking) {
      const button = document.createElement('button');
      button.className = 'chat-result-link';
      if (result.profileId) {
        button.dataset.profile = result.profileId;
        button.textContent = 'VIEW PROFILE';
      }
      if (result.ranking) {
        button.dataset.rankingMode = result.ranking.mode;
        button.dataset.rankingPeriod = result.ranking.period;
        button.textContent = 'VIEW RANKING';
      }
      this.status.append(button);
    }
  }
  private renderCommands(): void {
    const prefix = this.input.value.trim().toLowerCase();
    const commands =
      prefix.startsWith('/') && !prefix.includes(' ')
        ? this.commands.filter((entry) => entry.command.startsWith(prefix)).slice(0, 8)
        : [];
    this.suggestions.hidden = !commands.length;
    this.input.setAttribute('aria-expanded', String(Boolean(commands.length)));
    this.suggestions.replaceChildren();
    for (const [index, command] of commands.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === this.selectedCommand));
      const title = document.createElement('strong');
      title.textContent = command.usage;
      const description = document.createElement('small');
      description.textContent = command.description;
      button.append(title, description);
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', () => {
        this.input.value = `${command.command} `;
        this.input.focus();
        this.renderCommands();
      });
      this.suggestions.append(button);
    }
  }
  remove(id: string) {
    this.messages.delete(id);
    this.render();
  }
  history(messages: ChatMessage[]) {
    this.messages.clear();
    for (const message of messages.slice(-100)) this.messages.set(message.id, message);
    this.render();
  }
  append(message: ChatMessage) {
    this.messages.set(message.id, message);
    this.render();
  }

  dispose(): void {
    this.generation++;
    this.messages.clear();
    this.commands = [];
    this.host.remove();
  }

  private render() {
    const threshold = Date.now() - 15 * 60 * 1000;
    for (const [id, message] of this.messages) if (message.createdAt < threshold) this.messages.delete(id);
    while (this.messages.size > 100) this.messages.delete(this.messages.keys().next().value!);
    const stick = this.log.scrollHeight - this.log.clientHeight - this.log.scrollTop < 35;
    const fragment = document.createDocumentFragment();
    for (const message of this.messages.values()) {
      const row = document.createElement('div');
      row.className = 'chat-message';
      row.dataset.messageId = message.id;
      const badge = document.createElement('img');
      badge.className = `chat-badge ${message.role}`;
      badge.src = roleIcon(message.role);
      badge.alt =
        message.role === 'admin' ? 'Pool admin' : message.role === 'moderator' ? 'Pool moderator' : 'Player';
      badge.width = 20;
      badge.height = 20;
      const name = document.createElement('b');
      name.textContent = message.name;
      const text = document.createElement('span');
      text.className = 'chat-text';
      text.textContent = message.text;
      row.append(badge, name, text);
      const roles = { player: 1, moderator: 2, admin: 3 };
      if (
        this.moderation &&
        this.user &&
        this.user.id !== message.senderId &&
        roles[this.user.role] > roles[message.role]
      ) {
        for (const [label, action] of [
          ['DELETE', () => this.onDelete(message.id)],
          ['MUTE', () => this.onMute(message.senderId)],
        ] as const) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'chat-moderate';
          button.textContent = label;
          button.title = `${label === 'DELETE' ? 'Delete message from' : 'Mute'} ${message.name}`;
          button.addEventListener('click', () => {
            const generation = this.generation;
            button.disabled = true;
            void action().catch((error) => {
              if (generation !== this.generation) return;
              this.error(error instanceof Error ? error.message : 'The action failed.');
              button.disabled = false;
            });
          });
          row.append(button);
        }
      }
      fragment.append(row);
    }
    this.log.replaceChildren(fragment);
    if (stick) this.log.scrollTop = this.log.scrollHeight;
  }
}
