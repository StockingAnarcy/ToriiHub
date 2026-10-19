import { create } from 'zustand';
import type { ChatMessage, Participant, RoomSnapshot } from '../types/room';

export type RoomStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

interface RoomStore {
  status: RoomStatus;
  error: string | null;
  participants: Participant[];
  messages: ChatMessage[];
  selfConnectionId: string | null;
  serverPlayback: PlaybackState | null;

  setStatus: (status: RoomStatus) => void;
  setError: (error: string | null) => void;
  setSelfConnectionId: (id: string | null) => void;
  applySnapshot: (snapshot: RoomSnapshot) => void;
  addParticipant: (p: Participant) => void;
  removeParticipant: (connectionId: string) => void;
  addMessage: (m: ChatMessage) => void;
  reset: () => void;
}

const initial = {
  status: 'idle' as RoomStatus,
  error: null as string | null,
  participants: [] as Participant[],
  messages: [] as ChatMessage[],
  selfConnectionId: null as string | null,
  serverPlayback: null,
};

export const useRoomStore = create<RoomStore>((set) => ({
  ...initial,

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setSelfConnectionId: (id) => set({ selfConnectionId: id }),

  applySnapshot: (snapshot) =>
  set({
    participants: snapshot.participants,
    messages: snapshot.chatHistory,
    serverPlayback: snapshot.playback ?? null,
  }),

  addParticipant: (p) =>
    set((state) => {
      // дедуп по connectionId, но допускаем один и тот же clientId с разными conn
      const others = state.participants.filter(
        (x) => x.connectionId !== p.connectionId && x.clientId !== p.clientId,
      );
      return { participants: [...others, p] };
    }),

  removeParticipant: (connectionId) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.connectionId !== connectionId),
    })),

  addMessage: (m) =>
    set((state) => {
      if (state.messages.some((x) => x.id === m.id)) return state;
      return { messages: [...state.messages, m] };
    }),

  reset: () => set(initial),
}));
