import { useEffect, useRef } from 'react';
import type { HubConnection } from '@microsoft/signalr';
import type { IVideoProvider } from '../player/types';
import type { PlaybackState } from '../../types/room';

const HEARTBEAT_MS = 3000;
const DRIFT_TOLERANCE_S = 1.5;
const INITIATOR_IGNORE_MS = 400;

interface Options {
  connection: HubConnection | null;
  provider: IVideoProvider | null;
  serverNow: () => number;
  clockReady: boolean;
  selfConnectionId: string | null;
}

export interface PlayerSyncApi {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  setSource: (sourceJson: string) => Promise<void>;
}

export function usePlayerSync(opts: Options): PlayerSyncApi {
  const { connection, provider, serverNow, clockReady, selfConnectionId } = opts;
  const applyingRef = useRef(false);
  const lastLocalActionRef = useRef(0);

  // --- PlaybackUpdate ---
  useEffect(() => {
    if (!connection) return;
    const handler = async (dto: PlaybackState) => {
      if (!provider) return;

      // Игнорируем эхо своего же действия — избегаем двойных reload для VK/Rutube
      const isSelf = dto.initiatorConnectionId && dto.initiatorConnectionId === selfConnectionId;
      if (isSelf && Date.now() - lastLocalActionRef.current < INITIATOR_IGNORE_MS) return;

      applyingRef.current = true;
      try {
        const elapsed = dto.isPlaying
          ? Math.max(0, (serverNow() - dto.serverTimestampMs) / 1000)
          : 0;
        await applyPlayback(provider, dto.positionSeconds + elapsed, dto.isPlaying);
      } finally {
        setTimeout(() => { applyingRef.current = false; }, 300);
      }
    };
    connection.on('PlaybackUpdate', handler);
    return () => { connection.off('PlaybackUpdate', handler); };
  }, [connection, provider, serverNow, selfConnectionId]);

  // --- SyncCorrection ---
  useEffect(() => {
    if (!connection) return;
    const handler = async (dto: PlaybackState) => {
      if (!provider) return;
      applyingRef.current = true;
      try {
        const elapsed = dto.isPlaying
          ? Math.max(0, (serverNow() - dto.serverTimestampMs) / 1000)
          : 0;
        await provider.seek(dto.positionSeconds + elapsed);
      } finally {
        setTimeout(() => { applyingRef.current = false; }, 300);
      }
    };
    connection.on('SyncCorrection', handler);
    return () => { connection.off('SyncCorrection', handler); };
  }, [connection, provider, serverNow]);

  // --- Out-of-band state change (пользователь нажал в iframe) ---
  useEffect(() => {
    if (!connection || !provider || !clockReady) return;
    let lastPlaying: boolean | null = null;

    return provider.subscribeState((s) => {
      if (applyingRef.current) return;
      if (lastPlaying === null) { lastPlaying = s.isPlaying; return; }
      if (s.isPlaying === lastPlaying) return;
      lastPlaying = s.isPlaying;
      void connection.invoke('ReportState', s.positionSeconds, s.isPlaying).catch(() => {});
    });
  }, [connection, provider, clockReady]);

  // --- Heartbeat ---
  useEffect(() => {
    if (!connection || !provider || !clockReady) return;
    const interval = window.setInterval(async () => {
      if (applyingRef.current) return;
      const s = provider.getState();
      if (!s.durationSeconds) return;
      try {
        await connection.invoke('ReportState', s.positionSeconds, s.isPlaying);
      } catch { /* ignore */ }
    }, HEARTBEAT_MS);
    return () => window.clearInterval(interval);
  }, [connection, provider, clockReady]);

  const api = useRef<PlayerSyncApi>({
    async play() {
      if (!connection || !provider) return;
      lastLocalActionRef.current = Date.now();
      await connection.invoke('PlaybackPlay', provider.getState().positionSeconds);
    },
    async pause() {
      if (!connection || !provider) return;
      lastLocalActionRef.current = Date.now();
      await connection.invoke('PlaybackPause', provider.getState().positionSeconds);
    },
    async seek(seconds) {
      if (!connection) return;
      lastLocalActionRef.current = Date.now();
      await connection.invoke('PlaybackSeek', seconds);
    },
    async setSource(sourceJson) {
      if (!connection) return;
      lastLocalActionRef.current = Date.now();
      await connection.invoke('SetSource', sourceJson);
    },
  });

  return api.current;
}

async function applyPlayback(
  provider: IVideoProvider,
  targetPos: number,
  playing: boolean,
): Promise<void> {
  const current = provider.getState();
  const drift = Math.abs(current.positionSeconds - targetPos);

  // 1. Play/pause
  if (playing !== current.isPlaying) {
    if (playing) {
      if (provider.capabilities.play) {
        try { await provider.play(); } catch { /* iOS: жест */ }
      } else if (provider.capabilities.seekMode === 'reload') {
        // Read-only (Rutube): reload с autoplay=1 — единственный способ
        if (drift > 0.3) await provider.seek(targetPos);
        return;
      }
    } else {
      if (provider.capabilities.pause) {
        await provider.pause();
      } else if (provider.capabilities.seekMode === 'reload') {
        if (drift > 0.3) await provider.seek(targetPos);
        return;
      }
    }
  }

  // 2. Drift
  if (drift > DRIFT_TOLERANCE_S) {
    await provider.seek(targetPos);
  }
}
