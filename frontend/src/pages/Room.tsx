import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import type { HubConnection } from '@microsoft/signalr';
import { useRoomHub } from '../hooks/useRoomHub';
import { useRoomStore } from '../stores/roomStore';
import { getNickname } from '../lib/identity';
import { ChatPanel } from '../components/ChatPanel';
import { ParticipantList } from '../components/ParticipantList';
import { PlayerStage } from '../features/player/PlayerStage';
import { SourceInput } from '../features/player/SourceInput';
import { PlaybackControls } from '../features/player/PlaybackControls';
import { useClockSync } from '../features/sync/useClockSync';
import { usePlayerSync } from '../features/sync/usePlayerSync';
import type { IVideoProvider, SourceDescriptor } from '../features/player/types';

export default function Room() {
  const { roomId: rawRoomId = '' } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const nickname = getNickname();

  const status = useRoomStore((s) => s.status);
  const selfConnectionId = useRoomStore((s) => s.selfConnectionId);
  const serverPlayback = useRoomStore((s) => s.serverPlayback);

  // useRoomHub должен отдавать connection и selfConnectionId
  // (обнови hook на этапе 3 — см. ниже)
  const hub = useRoomHub(rawRoomId, nickname);
  const connection: HubConnection | null = (hub as unknown as { connection?: HubConnection | null }).connection ?? null;

  const { serverNow, ready: clockReady } = useClockSync(connection);

  const [source, setSource] = useState<SourceDescriptor | null>(null);
  const [provider, setProvider] = useState<IVideoProvider | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const sync = usePlayerSync({
    connection,
    provider,
    serverNow,
    clockReady,
    selfConnectionId,
  });

  // Синхронизируем локальный source с серверным (когда кто-то другой сменил источник)
  useEffect(() => {
    if (!serverPlayback?.sourceJson) return;
    try {
      const parsed = JSON.parse(serverPlayback.sourceJson) as SourceDescriptor;
      if (parsed?.kind && (!source || JSON.stringify(parsed) !== JSON.stringify(source))) {
        setSource(parsed);
      }
    } catch { /* ignore */ }
  }, [serverPlayback?.sourceJson]);

  const onSourceLoad = useCallback((s: SourceDescriptor) => {
    setPlayerError(null);
    setSource(s);
    void sync.setSource(JSON.stringify(s));
  }, [sync]);

  const onProviderReady = useCallback((p: IVideoProvider | null) => {
    setProvider(p);
  }, []);

  useEffect(() => {
    if (!nickname) navigate('/', { replace: true });
  }, [nickname, navigate]);

  const onLeave = async () => {
    await hub.leave();
    navigate('/');
  };

  if (!nickname) return null;

  return (
    <div className="room-page">
      <header className="room-header">
        <div className="room-header__left">
          <Link to="/" className="room-header__back">←</Link>
          <h1 className="room-header__title">{rawRoomId}</h1>
          <span className={`room-header__status room-header__status--${status}`}>{status}</span>
          {clockReady && <span className="room-header__sync">sync ok</span>}
        </div>
        <button className="room-header__leave" onClick={onLeave}>Выйти</button>
      </header>

      <main className="room-main">
        <section className="room-stage">
          <PlayerStage
            source={source}
            onError={(m) => setPlayerError(m)}
            onProviderReady={onProviderReady}
          />
          {playerError && (
            <div className="player-error">Не удалось загрузить: {playerError}</div>
          )}
          <PlaybackControls
            provider={provider}
            onPlay={sync.play}
            onPause={sync.pause}
            onSeek={sync.seek}
            disabled={!clockReady}
          />
          <SourceInput onLoad={onSourceLoad} current={source} />
          <ParticipantList />
        </section>

        <ChatPanel hub={hub} />
      </main>
    </div>
  );
}
