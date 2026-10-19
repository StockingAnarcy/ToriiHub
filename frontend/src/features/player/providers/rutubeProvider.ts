import type { PlayerCapabilities, PlayerState } from '../types';
import { IframePlayerBase } from '../IframePlayerBase';

const RT_ORIGIN = 'https://rutube.ru';

interface RutubeEvent {
  type?: string;
  data?: {
    time?: number;
    currentTime?: number;
    duration?: number;
    status?: string;
    state?: string;
    isPlaying?: boolean;
  };
}

export class RutubeProvider extends IframePlayerBase {
  readonly providerId = 'rutube' as const;

  // Read-only: postMessage-команды Rutube игнорирует (проверено спайком).
  // Управление play/pause — только пользователем в самом iframe.
  // Seek — через reload с t=<seconds>, что работает.
  readonly capabilities: PlayerCapabilities = {
    play: false,
    pause: false,
    seekMode: 'reload',
    reportTime: true,
    reportDuration: true,
    setRate: false,
  };

  protected get allowedOrigins(): string[] {
    return [RT_ORIGIN];
  }

  protected buildSrc(startSeconds: number, playing: boolean): string {
    const url = new URL(this.baseEmbedUrl);
    if (startSeconds > 0) url.searchParams.set('t', Math.floor(startSeconds).toString());
    else url.searchParams.delete('t');
    if (playing) url.searchParams.set('autoplay', '1');
    else url.searchParams.delete('autoplay');
    return url.toString();
  }

  protected isInitEvent(data: unknown): boolean {
    const t = (data as RutubeEvent | null)?.type;
    return t === 'player:init' || t === 'player:ready' || t === 'player:canPlay';
  }

  protected parseEvent(data: unknown): Partial<PlayerState> | null {
    const d = data as RutubeEvent | null;
    if (!d || typeof d !== 'object' || typeof d.type !== 'string') return null;
    if (!d.type.startsWith('player:')) return null;

    const data2 = d.data ?? {};

    switch (d.type) {
      case 'player:currentTime':
        return {
          positionSeconds: Number(data2.currentTime ?? data2.time) || 0,
          durationSeconds: Number(data2.duration) || undefined,
        };
      case 'player:durationChange':
        return { durationSeconds: Number(data2.duration) || 0 };
      case 'player:changeState': {
        const status = data2.status ?? data2.state;
        if (status === 'playing') return { isPlaying: true, isBuffering: false };
        if (status === 'pause') return { isPlaying: false };
        if (status === 'seeking') return { isBuffering: true };
        if (status === 'seeked') return { isBuffering: false };
        return null;
      }
      case 'player:playStart':
        return {
          isPlaying: true,
          isBuffering: false,
          positionSeconds: Number(data2.currentTime) || undefined,
          durationSeconds: Number(data2.duration) || undefined,
        };
      case 'player:canPlay':
        return { isBuffering: false };
      default:
        return null;
    }
  }
}
