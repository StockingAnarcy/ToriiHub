export type SourceDescriptor =
  | { kind: 'youtube'; videoId: string }
  | { kind: 'html5'; url: string; mediaType: 'audio' | 'video' }
  | { kind: 'vk'; embedUrl: string }
  | { kind: 'rutube'; embedUrl: string };

export interface PlayerState {
  isPlaying: boolean;
  positionSeconds: number;
  durationSeconds: number;
  rate: number;
  isBuffering: boolean;
}

export interface PlayerCapabilities {
  play: boolean;
  pause: boolean;
  /** Как реализуется seek: 'native' — провайдер умеет, 'reload' — перезагрузка iframe с t=, 'manual' — только кнопкой «Синхронизировать» */
  seekMode: 'native' | 'reload' | 'manual';
  reportTime: boolean;
  reportDuration: boolean;
  setRate: boolean;
}

export interface IVideoProvider {
  readonly providerId: SourceDescriptor['kind'];
  readonly capabilities: PlayerCapabilities;

  mount(container: HTMLElement, source: SourceDescriptor): Promise<void>;
  unmount(): Promise<void>;

  play(): Promise<void>;
  pause(): Promise<void>;
  seek(seconds: number): Promise<void>;
  setRate(rate: number): Promise<void>;

  getState(): PlayerState;
  subscribeState(cb: (state: PlayerState) => void): () => void;
}

export const IDLE_STATE: PlayerState = {
  isPlaying: false,
  positionSeconds: 0,
  durationSeconds: 0,
  rate: 1,
  isBuffering: false,
};
