import { useEffect, useLayoutEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRoomStore } from '../stores/roomStore';
import { getClientId } from '../lib/identity';

export function MessageList() {
  const messages = useRoomStore((s) => s.messages);
  const selfClientId = getClientId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  // Отслеживаем, был ли пользователь у нижней границы до добавления сообщения
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Автоскролл вниз при новом сообщении — только если были у нижней границы
  useEffect(() => {
    if (messages.length === 0) return;
    if (!wasAtBottomRef.current) return;
    virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
  }, [messages.length, virtualizer]);

  return (
    <div ref={scrollRef} className="message-list">
      {messages.length === 0 && (
        <div className="message-list__empty">Сообщений пока нет</div>
      )}
      <div
        className="message-list__inner"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const m = messages[item.index];
          const isMine = m.authorClientId === selfClientId;
          return (
            <div
              key={m.id}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="message-row"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <div className={`message${isMine ? ' is-mine' : ''}`}>
                {!isMine && <div className="message__author">{m.authorName}</div>}
                <div className="message__text">{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
