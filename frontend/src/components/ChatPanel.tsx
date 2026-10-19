import type { RoomHubApi } from '../hooks/useRoomHub';
import { ConnectionBanner } from './ConnectionBanner';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

export function ChatPanel({ hub }: { hub: RoomHubApi }) {
  return (
    <div className="chat-panel">
      <ConnectionBanner />
      <MessageList />
      <MessageInput onSend={hub.sendMessage} />
    </div>
  );
}
