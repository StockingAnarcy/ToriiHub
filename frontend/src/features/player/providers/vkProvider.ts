import type { PlayerCapabilities, PlayerState } from '../types';
import { IframePlayerBase } from '../IframePlayerBase';

const VK_ORIGIN = 'https://vkvideo.ru';
const VK_ALT_ORIGIN = 'https://vk.com';

interface VkEvent {
  event: string;
  state?: string;
  time?: number;
  duration?: number;
}

export class VkProvider extends IframePlayerBase {
  readonly providerId = 'vk' as const;

  readonly capabilities: PlayerCapabilities = {
    play: true,
    pause: true,
    seekMode: 'reload',
    reportTime: true,
    reportDuration: true,
    setRate: false,
  };

  protected get allowedOrigins(): string[] {
    return [VK_ORIGIN, VK_ALT_ORIGIN];
  }

  protected playMessages(): object[] {
    return [{ method: 'play' }];
  }

  protected pauseMessages(): object[] {
    return [{ method: 'pause' }];
  }

  protected buildSrc(startSeconds: number, playing: boolean): string {
    const url = new URL(this.baseEmbedUrl);
    if (url.hostname === 'vk.com' || url.hostname === 'm.vk.com') {
      url.hostname = 'vkvideo.ru';
    }
    url.searchParams.set('js_api', '1');
    if (startSeconds > 0) url.searchParams.set('t', Math.floor(startSeconds).toString());
    else url.searchParams.delete('t');
    if (playing) url.searchParams.set('autoplay', '1');
    else url.searchParams.delete('autoplay');
    return url.toString();
  }

  protected isInitEvent(data: unknown): boolean {
    return (data as VkEvent | null)?.event === 'inited';
  }

  protected parseEvent(data: unknown): Partial<PlayerState> | null {
    const d = data as VkEvent | null;
    if (!d || typeof d !== 'object' || !d.event) return null;

    switch (d.event) {
      case 'inited':
        return {
          isPlaying: false,
          isBuffering: false,
          positionSeconds: Number(d.time) || 0,
          durationSeconds: Number(d.duration) || 0,
        };
      case 'started':
      case 'resumed':
        return { isPlaying: true, isBuffering: false };
      case 'paused':
        return { isPlaying: false };
      case 'timeupdate':
        return {
          isPlaying: d.state === 'playing',
          isBuffering: false,
          positionSeconds: Number(d.time) || 0,
          durationSeconds: Number(d.duration) || undefined,
        };
      case 'seeked':
        return { positionSeconds: Number(d.time) || 0 };
      case 'ended':
        return { isPlaying: false };
      default:
        return null;
    }
  }
}
