import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HubConnection } from '@microsoft/signalr';
import { createRoomHubConnection } from '../api/roomHubConnection';
import { getNickname, setNickname } from '../lib/identity';

type Status = 'connecting' | 'connected' | 'error';

export default function Home() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('connecting');
  const [pong, setPong] = useState('');
  const [roomId, setRoomId] = useState('');
  const [nickname, setNicknameState] = useState(getNickname());
  const [conn, setConn] = useState<HubConnection | null>(null);

  useEffect(() => {
    const connection = createRoomHubConnection();
    setConn(connection);
    connection.onreconnecting(() => setStatus('connecting'));
    connection.onreconnected(() => setStatus('connected'));
    connection.onclose(() => setStatus('error'));

    connection
    .start()
    .then(async () => {
      setStatus('connected');

      // Ping — smoke-test; если он упадёт, соединение всё равно живо
      try {
        const result = await connection.invoke<number>('Ping');
        setPong(`server time: ${new Date(result).toLocaleTimeString()}`);
      } catch (err) {
        console.warn('Ping failed (не критично)', err);
      }
    })
    .catch((err) => {
      console.error('SignalR start failed', err);
      setStatus('error');
    });

    return () => {
      void connection.stop();
    };
  }, []);

  const canJoin =
    status === 'connected' &&
    roomId.trim().length >= 3 &&
    nickname.trim().length > 0;

  const join = () => {
    if (!canJoin) return;
    setNickname(nickname.trim());
    navigate(`/room/${encodeURIComponent(roomId.trim())}`);
  };

  return (
    <main className="container">
      <h1>ToriiHub</h1>
      <p className="muted">Этап 1 — комнаты и текстовый чат</p>

      <div className="card">
        <div className="row">
          <span>SignalR</span>
          <span className={`status status--${status}`}>{status}</span>
        </div>
        {pong && (
          <div className="row">
            <span>Echo</span>
            <code>{pong}</code>
          </div>
        )}
      </div>

      <div className="card">
        <label htmlFor="nickname">Никнейм</label>
        <input
          id="nickname"
          value={nickname}
          onChange={(e) => setNicknameState(e.target.value)}
          placeholder="Как тебя звать?"
          maxLength={32}
          autoComplete="nickname"
        />

        <label htmlFor="roomId">ID комнаты</label>
        <input
          id="roomId"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value.trim())}
          placeholder="my-room"
          maxLength={64}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />

        <button disabled={!canJoin} onClick={join}>
          Войти
        </button>
      </div>
    </main>
  );
}
