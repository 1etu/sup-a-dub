import { ClientFeatureRouter } from './features/router';
import { Lifetime } from '@supadub/core';
import { ProfilesFeature } from './features/profiles';
import { RankingsFeature } from './features/rankings';
import { ModerationFeature } from './features/moderation';
import { ChatCommands } from './features/chat-commands';
import { CollectionFeature } from './features/collection';
import type { ClientContext } from './features/contracts';
import { AccountController } from './controllers/account';
import { SettingsController } from './controllers/settings-controller';
import { Wardrobe } from './controllers/wardrobe';
import { GameHud } from './controllers/game-hud';
import { GameFeedback } from './controllers/game-feedback';
import { ResultsController } from './controllers/results';
import { ControlsController, readControlPreferences } from './controllers/controls';
import { AccountControls } from './controllers/account-controls';
import { MusicDirector } from './controllers/music-director';
import { EmoteWheel } from './controllers/emotes';
import type { ActionEvent } from '@supadub/inputengine';
import { refreshControlPrompts, setPromptProvider } from './ui/control-prompts';
import { LiveLeaderboard } from './ui/live-leaderboard';
import { AudioEngine } from '@supadub/audioengine';
import {
  GameConnection,
  GameInput,
  GameScene,
  MenuMotion,
  PRACTICE_REPLAY_HANDOFF_MS,
} from '@supadub/gameengine';
import type { ControlState } from '@supadub/gameengine';
import { loadSpriteAssets, createGameGraphics, disposeSpriteResources } from '@supadub/assets/graphics';
import { GAME_AUDIO } from '@supadub/assets/sfx';
import type { ServerMessage, Skin, WorldSnapshot } from '@supadub/protocol';
import { api } from './api';
import { readSettings, saveSettings } from './settings';
import { renderScreen } from './ui/screens';
import { renderHud } from './ui/game-hud';
import type { Screen, ViewState } from './ui/screens';
import { escapeHtml } from './ui/graphics';
import { PoolChat } from './ui/chat';
import { isSkin, isCosmetic, STARTER_SKINS } from '@supadub/cosmetics';
import { ACHIEVEMENTS } from '@supadub/achievements';
import { captureMenuArt, createBootArt } from './menu-art';
import { MenuSurface } from './menu-surface';
import './styles.css';
import './ui/controls.css';
import './ui/outfit.css';
import './ui/game-hud.css';

class Supadub {
  private state: ViewState = {
    screen: 'main',
    communityReturn: 'main',
    featureFlags: {},
    profile: null,
    ranking: null,
    rankingMode: 'endless',
    rankingPeriod: 'day',
    mode: 'endless',
    user: null,
    settings: readSettings(),
    authRegister: false,
    result: null,
    adminPlayers: [],
    loading: false,
    error: '',
    bestScore: 0,
    practiceBest: null,
    online: 0,
    inventory: null,
    achievements: null,
    collectionTab: 'skins',
  };
  private scene!: GameScene;
  private input!: GameInput;
  private bindings = new ControlsController();
  private accountControls = new AccountControls({
    read: readControlPreferences,
    dirty: (key) => {
      try {
        return localStorage.getItem(`${key}:pending`) === '1';
      } catch {
        return false;
      }
    },
    markDirty: (key, dirty) => {
      try {
        if (dirty) localStorage.setItem(`${key}:pending`, '1');
        else localStorage.removeItem(`${key}:pending`);
      } catch {}
    },
    write: (key, preferences) => {
      try {
        localStorage.setItem(key, JSON.stringify(preferences));
      } catch {}
    },
    load: () => api.controlPreferences(),
    save: (edit) => api.saveControlPreferences(edit),
    apply: (preferences) => this.bindings.restore(preferences),
    status: (message, retry) => this.bindings.syncStatus(message, retry),
  });
  private audio = new AudioEngine({
    ...GAME_AUDIO,
    ambience: GAME_AUDIO.ambience?.filter((id) => id !== 'pool-music'),
  });
  private music = new MusicDirector(this.audio, this.state.settings.quality === 'low');
  private audioActivation?: Promise<void>;
  private pendingCue?: { name: string; expires: number };
  private visuals = createGameGraphics();
  private connection = new GameConnection();
  private canvas: HTMLCanvasElement;
  private overlay: HTMLElement;
  private hud: HTMLElement;
  private labels: HTMLElement;
  private shell: HTMLElement;
  private previousScreen: Screen = 'main';
  private snapshot: WorldSnapshot | null = null;
  private status = 'disconnected';
  private sequence = 0;
  private lastInput = 0;
  private lastFrame = 0;
  private lastHud = 0;
  private lastBoost = false;
  private controls: ControlState = { x: 0, z: 0, boost: false };
  private actionSequence = 0;
  private chat: PoolChat;
  private emotes: EmoteWheel;
  private lastEmote = -Infinity;
  private commands: ChatCommands;
  private liveLeaderboard: LiveLeaderboard;
  private features?: ClientFeatureRouter;
  private motion: MenuMotion;
  private menuSurface: MenuSurface;
  private menuReady = false;
  private transitioning = false;
  private selected = 0;
  private gameHud: GameHud;
  private readonly feedback = new GameFeedback(
    this.audio,
    (strength) => this.scene.effect(strength),
    (message) => this.toast(message),
  );
  private resultTimer = 0;
  private resultRecord = false;
  private readonly results = new ResultsController((pose) => this.scene?.setAwardPose(pose));
  private joinGeneration = 0;
  private viewEpoch = 0;
  private readonly events = new AbortController();
  private readonly lifetime = new Lifetime();
  private readonly context: ClientContext = {
    state: this.state,
    show: (screen, clearError) => this.show(screen, clearError),
    refresh: () => this.refresh(),
    fail: (error) => this.fail(error),
    confirm: () => this.audio.play('confirm'),
    checkpoint: () => {
      const epoch = this.viewEpoch;
      const userId = this.state.user?.id;
      const currentAccount = this.account.checkpoint();
      return () =>
        !this.disposed && epoch === this.viewEpoch && userId === this.state.user?.id && currentAccount();
    },
  };
  private readonly wardrobe = new Wardrobe(
    this.context,
    () => this.updateBusyControls(),
    () => this.audio.play('select'),
  );
  private readonly settings = new SettingsController(
    this.state.settings,
    this.audio,
    () => this.scene,
    () => this.refresh(),
    (low) => this.music.setQuality(low),
  );
  private readonly account = new AccountController(this.context, {
    reconnect: () => {
      this.connection.disconnect();
      this.connection.lobby();
    },
    refreshCommands: () => {
      this.commands.reset();
      if (this.state.featureFlags.chat) void this.commands.refresh();
    },
    loadProgress: () => this.wardrobe.load(),
    resetProgress: () => this.wardrobe.reset(),
    syncControls: (userId) => this.accountControls.switchAccount(userId),
  });
  private frameId = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;

