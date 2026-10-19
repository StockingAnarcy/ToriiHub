using Microsoft.AspNetCore.SignalR;
using ToriiHub.Api.Contracts;
using ToriiHub.Api.Models;
using ToriiHub.Api.Services;

namespace ToriiHub.Api.Hubs;

public sealed class RoomHub : Hub
{
    public const string RoomGroupPrefix = "room:";

    private readonly IRoomStore _store;
    private readonly ILogger<RoomHub> _logger;

    public RoomHub(IRoomStore store, ILogger<RoomHub> logger)
    {
        _store = store;
        _logger = logger;
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var leave = _store.Leave(Context.ConnectionId);
        if (leave != null)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomGroupPrefix + leave.RoomId);
            await Clients.Group(RoomGroupPrefix + leave.RoomId)
                .SendAsync("UserLeft", leave.ConnectionId, leave.ClientId);
            _logger.LogInformation("User {Name} ({Conn}) left room {Room}",
                leave.DisplayName, leave.ConnectionId, leave.RoomId);
        }

        if (exception != null)
        {
            _logger.LogWarning(exception, "Disconnected {Conn} due to exception", Context.ConnectionId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public Task<long> Ping() =>
    Task.FromResult(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());

    public async Task<RoomSnapshot> JoinRoom(string roomId, string displayName, string clientId)
    {
        var (normalizedRoomId, normalizedName) = ValidateAndNormalize(roomId, displayName, clientId);

        JoinResult result;
        try
        {
            result = _store.Join(normalizedRoomId, Context.ConnectionId, clientId, normalizedName);
        }
        catch (InvalidOperationException ex)
        {
            throw new HubException(ex.Message);
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, RoomGroupPrefix + normalizedRoomId);

        // Остальным в комнате — событие "кто-то вошёл"
        await Clients.OthersInGroup(RoomGroupPrefix + normalizedRoomId)
            .SendAsync("UserJoined", result.Joined);

        _logger.LogInformation("User {Name} ({Client}) joined room {Room}",
            normalizedName, clientId, normalizedRoomId);

        return result.Snapshot;
    }

    public async Task LeaveRoom()
    {
        var leave = _store.Leave(Context.ConnectionId);
        if (leave == null) return;

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomGroupPrefix + leave.RoomId);
        await Clients.Group(RoomGroupPrefix + leave.RoomId)
            .SendAsync("UserLeft", leave.ConnectionId, leave.ClientId);
    }

    public async Task SendMessage(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return;
        text = text.Trim();
        if (text.Length > 2000) text = text[..2000];

        var roomId = _store.GetRoomId(Context.ConnectionId);
        if (roomId == null) return;

        var message = _store.AddMessage(Context.ConnectionId, text);
        if (message == null) return;

        await Clients.Group(RoomGroupPrefix + roomId).SendAsync("MessageReceived", message);
    }

    public async Task SetSource(string sourceJson)
    {
        var roomId = _store.GetRoomId(Context.ConnectionId);
        if (roomId == null) return;

        var dto = _store.UpdatePlayback(roomId, p =>
        {
            p.SourceJson = sourceJson;
            p.PositionSeconds = 0;
            p.IsPlaying = false;
            p.UpdatedAt = DateTimeOffset.UtcNow;
        });
        if (dto != null) await BroadcastPlayback(roomId, dto);
    }

    public Task PlaybackPlay(double fromPosition) =>
        ApplyPlayback(p =>
        {
            p.PositionSeconds = fromPosition;
            p.IsPlaying = true;
            p.UpdatedAt = DateTimeOffset.UtcNow;
        });

    public Task PlaybackPause(double atPosition) =>
        ApplyPlayback(p =>
        {
            p.PositionSeconds = atPosition;
            p.IsPlaying = false;
            p.UpdatedAt = DateTimeOffset.UtcNow;
        });

    public Task PlaybackSeek(double toPosition) =>
        ApplyPlayback(p =>
        {
            p.PositionSeconds = toPosition;
            p.UpdatedAt = DateTimeOffset.UtcNow;
        });

    public async Task ReportState(double position, bool isPlaying)
    {
        var roomId = _store.GetRoomId(Context.ConnectionId);
        if (roomId == null) return;

        var current = _store.GetPlayback(roomId);
        if (current == null) return;

        var now = DateTimeOffset.UtcNow;

        // Кто-то нажал play/pause в самом iframe (актуально для Rutube)
        if (isPlaying != current.IsPlaying)
        {
            var updated = _store.UpdatePlayback(roomId, p =>
            {
                p.PositionSeconds = position;
                p.IsPlaying = isPlaying;
                p.UpdatedAt = now;
            });
            if (updated != null) await BroadcastPlayback(roomId, updated);
            return;
        }

        // Дрифт позиции — коррекция только этого клиента
        var expected = current.IsPlaying
            ? current.PositionSeconds + (now.ToUnixTimeMilliseconds() - current.ServerTimestampMs) / 1000.0
            : current.PositionSeconds;

        if (Math.Abs(position - expected) > 2.0)
        {
            await Clients.Caller.SendAsync("SyncCorrection", current);
        }
    }

    private async Task ApplyPlayback(Action<PlaybackState> mutate)
    {
        var roomId = _store.GetRoomId(Context.ConnectionId);
        if (roomId == null) return;
        var dto = _store.UpdatePlayback(roomId, mutate);
        if (dto != null) await BroadcastPlayback(roomId, dto);
    }

    private Task BroadcastPlayback(string roomId, PlaybackStateDto dto) =>
        Clients.Group(RoomGroupPrefix + roomId)
            .SendAsync("PlaybackUpdate", dto with { InitiatorConnectionId = Context.ConnectionId });

    private static (string roomId, string displayName) ValidateAndNormalize(
        string roomId, string displayName, string clientId)
    {
        if (string.IsNullOrWhiteSpace(clientId) || clientId.Length > 64)
            throw new HubException("Некорректный идентификатор клиента");

        if (string.IsNullOrWhiteSpace(roomId))
            throw new HubException("ID комнаты не может быть пустым");

        roomId = roomId.Trim().ToLowerInvariant();
        if (roomId.Length < 3 || roomId.Length > 64)
            throw new HubException("ID комнаты: 3–64 символа");
        if (!roomId.All(c => char.IsLetterOrDigit(c) || c == '-' || c == '_'))
            throw new HubException("ID комнаты: только буквы, цифры, '-' и '_'");

        if (string.IsNullOrWhiteSpace(displayName))
            throw new HubException("Никнейм не может быть пустым");

        displayName = displayName.Trim();
        if (displayName.Length > 32)
            throw new HubException("Никнейм: до 32 символов");

        return (roomId, displayName);
    }
}
