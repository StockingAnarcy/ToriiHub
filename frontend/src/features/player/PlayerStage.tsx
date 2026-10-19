import { useEffect, useRef, useState } from 'react';
import type { IVideoProvider, PlayerState, SourceDescriptor } from './types';
import { IDLE_STATE } from './types';
import { createProvider } from './createProvider';

interface Props {
  source: SourceDescriptor | null;
  onError?: (message: string) => void;
  onProviderReady?: (provider: IVideoProvider | null) => void;
}

export function PlayerStage({ source, onError, onProviderReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<IVideoProvider | null>(null);
  const [state, setState] = useState<PlayerState>(IDLE_STATE);
  const [caps, setCaps] = useState<IVideoProvider['capabilities'] | null>(null);

  useEffect(() => {
    if (!source || !containerRef.current) {
      setState(IDLE_STATE);
      setCaps(null);
      providerRef.current = null;
      onProviderReady?.(null);
      return;
    }

    const container = containerRef.current;
    let cancelled = false;
    let unsub: (() => void) | null = null;
    let provider: IVideoProvider | null = null;

    (async () => {
      try {
        provider = createProvider(source);
        await provider.mount(container, source);
        if (cancelled) {
          await provider.unmount();
          return;
        }
        providerRef.current = provider;
        setCaps(provider.capabilities);
        unsub = provider.subscribeState(setState);
        setState(provider.getState());
        onProviderReady?.(provider);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onError?.(msg);
        onProviderReady?.(null);
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
      providerRef.current = null;
      onProviderReady?.(null);
      if (provider) void provider.unmount();
    };
  }, [source, onError, onProviderReady]);

  return (
    <div className="player-stage">
      <div ref={containerRef} className="player-stage__mount" />

      {!source && (
        <div className="player-stage__empty">
          Вставь ссылку на YouTube, VK Video, Rutube или медиафайл
        </div>
      )}

      {source && (
        <div className="player-stage__hud">
          <span className="player-stage__kind">{source.kind}</span>
          <span className="player-stage__time">
            {formatTime(state.positionSeconds)} / {formatTime(state.durationSeconds)}
          </span>
        </div>
      )}

      {/* Debug-кнопки для ручной проверки адаптеров (на этапе 3 заменит PlaybackControls) */}
      {source && providerRef.current && (
        <div className="player-stage__debug">
          {caps?.play && (
            <button onClick={() => void providerRef.current?.play()} title="play">▶</button>
          )}
          {caps?.pause && (
            <button onClick={() => void providerRef.current?.pause()} title="pause">⏸</button>
          )}
          <button
            onClick={() => void providerRef.current?.seek(Math.max(0, state.positionSeconds + 10))}
            title="+10s"
          >
            +10
          </button>
          <button
            onClick={() => void providerRef.current?.seek(Math.max(0, state.positionSeconds - 10))}
            title="-10s"
          >
            −10
          </button>
        </div>
      )}

      {/* Подсказка для read-only провайдеров (Rutube) */}
      {source && caps && !caps.play && !caps.pause && (
        <div className="player-stage__readonly-hint">
          <span>▶/⏸ — вручную в плеере</span>
          <button
            onClick={() => {
              providerRef.current?.seek(state.positionSeconds).catch(() => {});
            }}
            title="Перезагрузить плеер с текущей позиции"
          >
            Синхронизировать
          </button>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
