export {};

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }

  namespace YT {
    class Player {
      constructor(el: HTMLElement | string, options: PlayerOptions);
      playVideo(): void;
      pauseVideo(): void;
      seekTo(seconds: number, allowSeekAhead: boolean): void;
      getCurrentTime(): number;
      getDuration(): number;
      getPlayerState(): number;
      setPlaybackRate(rate: number): void;
      loadVideoById(videoId: string, startSeconds?: number): void;
      destroy(): void;
    }

    interface PlayerOptions {
      videoId?: string;
      width?: number | string;
      height?: number | string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (e: PlayerEvent) => void;
        onStateChange?: (e: PlayerEvent) => void;
        onError?: (e: PlayerEvent) => void;
      };
    }

    interface PlayerEvent {
      target: Player;
      data: number;
    }

    const PlayerState: {
      UNSTARTED: -1;
      ENDED: 0;
      PLAYING: 1;
      PAUSED: 2;
      BUFFERING: 3;
      CUED: 5;
    };
  }
}
