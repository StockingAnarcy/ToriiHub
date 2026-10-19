import { useState, type KeyboardEvent } from 'react';
import { useRoomStore } from '../stores/roomStore';

interface Props {
  onSend: (text: string) => Promise<void>;
}

export function MessageInput({ onSend }: Props) {
  const [text, setText] = useState('');
  const status = useRoomStore((s) => s.status);
  const disabled = status !== 'connected';

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    await onSend(trimmed);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="message-input">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={disabled ? 'Нет соединения…' : 'Сообщение…'}
        disabled={disabled}
        rows={1}
        maxLength={2000}
      />
      <button onClick={submit} disabled={disabled || !text.trim()}>
        Отправить
      </button>
    </div>
  );
}
