# ToriiHub

Совместный просмотр видео + текстовый и голосовой чат для «своих».
2–5 человек в комнате, аудио-чат (mesh), адаптеры YouTube / VK Video / Rutube / HTML5.

## Стек
- **Backend:** ASP.NET Core 8 (Minimal API) + SignalR
- **Frontend:** Vite + React 18 + TypeScript + Zustand + React Router
- **Realtime:** SignalR (WebSocket) + WebRTC (голос, этап 5)
- **Deploy:** Caddy (auto-TLS) + Docker Compose

## Локальная разработка

Требуется: .NET 8 SDK, Node 20+.

```bash
# Terminal 1 — backend
cd backend
dotnet run --project ToriiHub.Api
# → http://localhost:5000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
# → http://localhost:5173