  constructor(root: HTMLElement) {
    root.innerHTML =
      '<canvas id="pool-canvas" aria-label="Sup-a-Dub game pool"></canvas><div id="duck-labels"></div><div id="picture-mask" aria-hidden="true"></div><div id="game-hud" hidden></div><main id="screen-shell"><div id="screen"></div></main><div id="loading-screen" role="status"><b>SUP-a-DUB</b><span>FILLING THE POOL...</span></div>';
    this.canvas = root.querySelector('#pool-canvas')!;
    this.overlay = root.querySelector('#screen')!;
    this.hud = root.querySelector('#game-hud')!;
    this.gameHud = new GameHud(this.hud, this.state);
    this.labels = root.querySelector('#duck-labels')!;
    this.shell = root.querySelector('#screen-shell')!;
    setPromptProvider((action) => this.bindings.glyph(action));
    this.bindings.onPrompts = () => {
      refreshControlPrompts(root);
      this.menuSurface?.refresh();
    };
    this.bindings.onChange = () => {
      if (this.state.screen === 'controls') this.refresh();
    };
    this.bindings.onSave = (preferences) => this.accountControls.changed(preferences);
    this.accountControls.switchAccount(null);
    this.bindings.engine.events.on('action', (event) => this.controlAction(event));
    this.motion = new MenuMotion(root, this.visuals);
    this.menuSurface = new MenuSurface(
      this.shell,
      this.overlay,
      this.motion,
      () => this.state.settings.reducedMotion,
    );
    this.motion.onError = (error) => {
      this.menuSurface.recover();
      console.error('The menu renderer stopped.', error);
    };
    this.chat = new PoolChat(root);
    this.emotes = new EmoteWheel(root);
    this.emotes.onClose = () => {
      if (this.state.screen === 'playing') this.bindings.engine.setContext(this.state.mode);
    };
    this.emotes.onSend = (itemId) => {
      if (performance.now() - this.lastEmote < 3000) {
        this.toast('WAIT A MOMENT BEFORE ANOTHER EMOTE');
        return;
      }
      this.connection.send({ type: 'emote', itemId, controlEpoch: this.connection.controlEpoch });
      this.lastEmote = performance.now();
    };
    this.commands = new ChatCommands(this.chat, (message) => this.connection.send(message));
    this.liveLeaderboard = new LiveLeaderboard(root);
    this.chat.onSend = (text) => {
      if (text.startsWith('/')) this.commands.submit(text);
      else this.connection.send({ type: 'chat-send', clientMessageId: crypto.randomUUID(), text });
    };
    this.chat.onFocus = (focused) => {
      if (this.state.screen === 'playing')
        this.bindings.engine.setContext(focused ? 'chat' : this.state.mode);
      if (focused) {
        this.input?.reset();
        this.sendInput({ x: 0, z: 0, boost: false });
      }
    };
    this.chat.onDelete = async (id) => {
      if (!this.state.featureFlags.moderation || this.disposed) return;
      await api.moderate({ action: 'delete-message', targetId: id });
    };
    this.chat.onMute = async (id) => {
      if (!this.state.featureFlags.moderation || this.disposed) return;
      const current = this.context.checkpoint();
      await api.moderate({
        action: 'mute',
        targetId: id,
        reason: 'Pool chat rules violation',
        durationSeconds: 900,
      });
      if (current()) this.chat.error('Player muted for 15 minutes.');
    };
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(root);
    const signal = this.events.signal;
    root.addEventListener(
      'click',
      (event) => {
        void this.click(event);
      },
      { signal },
    );
    root.addEventListener(
      'submit',
      (event) => {
        void this.submit(event);
      },
      { signal },
    );
    root.addEventListener('input', (event) => this.settings.change(event.target as HTMLInputElement), {
      signal,
    });
    this.overlay.addEventListener(
      'pointerover',
      (event) => {
        const button = (event.target as HTMLElement).closest<HTMLElement>('[data-nav]');
        if (button) this.select(Number(button.dataset.nav), false);
      },
      { signal },
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden && this.state.screen === 'playing') this.show('pause');
        if (document.hidden) this.audio.suspend();
        else void this.unlock();
      },
      { signal },
    );
    for (const cleanup of [
      disposeSpriteResources,
      () => this.scene?.dispose(),
      () => this.motion.dispose(),
      () => this.menuSurface.dispose(),
      () => this.audio.dispose(),
      () => this.music.dispose(),
      () => this.input?.dispose(),
      () => this.bindings.dispose(),
      () => this.accountControls.dispose(),
      () => this.connection.disconnect(),
      () => this.wardrobe.reset(),
      () => this.account.dispose(),
      () => this.gameHud.dispose(),
      () => this.results.clear(),
      () => this.resizeObserver.disconnect(),
      () => this.liveLeaderboard.dispose(),
      () => this.chat.dispose(),
      () => this.emotes.dispose(),
      () => {
        void this.features
          ?.dispose()
          .catch((error: unknown) => console.error('Feature cleanup failed.', error));
      },
    ])
      this.lifetime.add(cleanup);
    window.addEventListener(
      'pagehide',
      () => {
        this.disposed = true;
        this.joinGeneration++;
        this.events.abort();
        cancelAnimationFrame(this.frameId);
        clearTimeout(this.resultTimer);
        try {
          this.lifetime.dispose();
        } catch (error) {
          console.error('Game cleanup failed.', error);
        }
      },
      { once: true, signal },
    );
  }

  async start() {
    try {
      this.audio.prepare();
      const readiness = Promise.all([
        loadSpriteAssets(),
        api.session().catch(() => null),
        document.fonts.load('64px "Supadub Display"'),
        api.features(),
      ]);
      void readiness.then(
        () => {
          if (this.disposed) disposeSpriteResources();
        },
        () => {},
      );
      this.shell.style.opacity = '0';
      const loading = document.querySelector<HTMLElement>('#loading-screen')!;
      loading.style.opacity = '0';
      const bootArtwork = await createBootArt();
      if (this.disposed) return;
      await this.motion.boot(readiness, bootArtwork, this.state.settings.reducedMotion);
      if (this.disposed) return;
      const [, session, , available] = await readiness;
      if (this.disposed) return;
      this.state.featureFlags = Object.freeze(
        Object.fromEntries(available.features.map((feature) => [feature.id, feature.enabled])),
      );
      this.state.practiceBest = this.state.settings.guestPracticeBest;
      if (session) {
        this.account.syncSession(session);
        if (isSkin(session.user?.equippedSkin)) this.state.settings.skin = session.user.equippedSkin;
      }
      this.features = new ClientFeatureRouter(this.context, this.state.featureFlags)
        .register('profiles', (context) => new ProfilesFeature(context))
        .register('rankings', (context) => new RankingsFeature(context))
        .register('moderation', (context) => new ModerationFeature(context))
        .register('chat', () => ({
          start: () => this.commands.start(),
          dispose: () => this.commands.dispose(),
        }))
        .register('collection', (context) => new CollectionFeature(context, this.wardrobe));
      await this.features.start();
      if (this.disposed) {
        await this.features.dispose();
        return;
      }
      this.scene = new GameScene(this.canvas, this.labels, this.visuals);
      this.input = new GameInput(this.canvas, this.bindings.engine);
      this.input.toWorld = (x, y) => this.scene.worldPoint(x, y);
      this.input.onAction = (action) => this.gameAction(action);
      this.input.onQuack = () => {
        this.audio.play('quack');
        this.scene.effect(0.7);
      };
      this.connection.onMessage = (message) => this.receive(message);
      let commandsNeedRefresh = false;
      this.connection.onStatus = (status) => {
        this.status = status;
        if (status === 'reconnecting' || status === 'disconnected') {
          this.commands.reset();
          commandsNeedRefresh = true;
          this.liveLeaderboard.reset();
        }
        if (status === 'connected' && commandsNeedRefresh) {
          commandsNeedRefresh = false;
          if (this.state.featureFlags.chat) void this.commands.refresh();
        }
        if (status === 'reconnecting') this.toast('RECONNECTING TO THE POOL...');
        if (status === 'disconnected') {
          if (this.state.loading && this.state.screen === 'duck') {
            this.state.loading = false;
            this.state.error = 'The connection closed. Try again.';
            this.refresh();
          }
          if (['playing', 'pause'].includes(this.state.screen))
            this.toast('CONNECTION LOST · OPEN THE MENU TO REJOIN');
        }
      };
      this.settings.apply();
      this.connection.lobby();
      if (this.state.user) void this.wardrobe.load();
      this.show('main');
      this.shell.dataset.screen = 'loading';
      this.resize();
      this.frameId = requestAnimationFrame((time) => this.frame(time));
      const artwork = await captureMenuArt(this.overlay);
      if (this.disposed) return;
      this.menuSurface.suspend(true);
      this.menuSurface.setEnabled(true);
      this.menuSurface.present(artwork);
      await this.motion.enter(artwork, this.state.settings.reducedMotion);
      if (this.disposed) return;
      this.menuReady = true;
      this.menuSurface.suspend(false);
      this.shell.dataset.screen = this.state.screen;
      document.querySelector('#loading-screen')?.remove();
      if (import.meta.env.DEV)
        Object.defineProperty(window, '__SUPADUB__', {
          get: () => ({
            screen: this.state.screen,
            mode: this.state.mode,
            snapshot: this.snapshot,
            playerId: this.connection.id,
            fps: this.motion.visible ? this.motion.resources.fps : this.scene.fps,
            drawCalls: this.motion.visible ? this.motion.resources.drawCalls : this.scene.drawCalls,
            triangles: this.scene.triangles,
            pixelRatio: this.scene.renderer.getPixelRatio(),
            geometries: this.scene.renderer.info.memory.geometries,
            textures: this.scene.renderer.info.memory.textures,
            latency: this.connection.latency,
            status: this.status,
            audio: this.audio.diagnostics,
            music: this.music.diagnostics,
            bubblePops: this.scene.bubblePopResources,
            inputSource: this.bindings.engine.activeSource,
            inputContext: this.bindings.engine.activeContext,
            replay: this.scene.replayStatus,
            menu: { visible: this.motion.visible, active: this.motion.active, ...this.motion.resources },
          }),
        });
    } catch (error) {
      if (this.disposed) return;
      this.motion.hide();
      const loading = document.querySelector('#loading-screen')!;
      (loading as HTMLElement).style.opacity = '1';
      loading.innerHTML = `<b>THE POOL COULD NOT OPEN</b><span>${escapeHtml(error instanceof Error ? error.message : error)}</span><button class="text-action" id="reload-game">TRY AGAIN</button>`;
      loading.querySelector('button')?.addEventListener('click', () => location.reload());
    }
  }

  private resize() {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const portrait = width / height <= 0.75;
    const scale = Math.min(width / (portrait ? 800 : 1280), height / (portrait ? 1100 : 720));
    this.shell.style.setProperty('--ui-scale', String(scale));
    this.scene?.resize();
    this.results.resize(width, height);
    this.menuSurface?.refresh();
  }

  private show(screen: Screen, clearError = true) {
    this.emotes.close();
    if (this.disposed) return;
    this.viewEpoch++;
    if (this.state.screen === 'playing' && screen !== 'playing') {
      this.sendInput({ x: 0, z: 0, boost: false });
    }
    if (screen === 'options' && !['options', 'controls', 'sound'].includes(this.state.screen))
      this.previousScreen = this.state.screen;
    if (clearError) this.state.error = '';
    this.state.screen = screen;
    this.bindings.engine.setContext(
      screen === 'playing' ? this.state.mode : screen === 'results' ? 'results' : 'menu',
    );
    if (screen !== 'controls') this.bindings.cancelCapture();
    this.scene.setScreen(screen);
    this.input.setActive(screen === 'playing');
    this.shell.classList.toggle('inactive', screen === 'playing');
    this.shell.dataset.screen = this.transitioning ? 'transition' : screen;
    this.hud.hidden = !['playing', 'pause'].includes(screen);
    this.chat.setState(
      Boolean(this.state.featureFlags.chat) && screen === 'playing' && this.state.mode === 'endless',
      this.state.user,
      Boolean(this.state.featureFlags.moderation),
    );
    this.liveLeaderboard.setVisible(
      Boolean(this.state.featureFlags.rankings) && screen === 'playing' && this.state.mode === 'endless',
    );
    this.overlay.innerHTML = renderScreen(this.state, {
      replaying: this.scene.replayStatus.playing,
      controls: screen === 'controls' ? this.bindings.render() : undefined,
    });
    if (screen === 'options')
      this.overlay
        .querySelector('.options-list')
        ?.insertAdjacentHTML(
          'afterbegin',
          '<label><span>CONTROLS</span><button data-action="controls">CHANGE KEYS ›</button></label>',
        );
    if (screen === 'options')
      this.overlay
        .querySelector('[data-setting="music"]')
        ?.insertAdjacentHTML('afterend', '<button class="mix-link" data-action="sound">MIX</button>');
    if (screen === 'results' && this.state.result) {
      this.scene.setAward(this.state.result.medal);
      this.results.start(
        this.overlay,
        this.state.result,
        this.resultRecord,
        performance.now() + PRACTICE_REPLAY_HANDOFF_MS,
      );
      this.results.update(performance.now(), this.state.settings.reducedMotion);
    } else this.results.clear();
    if (this.menuReady) {
      this.menuSurface.setEnabled(!['playing', 'pause', 'success', 'results'].includes(screen));
      this.menuSurface.refresh();
    }
    this.selected = 0;
    this.select(0, false);
    this.updateBusyControls();
    if (screen === 'playing') this.updateHud();
  }

  private refresh() {
    const controlsScroll = this.overlay.querySelector('#controls-scroll')?.scrollTop;
    this.show(this.state.screen, false);
    if (controlsScroll !== undefined) {
      const scroll = this.overlay.querySelector('#controls-scroll');
      if (scroll) scroll.scrollTop = controlsScroll;
      this.menuSurface.refresh();
    }
  }

  private updateBusyControls() {
    for (const button of this.overlay.querySelectorAll<HTMLButtonElement>(
      'button[data-skin], [data-equip-skin], #join-form button',
    )) {
      const skin = button.dataset.equipSkin;
      const owned: readonly string[] = this.state.inventory?.ownedSkinIds ?? STARTER_SKINS;
      button.disabled =
        this.state.loading ||
        this.wardrobe.busy ||
        Boolean(this.state.user && !this.state.featureFlags.collection && (skin || button.dataset.skin)) ||
        Boolean(skin && (!owned.includes(skin) || skin === this.state.settings.skin));
    }
  }

  private unlock(): Promise<void> {
    this.audioActivation ??= this.audio
      .unlock()
      .then(() => {
        if (this.disposed) return;
        this.audio.startAmbience();
        const cue = this.pendingCue;
        this.pendingCue = undefined;
        if (cue && performance.now() <= cue.expires) this.audio.play(cue.name);
      })
      .finally(() => {
        this.audioActivation = undefined;
      });
    return this.audioActivation;
  }

  private playCue(name: string) {
    if (this.audio.play(name)) return;
    this.pendingCue = { name, expires: performance.now() + 150 };
    void this.unlock();
  }

  private async click(event: MouseEvent) {
    if (this.disposed || this.transitioning || this.motion.active) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>('button, [data-action]');
    if (!target || target.hasAttribute('disabled')) return;
    if (
      this.motion.visible &&
      ![
        'tub',
        'duck',
        'help',
        'options',
        'controls',
        'sound',
        'auth',
        'scores',
        'main',
        'collection',
        'admin',
        'back',
      ].includes(target.dataset.action ?? '')
    ) {
      const bounds = target.getBoundingClientRect();
      const x = event.detail ? event.clientX : bounds.x + bounds.width / 2;
      const y = event.detail ? event.clientY : bounds.y + bounds.height / 2;
      this.motion.ripple(x / innerWidth, y / innerHeight);
    }
    void this.unlock();
    if (this.disposed) return;
    if (this.state.screen === 'controls') {
      if (target.dataset.controlSync === 'retry') {
        await this.accountControls.retry();
        return;
      }
      if (target.dataset.controlSync === 'reload') {
        await this.accountControls.reload();
        return;
      }
      if (this.bindings.click(target)) return;
    }
    if (target.dataset.skin) {
      if (!isSkin(target.dataset.skin)) return;
      await this.wardrobe.equip(target.dataset.skin);
      return;
    }
    if (target.dataset.setting) {
      this.settings.toggle(target.dataset.setting);
      return;
    }
    if (target.dataset.equipSkin && isSkin(target.dataset.equipSkin)) {
      await this.wardrobe.equip(target.dataset.equipSkin);
      return;
    }
    if (target.dataset.equipItem && isCosmetic(target.dataset.equipItem)) {
      await this.wardrobe.equipItem(target.dataset.equipItem);
      return;
    }
    const slot = target.dataset.clearSlot;
    if (slot === 'head' || slot === 'face' || slot === 'neck' || slot === 'wake' || slot === 'celebration') {
      await this.wardrobe.equipItem(null, slot);
      return;
    }
    if (await this.features?.click(target)) return;
    const action = target.dataset.action;
    if (action) await this.action(action);
  }

  private async action(action: string) {
    if (this.disposed || this.transitioning || this.motion.active) return;
    this.playCue(action === 'back' ? 'back' : 'confirm');
    const animate =
      !['playing', 'pause', 'success', 'results'].includes(this.state.screen) &&
      [
        'tub',
        'duck',
        'help',
        'options',
        'controls',
        'sound',
        'auth',
        'scores',
        'main',
        'collection',
        'admin',
        'back',
      ].includes(action);
    if (!animate) {
      await this.executeAction(action);
      return;
    }
    this.transitioning = true;
    this.menuSurface.suspend(true);
    try {
      const artwork = this.menuSurface.artwork ?? (await captureMenuArt(this.overlay));
      if (this.disposed) return;
      this.shell.style.opacity = '0';
      this.shell.style.pointerEvents = 'none';
      this.shell.inert = true;
      await this.motion.transition(
        artwork,
        async () => {
          if (this.disposed) return artwork;
          await this.executeAction(action);
          if (this.disposed) return artwork;
          const nextArtwork = await captureMenuArt(this.overlay);
          this.menuSurface.present(nextArtwork);
          return nextArtwork;
        },
        this.state.settings.reducedMotion,
      );
    } finally {
      this.shell.style.pointerEvents = '';
      this.shell.inert = false;
      this.transitioning = false;
      this.shell.dataset.screen = this.state.screen;
      this.menuSurface.suspend(false);
    }
  }

  private async executeAction(action: string) {
    if (this.disposed) return;
    if (await this.features?.action(action)) return;
    switch (action) {
      case 'main':
        this.show('main');
        break;
      case 'tub':
        this.show('tub');
        break;
      case 'duck':
        this.show('duck');
        break;
      case 'split':
        this.gameAction('split');
        break;
      case 'eject':
        this.gameAction('eject');
        break;
      case 'help':
        this.show('help');
        break;
      case 'options':
        this.show('options');
        break;
      case 'controls':
        this.show('controls');
        break;
      case 'sound':
        this.show('sound');
        break;
      case 'auth':
        this.show('auth');
        break;
      case 'confirm': {
        this.overlay.querySelector<HTMLButtonElement>('[data-nav].selected')?.click();
        break;
      }
      case 'back':
        this.back();
        break;
      case 'cycle-mode':
        this.state.mode = this.state.mode === 'endless' ? 'practice' : 'endless';
        this.refresh();
        break;
      case 'join':
        this.overlay.querySelector<HTMLFormElement>('#join-form')?.requestSubmit();
        break;
      case 'submit-auth':
        this.overlay.querySelector<HTMLFormElement>('#auth-form')?.requestSubmit();
        break;
      case 'toggle-register':
        this.state.authRegister = !this.state.authRegister;
        this.refresh();
        break;
      case 'sign-out':
        await this.account.signOut();
        break;
      case 'pause':
        this.show('pause');
        break;
      case 'resume':
        this.show('playing');
        break;
      case 'leave':
        this.leave();
        break;
      case 'quack':
        this.input.onQuack();
        break;
      case 'emote':
        this.openEmotes();
        break;
      case 'retry': {
        clearTimeout(this.resultTimer);
        if (this.state.result && this.status === 'connected') {
          this.connection.send({ type: 'restart-practice', runId: this.state.result.runId });
          this.state.result = null;
          this.scene.start('practice', this.connection.id);
          this.show('playing');
        } else await this.join(this.state.settings.name);
        break;
      }
      case 'result-continue':
        if (this.state.screen === 'results' && !this.results.skip()) await this.executeAction('retry');
        break;
    }
  }

  private back() {
    if (this.state.loading && this.state.screen === 'duck') {
      this.joinGeneration++;
      this.state.loading = false;
      this.connection.disconnect();
    }
    this.state.loading = false;
    switch (this.state.screen) {
      case 'title':
        this.show('main');
        break;
      case 'main':
        this.show('title');
        break;
      case 'playing':
        this.show('pause');
        break;
      case 'pause':
        this.show('playing');
        break;
      case 'options':
        this.show(this.previousScreen);
        break;
      case 'controls':
      case 'sound':
        this.show('options');
        break;
      case 'admin':
      case 'profile':
        this.show(this.state.communityReturn);
        break;
      case 'duck':
        this.show('tub');
        break;
      case 'results':
      case 'success':
        this.leave();
        break;
      default:
        this.show('main');
    }
  }

  private async submit(event: SubmitEvent) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    void this.unlock();
    if (this.disposed) return;
    if (form.id === 'join-form') {
      await this.join(String(data.get('name') ?? '').trim());
      return;
    }
    if (await this.features?.submit(form)) return;
    await this.account.submit(form);
  }

  private async join(name: string) {
    if (!name || name.length > 20 || this.state.loading || this.wardrobe.busy) return;
    this.state.settings.name = name;
    saveSettings(this.state.settings);
    this.state.loading = true;
    const generation = ++this.joinGeneration;
    this.state.result = null;
    this.snapshot = null;
    this.refresh();
    try {
      const session = await api.session();
      if (this.disposed || generation !== this.joinGeneration) return;
      this.account.syncSession(session);
      this.connection.connect({ name, skin: this.state.settings.skin, mode: this.state.mode });
    } catch (error) {
      if (generation === this.joinGeneration) {
        this.state.loading = false;
        this.fail(error);
      }
    }
  }

  private leave() {
    this.joinGeneration++;
    clearTimeout(this.resultTimer);
    this.connection.lobby();
    this.snapshot = null;
    this.liveLeaderboard.reset();
    this.state.loading = false;
    this.hud.innerHTML = '';
    this.show('main');
    const currentAccount = this.account.checkpoint();
    const generation = this.joinGeneration;
    void api
      .session()
      .then((session) => {
        if (!currentAccount() || generation !== this.joinGeneration) return;
        this.account.syncSession(session);
      })
      .catch(() => {});
  }

  private receive(message: ServerMessage) {
    if (this.disposed) return;
    switch (message.type) {
      case 'command-result':
        this.commands.receive(message);
        break;
      case 'live-leaderboard':
        this.liveLeaderboard.update(message, Boolean(this.state.featureFlags.profiles));
        break;
      case 'welcome':
        clearTimeout(this.resultTimer);
        this.state.loading = false;
        this.sequence = 0;
        this.actionSequence = 0;
        this.input.setMode(message.mode);
        this.scene.start(message.mode, message.id);
        this.hud.innerHTML = renderHud(message.mode);
        this.show('playing');
        this.audio.play('splash');
        break;
      case 'snapshot':
        this.snapshot = message;
        this.scene.updateSnapshot(message, performance.now() / 1000);
        break;
      case 'presence':
        this.state.online = message.online;
        {
          const counter = this.overlay.querySelector('#lobby-online-count');
          if (counter) counter.textContent = String(message.online);
        }
        break;
      case 'chat':
        this.chat.append(message.message);
        break;
      case 'chat-history':
        this.chat.history(message.messages);
        break;
      case 'chat-deleted':
        this.chat.remove(message.id);
        break;
      case 'emote':
        this.scene.emote(message.playerId, message.itemId);
        break;
      case 'achievement-earned':
        this.scene.celebrate();
        this.music.signal(0.3);
        for (const award of message.awards) {
          const definition = ACHIEVEMENTS.find((item) => item.id === award.id);
          this.toast(`${award.tier.toUpperCase()} MEDAL · ${definition?.name.toUpperCase() ?? award.id}`);
        }
        this.audio.play('achievement');
        void this.wardrobe.load();
        break;
      case 'run-ended':
        this.show('pause');
        this.overlay.innerHTML = `<section class="run-ended"><h1>WHAT A SPLASH!</h1><p>PEAK MASS ${Math.round(message.peakMass).toLocaleString()}</p><button class="text-action" data-action="retry">SPLASH AGAIN</button><button class="text-action" data-action="leave">BACK TO MENU</button></section>`;
        break;
      case 'action-result':
        if (!message.accepted && message.reason) this.toast(message.reason.toUpperCase());
        break;
      case 'event':
        this.music.signal(0.12);
        this.feedback.receive(message);
        break;
      case 'practice-complete':
        this.scene.celebrate();
        this.resultRecord =
          this.state.practiceBest === null || message.result.finalTimeMs < this.state.practiceBest;
        this.state.result = message.result;
        this.account.recordPracticeBest(message.result.finalTimeMs);
        this.show('success');
        this.audio.play('confirm');
        this.resultTimer = window.setTimeout(() => {
          if (this.state.screen === 'success' && this.state.result?.runId === message.result.runId)
            this.show('results');
        }, 2100);
        break;
      case 'error':
        if (message.code.toLowerCase().includes('emote')) {
          this.toast(message.message);
          return;
        }
        if (message.code === 'session_expired') this.account.expireSession();
        if (message.code.toLowerCase().includes('chat') || message.code.toLowerCase().includes('muted')) {
          this.chat.error(message.message);
          return;
        }
        clearTimeout(this.resultTimer);
        this.state.loading = false;
        if (['playing', 'pause', 'success', 'results'].includes(this.state.screen)) {
          this.connection.disconnect();
          this.show('duck');
        }
        this.state.error = message.message;
        this.refresh();
        break;
    }
  }

  private gameAction(action: 'split' | 'eject') {
    if (this.state.screen !== 'playing' || this.state.mode !== 'endless' || !this.connection.controlEpoch)
      return;
    let { x, z } = this.controls;
    const self = this.snapshot?.players.find((player) => player.id === this.connection.id);
    if (this.controls.target && self) {
      x = this.controls.target.x - self.x;
      z = this.controls.target.z - self.z;
    }
    const length = Math.hypot(x, z);
    if (length < 0.01) {
      x = Math.sin(self?.angle ?? 0);
      z = Math.cos(self?.angle ?? 0);
    } else {
      x /= length;
      z /= length;
    }
    this.connection.send({
      type: 'action',
      action,
      seq: ++this.actionSequence,
      commandId: crypto.randomUUID(),
      controlEpoch: this.connection.controlEpoch,
      x,
      z,
    });
  }

  private fail(error: unknown) {
    this.state.error = error instanceof Error ? error.message : 'The pool is unavailable. Try again.';
    this.refresh();
  }

  private select(index: number, sound = true) {
    const buttons = [...this.overlay.querySelectorAll<HTMLButtonElement>('[data-nav]')];
    if (!buttons.length) return;
    this.selected = (index + buttons.length) % buttons.length;
    buttons.forEach((button, position) => button.classList.toggle('selected', position === this.selected));
    this.motion.setSelection(this.selected);
    if (sound) this.playCue('select');
  }

  private controlAction(event: ActionEvent) {
    if (!this.scene || event.phase === 'release' || this.transitioning || this.motion.active) return;
    const action = event.action;
    if (this.emotes.visible) {
      if (action === 'back' || action === 'pause' || action === 'emote') this.emotes.close();
      else if (action === 'confirm') this.emotes.confirm();
      else if (action.startsWith('menu-'))
        this.emotes.move(action === 'menu-up' || action === 'menu-left' ? -1 : 1);
      return;
    }
    if (action === 'emote') {
      this.openEmotes();
      return;
    }
    if (action === 'back' || action === 'pause') {
      if (this.bindings.engine.activeContext === 'chat') this.chat.toggle(false);
      else this.back();
      return;
    }
    if (action === 'chat' && this.state.screen === 'playing') {
      this.chat.focus();
      return;
    }
    if (this.state.screen === 'playing') return;
    if (action === 'account') {
      void this.action('auth');
      return;
    }
    if (action === 'confirm') {
      void this.unlock();
      if (this.state.screen === 'results') {
        if (!this.results.skip()) void this.action('retry');
        return;
      }
      if (this.state.screen === 'title') {
        void this.action('main');
        return;
      }
      if (
        document.activeElement instanceof HTMLButtonElement &&
        this.overlay.contains(document.activeElement)
      )
        document.activeElement.click();
      else
        (
          this.overlay.querySelector<HTMLButtonElement>('[data-nav].selected') ??
          this.overlay.querySelector<HTMLButtonElement>('.console-footer button:not([data-action="auth"])')
        )?.click();
      return;
    }
    if (!action.startsWith('menu-')) return;
    void this.unlock();
    const horizontal = action === 'menu-left' || action === 'menu-right';
    const direction = action === 'menu-up' || action === 'menu-left' ? -1 : 1;
    if (horizontal && this.state.screen === 'tub') {
      void this.action('cycle-mode');
      return;
    }
    if (horizontal && this.state.screen === 'duck') {
      const skins: Skin[] = ['gold', 'yellow', 'pink', 'mint'];
      void this.wardrobe.equip(skins[(skins.indexOf(this.state.settings.skin) + direction + 4) % 4]!);
      return;
    }
    if (this.overlay.querySelector('[data-nav]')) {
      this.select(this.selected + direction);
      this.overlay.querySelector<HTMLButtonElement>('[data-nav].selected')?.focus({ preventScroll: true });
      return;
    }
    const buttons = [...this.overlay.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(
      (button) => button.getClientRects().length,
    );
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = buttons[(index + direction + buttons.length) % buttons.length]!;
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.playCue('select');
  }

  private sendInput(input: ControlState) {
    if (!this.connection.id) return;
    this.connection.send({
      type: 'input',
      seq: ++this.sequence,
      ...input,
      controlEpoch: this.connection.controlEpoch || undefined,
    });
  }

  private openEmotes(): void {
    if (this.state.screen !== 'playing') return;
    if (!this.state.user) {
      this.toast('SIGN IN TO SEND EMOTES');
      return;
    }
    if (!this.state.featureFlags.chat) return;
    const loadout =
      this.snapshot?.players.find((player) => player.id === this.connection.id)?.loadout ??
      this.state.inventory?.loadout;
    if (!loadout?.emotes.length) {
      this.toast('ADD AN EMOTE IN YOUR COLLECTION');
      return;
    }
    this.input.reset();
    this.bindings.engine.setContext('emote');
    this.sendInput({ x: 0, z: 0, boost: false });
    this.emotes.open(loadout.emotes);
  }

  private updateHud() {
    this.gameHud.update(
      this.snapshot,
      this.connection.id,
      this.status,
      this.connection.latency,
      this.scene.fps,
    );
  }

  private toast(message: string) {
    this.gameHud.toast(message);
  }

  private frame(milliseconds: number) {
    if (this.disposed) return;
    this.bindings.adapter.poll();
    const time = milliseconds / 1000;
    const dt = Math.min(0.05, this.lastFrame ? time - this.lastFrame : 1 / 60);
    this.lastFrame = time;
    const input = this.input.read(this.scene.playerScreenPosition());
    if (this.state.mode === 'endless' && !input.target && Math.hypot(input.x, input.z) > 0.01) {
      const self = this.snapshot?.players.find((player) => player.id === this.connection.id);
      if (self) input.target = { x: self.x + input.x * 32, z: self.z + input.z * 32 };
    }
    this.controls = input;
    this.music.update(time, {
      screen: this.state.screen,
      mode: this.state.mode,
      snapshot: this.snapshot,
      playerId: this.connection.id,
      movement: Math.hypot(input.x, input.z),
    });
    if (time - this.lastInput >= 1 / 30) {
      this.sendInput(input);
      this.lastInput = time;
    }
    if (input.boost && !this.lastBoost && this.state.mode === 'endless') this.audio.play('boost');
    this.lastBoost = input.boost;
    this.results.update(milliseconds, this.state.settings.reducedMotion);
    if (!this.motion.visible) this.scene.render(time, dt, input);
    if (time - this.lastHud >= 0.1) {
      this.updateHud();
      this.lastHud = time;
    }
    this.frameId = requestAnimationFrame((next) => this.frame(next));
  }
}

void new Supadub(document.querySelector('#app')!).start();
