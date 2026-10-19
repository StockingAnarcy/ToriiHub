import type {
  IVideoProvider,
  PlayerCapabilities,
  PlayerState,
  SourceDescriptor,
} from '../types';
import { IDLE_STATE } from '../types';

export class Html5Provider implements IVideoProvider {
  readonly providerId = 'html5' as const;

  readonly capabilities: PlayerCapabilities = {
    play: true,
    pause: true,
    seekMode: 'native',
    reportTime: true,
    reportDuration: true,
    setRate: true,
  };

  private element: HTMLMediaElement | null = null;
  private listeners = new Set<(s: PlayerState) => void>();
  private lastState: PlayerState = { ...IDLE_STATE };

  async mount(container: HTMLElement, source: SourceDescriptor): Promise<void> {
    if (source.kind !== 'html5') throw new Error('source.kind must be html5');

    const el = document.createElement(source.mediaType === 'audio' ? 'audio' : 'video');
    el.src = source.url;
    el.controls = true;
    el.preload = 'metadata';
    el.crossOrigin = 'anonymous';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.objectFit = 'contain';
    if (source.mediaType === 'audio') el.style.background = '#000';

    container.appendChild(el);
    this.element = el;

    const emit = () => this.refreshState();
    for (const ev of ['play', 'pause', 'seeking', 'seeked', 'durationchange',
                      'ratechange', 'waiting', 'playing', 'timeupdate'] as const) {
      el.addEventListener(ev, emit);
    }

    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        el.removeEventListener('loadedmetadata', onLoaded);
        el.removeEventListener('error', onError);
        resolve();
      };
      const onError = () => {
        el.removeEventListener('loadedmetadata', onLoaded);
        el.removeEventListener('error', onError);
        reject(new Error('Не удалось загрузить медиафайл'));
      };
      el.addEventListener('loadedmetadata', onLoaded);
      el.addEventListener('error', onError);
    });

    this.refreshState();
  }

  async unmount(): Promise<void> {
    if (this.element) {
      this.element.pause();
      this.element.removeAttribute('src');
      this.element.load();
      this.element.remove();
      this.element = null;
    }
    this.lastState = { ...IDLE_STATE };
    this.listeners.clear();
  }

  async play(): Promise<void> {
    await this.element?.play();
  }

  async pause(): Promise<void> {
    this.element?.pause();
  }

  async seek(seconds: number): Promise<void> {
    if (this.element) this.element.currentTime = seconds;
  }

  async setRate(rate: number): Promise<void> {
    if (this.element) this.element.playbackRate = rate;
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

  private refreshState(): void {
    const el = this.element;
    if (!el) return;
    const next: PlayerState = {
      isPlaying: !el.paused && !el.ended,
      isBuffering: el.readyState < 3 && !el.paused,
      positionSeconds: Number.isFinite(el.currentTime) ? el.currentTime : 0,
      durationSeconds: Number.isFinite(el.duration) ? el.duration : 0,
      rate: el.playbackRate,
    };
    this.lastState = next;
    this.listeners.forEach((cb) => cb(next));
  }
}
