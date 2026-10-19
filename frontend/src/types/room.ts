export interface Participant {
  connectionId: string;
  clientId: string;
  displayName: string;
  joinedAt: string;
}

export interface ChatMessage {
  id: string;
  authorClientId: string;
  authorName: string;
  text: string;
  sentAt: string;
}

export interface RoomSnapshot {
  roomId: string;
  participants: Participant[];
  chatHistory: ChatMessage[];
}

export interface PlaybackState {
  sourceJson: string | null;
  positionSeconds: number;
  isPlaying: boolean;
  serverTimestampMs: number;
  initiatorConnectionId: string | null;
}

export interface RoomSnapshot {
  roomId: string;
  participants: Participant[];
  chatHistory: ChatMessage[];
  playback: PlaybackState | null;
}
