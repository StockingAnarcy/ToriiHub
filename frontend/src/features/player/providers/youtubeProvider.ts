import type {
  IVideoProvider,
  PlayerCapabilities,
  PlayerState,
  SourceDescriptor,
} from '../types';
import { IDLE_STATE } from '../types';
import { loadYouTubeApi } from './youtubeApi';

export class YouTubeProvider implements IVideoProvider {
  readonly providerId = 'youtube' as const;

  readonly capabilities: PlayerCapabilities = {
    play: true,
    pause: true,
    seekMode: 'native',
    reportTime: true,
    reportDuration: true,
    setRate: true,
  };

  private player: YT.Player | null = null;
  private target: HTMLDivElement | null = null;
  private listeners = new Set<(s: PlayerState) => void>();
  private pollTimer: number | null = null;
  private lastState: PlayerState = { ...IDLE_STATE };

  async mount(container: HTMLElement, source: SourceDescriptor): Promise<void> {
    if (source.kind !== 'youtube') throw new Error('source.kind must be youtube');
    await loadYouTubeApi();

    this.target = document.createElement('div');
    this.target.style.width = '100%';
    this.target.style.height = '100%';
    container.appendChild(this.target);

    await new Promise<void>((resolve, reject) => {
      this.player = new window.YT!.Player(this.target!, {
        videoId: source.videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            this.startPolling();
            this.refreshState();
            resolve();
          },
          onStateChange: () => this.refreshState(),
          onError: (e) => reject(new Error(`YouTube player error: ${e.data}`)),
        },
      });
    });
  }

  async unmount(): Promise<void> {
    this.stopPolling();
    try {
      this.player?.destroy();
    } catch {
      /* ignore */
    }
    this.player = null;
    this.target?.remove();
    this.target = null;
    this.lastState = { ...IDLE_STATE };
    this.listeners.clear();
  }

  async play(): Promise<void> {
    this.player?.playVideo();
  }

  async pause(): Promise<void> {
    this.player?.pauseVideo();
  }

  async seek(seconds: number): Promise<void> {
    this.player?.seekTo(seconds, true);
  }

  async setRate(rate: number): Promise<void> {
    this.player?.setPlaybackRate(rate);
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

  private startPolling(): void {
    this.pollTimer = window.setInterval(() => this.refreshState(), 250);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private refreshState(): void {
    if (!this.player) return;
    const ps = this.player.getPlayerState();
    const next: PlayerState = {
      isPlaying: ps === window.YT!.PlayerState.PLAYING,
      isBuffering: ps === window.YT!.PlayerState.BUFFERING,
      positionSeconds: this.safe(() => this.player!.getCurrentTime(), 0),
      durationSeconds: this.safe(() => this.player!.getDuration(), 0),
      rate: 1,
    };
    this.lastState = next;
    this.listeners.forEach((cb) => cb(next));
  }

  private safe<T>(fn: () => T, fallback: T): T {
    try {
      return fn();
    } catch {
      return fallback;
    }
  }
}
