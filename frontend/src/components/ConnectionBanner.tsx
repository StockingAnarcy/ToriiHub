import { useRoomStore } from '../stores/roomStore';

export function ConnectionBanner() {
  const status = useRoomStore((s) => s.status);
  const error = useRoomStore((s) => s.error);

  if (status === 'connected') return null;
  if (status === 'idle') return null;

  const label =
    status === 'connecting' ? 'Подключение…'
    : status === 'reconnecting' ? 'Переподключение…'
    : status === 'error' ? error ?? 'Соединение потеряно'
    : status;

  return <div className={`banner banner--${status}`}>{label}</div>;
}
