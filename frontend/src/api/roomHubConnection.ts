import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

/**
 * Единая точка создания SignalR-соединения.
 * Путь относительный — работает и через Vite-прокси в dev, и same-origin в prod.
 */
export function createRoomHubConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl('/hubs/room')
    // агрессивный реконнект в начале, мягкий backoff потом
    .withAutomaticReconnect([0, 1000, 2000, 5000, 10000, 30000])
    .configureLogging(LogLevel.Information)
    .build();
}
