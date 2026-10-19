import { useRoomStore } from '../stores/roomStore';

export function ParticipantList() {
  const participants = useRoomStore((s) => s.participants);
  const selfConn = useRoomStore((s) => s.selfConnectionId);

  return (
    <div className="participants">
      <span className="participants__count">{participants.length}/5</span>
      <ul className="participants__list">
        {participants.map((p) => (
          <li
            key={p.connectionId}
            className={`participants__chip${p.connectionId === selfConn ? ' is-self' : ''}`}
            title={p.displayName}
          >
            {p.displayName}
            {p.connectionId === selfConn && <span className="dot" />}
          </li>
        ))}
      </ul>
    </div>
  );
}
