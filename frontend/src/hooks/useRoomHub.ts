import { useEffect, useMemo, useRef } from 'react';
import type { HubConnection } from '@microsoft/signalr';
import { createRoomHubConnection } from '../api/roomHubConnection';
import { useRoomStore } from '../stores/roomStore';
import { getClientId } from '../lib/identity';
import type { ChatMessage, Participant, RoomSnapshot } from '../types/room';

export interface RoomHubApi {
  sendMessage: (text: string) => Promise<void>;
  leave: () => Promise<void>;
  connection: HubConnection | null;
  selfConnectionId: string | null;
}

export function useRoomHub(
  roomId: string,
  displayName: string,
): RoomHubApi {
  const connectionRef = useRef<HubConnection | null>(null);

  useEffect(() => {
    const store = useRoomStore.getState();
    store.reset();
    store.setStatus('connecting');

    const clientId = getClientId();
    const connection = createRoomHubConnection();
    connectionRef.current = connection;

    let disposed = false;

    // --- Event handlers ---
    connection.on('UserJoined', (p: Participant) => {
      useRoomStore.getState().addParticipant(p);
    });
    connection.on('UserLeft', (connectionId: string) => {
      useRoomStore.getState().removeParticipant(connectionId);
    });
    connection.on('MessageReceived', (m: ChatMessage) => {
      useRoomStore.getState().addMessage(m);
    });

    // --- Lifecycle handlers ---
    connection.onreconnecting(() => {
      useRoomStore.getState().setStatus('reconnecting');
    });

    connection.onreconnected(async () => {
      try {
        await joinRoom();
        useRoomStore.getState().setStatus('connected');
      } catch (err) {
        useRoomStore.getState().setError(errorMessage(err));
        useRoomStore.getState().setStatus('error');
      }
    });

    connection.onclose((err) => {
      if (disposed) return;
      useRoomStore.getState().setStatus('error');
      if (err) useRoomStore.getState().setError(errorMessage(err));
    });

    const joinRoom = async () => {
      const snapshot = await connection.invoke<RoomSnapshot>(
        'JoinRoom',
        roomId,
        displayName,
        clientId,
      );
      if (disposed) return;
      useRoomStore.getState().applySnapshot(snapshot);
      useRoomStore.getState().setSelfConnectionId(connection.connectionId ?? null);
    };

    // --- Start ---
    (async () => {
      try {
        await connection.start();
        if (disposed) {
          await connection.stop();
          return;
        }
        await joinRoom();
        if (!disposed) useRoomStore.getState().setStatus('connected');
      } catch (err) {
        if (disposed) return;
        useRoomStore.getState().setError(errorMessage(err));
        useRoomStore.getState().setStatus('error');
      }
    })();

    return () => {
      disposed = true;
      void connection.stop();
      useRoomStore.getState().reset();
    };
  }, [roomId, displayName]);

  return useMemo<RoomHubApi>(
    () => ({
      async sendMessage(text: string) {
        const conn = connectionRef.current;
        if (!conn || conn.state !== 'Connected') return;
        await conn.invoke('SendMessage', text);
      },
      async leave() {
        const conn = connectionRef.current;
        if (!conn || conn.state !== 'Connected') return;
        try {
          await conn.invoke('LeaveRoom');
        } finally {
          await conn.stop();
        }
      },
      connection: connectionRef.current,
      selfConnectionId: connectionRef.current?.connectionId ?? null,
    }),
    [],
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Неизвестная ошибка';
}
