import type {
  IVideoProvider,
  PlayerCapabilities,
  PlayerState,
  SourceDescriptor,
} from './types';
import { IDLE_STATE } from './types';

const INIT_TIMEOUT_MS = 15_000;

/**
 * База для провайдеров на iframe + postMessage (VK, Rutube).
 *
 * Наследник реализует:
 *  - buildSrc() — URL с js_api / t / autoplay
 *  - isInitEvent() — определение события «плеер готов»
 *  - parseEvent() — маппинг события в partial PlayerState
 *  - allowedOrigins — домены, от которых принимаем postMessage
 *  - playMessages()/pauseMessages() — набор сообщений для postMessage (пусто если capability false)
 *
 * seek() в базе всегда через reload iframe с t=<seconds> — это единственный
 * универсально работающий способ для VK/Rutube.
 */
export abstract class IframePlayerBase implements IVideoProvider {
  abstract readonly providerId: SourceDescriptor['kind'];
  abstract readonly capabilities: PlayerCapabilities;

  protected iframe: HTMLIFrameElement | null = null;
  protected listeners = new Set<(s: PlayerState) => void>();
  protected lastState: PlayerState = { ...IDLE_STATE };
  private messageHandler: ((e: MessageEvent) => void) | null = null;

  protected baseEmbedUrl = '';
  protected wantPlaying = false;

  private initResolver: (() => void) | null = null;
  private initTimeoutId: number | null = null;

  // --- Абстрактное ---

  abstract buildSrc(startSeconds: number, playing: boolean): string;
  abstract isInitEvent(data: unknown): boolean;
  abstract parseEvent(data: unknown): Partial<PlayerState> | null;
  abstract get allowedOrigins(): string[];

  protected playMessages(): object[] { return []; }
  protected pauseMessages(): object[] { return []; }

  // --- IVideoProvider ---

  async mount(container: HTMLElement, source: SourceDescriptor): Promise<void> {
    if (source.kind !== this.providerId) {
      throw new Error(`${this.providerId}: source.kind mismatch`);
    }
    this.baseEmbedUrl = (source as { embedUrl: string }).embedUrl;

    this.iframe = document.createElement('iframe');
    this.iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    this.iframe.allowFullscreen = true;
    this.iframe.style.width = '100%';
    this.iframe.style.height = '100%';
    this.iframe.style.border = '0';
    container.appendChild(this.iframe);

    this.messageHandler = (e) => this.onMessage(e);
    window.addEventListener('message', this.messageHandler);

    await this.loadWith(0, false);
  }

  async unmount(): Promise<void> {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.iframe?.remove();
    this.iframe = null;
    this.baseEmbedUrl = '';
    this.lastState = { ...IDLE_STATE };
    this.listeners.clear();

    if (this.initTimeoutId !== null) {
      window.clearTimeout(this.initTimeoutId);
      this.initTimeoutId = null;
    }
    this.initResolver = null;
  }

  async play(): Promise<void> {
    if (!this.capabilities.play) return;
    this.wantPlaying = true;
    const msgs = this.playMessages();
    msgs.forEach((m, i) => {
      window.setTimeout(() => this.postToFrame(m), i * 100);
    });
  }

  async pause(): Promise<void> {
    if (!this.capabilities.pause) return;
    this.wantPlaying = false;
    const msgs = this.pauseMessages();
    msgs.forEach((m, i) => {
      window.setTimeout(() => this.postToFrame(m), i * 100);
    });
  }

  async seek(seconds: number): Promise<void> {
    if (!this.iframe) return;
    if (this.capabilities.seekMode === 'manual') return;
    if (this.capabilities.seekMode === 'native') return;

    // 'reload': перезагружаем iframe с t=<seconds>, сохраняя play/pause состояние
    const wasPlaying = this.lastState.isPlaying;
    await this.loadWith(seconds, wasPlaying);
  }

  async setRate(_rate: number): Promise<void> {
    // Не поддерживается для VK/Rutube
  }

  getState(): PlayerState {
    return this.lastState;
  }

  subscribeState(cb: (state: PlayerState) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  // --- internals ---

  private loadWith(startSeconds: number, playing: boolean): Promise<void> {
    if (!this.iframe) return Promise.reject(new Error('iframe не смонтирован'));

    // Резолвим предыдущий ожидающий init, если он был (смена источника / повторный seek)
    this.resolveInit();

    this.wantPlaying = playing;

    return new Promise<void>((resolve, reject) => {
      this.initResolver = resolve;
      this.initTimeoutId = window.setTimeout(() => {
        this.initResolver = null;
        this.initTimeoutId = null;
        reject(new Error(`${this.providerId}: таймаут инициализации`));
      }, INIT_TIMEOUT_MS);

      this.iframe!.src = this.buildSrc(startSeconds, playing);
    });
  }

  private resolveInit(): void {
    if (this.initTimeoutId !== null) {
      window.clearTimeout(this.initTimeoutId);
      this.initTimeoutId = null;
    }
    const resolver = this.initResolver;
    this.initResolver = null;
    resolver?.();
  }

  private postToFrame(msg: object): void {
    if (!this.iframe?.contentWindow) return;
    for (const origin of this.allowedOrigins) {
      try {
        this.iframe.contentWindow.postMessage(msg, origin);
      } catch {
        /* ignore */
      }
    }
  }

  private onMessage(event: MessageEvent): void {
    if (import.meta.env.DEV) {
      console.debug(`[${this.providerId}] ← ${event.origin} ${JSON.stringify(event.data)?.slice(0, 200)}`);
    }
    if (event.source !== this.iframe?.contentWindow) return;
    if (!this.allowedOrigins.includes(event.origin)) return;

    if (this.isInitEvent(event.data)) {
      this.resolveInit();
      // Если после reload нужно было играть, но VK/Rutube не начал сам —
      // добиваем postMessage play (сработает, только если capability.play)
      if (this.wantPlaying && this.capabilities.play) {
        window.setTimeout(() => {
          if (!this.lastState.isPlaying) {
            this.postToFrame({ method: 'play' });
          }
        }, 500);
      }
    }

    const patch = this.parseEvent(event.data);
    if (patch) {
      this.lastState = { ...this.lastState, ...patch };
      this.listeners.forEach((cb) => cb(this.lastState));
    }
  }
}
