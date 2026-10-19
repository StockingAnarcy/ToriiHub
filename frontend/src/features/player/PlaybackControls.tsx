import { useEffect, useState } from 'react';
import type { IVideoProvider, PlayerState } from './types';

interface Props {
  provider: IVideoProvider | null;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (seconds: number) => void;
  disabled?: boolean;
}

export function PlaybackControls({ provider, onPlay, onPause, onSeek, disabled }: Props) {
  const [state, setState] = useState<PlayerState | null>(null);

  useEffect(() => {
    if (!provider) { setState(null); return; }
    setState(provider.getState());
    return provider.subscribeState(setState);
  }, [provider]);

  if (!provider || !state) return null;

  const canControl = provider.capabilities.play && provider.capabilities.pause;
  const duration = state.durationSeconds || 0;

  return (
    <div className="playback-controls">
      {canControl ? (
        <button
          disabled={disabled}
          onClick={() => state.isPlaying ? onPause() : onPlay()}
        >
          {state.isPlaying ? '⏸' : '▶'}
        </button>
      ) : (
        <span className="playback-controls__hint">Управление в плеере</span>
      )}
      <input
        type="range"
        min={0}
        max={Math.max(duration, 1)}
        step={0.5}
        value={Math.min(state.positionSeconds, duration || 1)}
        onChange={(e) => onSeek(Number(e.target.value))}
        disabled={!duration || disabled}
      />
      <span className="playback-controls__time">
        {formatTime(state.positionSeconds)} / {formatTime(duration)}
      </span>
    </div>
  );
}

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const sec = Math.floor(s);
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
}
