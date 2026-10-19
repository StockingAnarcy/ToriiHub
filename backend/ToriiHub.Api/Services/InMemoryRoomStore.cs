using System.Collections.Concurrent;
using ToriiHub.Api.Contracts;
using ToriiHub.Api.Models;

namespace ToriiHub.Api.Services;

public sealed class InMemoryRoomStore : IRoomStore
{
    private readonly ConcurrentDictionary<string, RoomState> _rooms = new();
    private readonly Dictionary<string, string> _connectionToRoom = new();
    private readonly object _lock = new();

    public JoinResult Join(string roomId, string connectionId, string clientId, string displayName)
    {
        lock (_lock)
        {
            // Если соединение уже было в другой комнате — сначала убираем оттуда
            if (_connectionToRoom.TryGetValue(connectionId, out var oldRoomId) && oldRoomId != roomId)
            {
                if (_rooms.TryGetValue(oldRoomId, out var oldRoom))
                {
                    oldRoom.Participants.Remove(connectionId);
                    oldRoom.LastActivity = DateTimeOffset.UtcNow;
                }
            }

            var room = _rooms.GetOrAdd(roomId, id => new RoomState { Id = id });

            // Лимит участников — проверяем только если это новая персона (не re-join после реконнекта)
            var existingByClient = room.Participants.Values
                .FirstOrDefault(p => p.ClientId == clientId);
            var isRejoin = existingByClient != null;

            if (!isRejoin && room.Participants.Count >= RoomState.MaxParticipants)
            {
                throw new InvalidOperationException($"Комната заполнена (макс. {RoomState.MaxParticipants})");
            }

            // При реконнекте старая запись (со старым connectionId) могла зависнуть до OnDisconnected.
            // Убираем её, чтобы не было дублей.
            if (existingByClient != null && existingByClient.ConnectionId != connectionId)
            {
                room.Participants.Remove(existingByClient.ConnectionId);
            }

            var participant = new RoomParticipant
            {
                ConnectionId = connectionId,
                ClientId = clientId,
                DisplayName = displayName
            };
            room.Participants[connectionId] = participant;
            room.LastActivity = DateTimeOffset.UtcNow;
            _connectionToRoom[connectionId] = roomId;

            var snapshot = new RoomSnapshot(
                roomId,
                room.Participants.Values.Select(ToDto).ToList(),
                room.ChatHistory.Select(ToDto).ToList(),
                ToPlaybackDto(room.Playback)
            );
            return new JoinResult(snapshot, ToDto(participant));
        }
    }

    public LeaveResult? Leave(string connectionId)
    {
        lock (_lock)
        {
            if (!_connectionToRoom.TryGetValue(connectionId, out var roomId)) return null;
            _connectionToRoom.Remove(connectionId);

            if (!_rooms.TryGetValue(roomId, out var room)) return null;
            if (!room.Participants.Remove(connectionId, out var participant)) return null;

            room.LastActivity = DateTimeOffset.UtcNow;
            return new LeaveResult(roomId, connectionId, participant.ClientId, participant.DisplayName);
        }
    }

    public ChatMessageDto? AddMessage(string connectionId, string text)
    {
        lock (_lock)
        {
            if (!_connectionToRoom.TryGetValue(connectionId, out var roomId)) return null;
            if (!_rooms.TryGetValue(roomId, out var room)) return null;
            if (!room.Participants.TryGetValue(connectionId, out var participant)) return null;

            var message = new ChatMessage
            {
                Id = Guid.NewGuid().ToString("N"),
                AuthorClientId = participant.ClientId,
                AuthorName = participant.DisplayName,
                Text = text
            };
            room.ChatHistory.Add(message);
            if (room.ChatHistory.Count > RoomState.MaxChatHistory)
            {
                room.ChatHistory.RemoveRange(0, room.ChatHistory.Count - RoomState.MaxChatHistory);
            }
            room.LastActivity = DateTimeOffset.UtcNow;

            return ToDto(message);
        }
    }

    public string? GetRoomId(string connectionId)
    {
        lock (_lock)
        {
            return _connectionToRoom.TryGetValue(connectionId, out var id) ? id : null;
        }
    }

    public IReadOnlyCollection<string> GetActiveRoomIds()
    {
        return _rooms.Keys.ToList();
    }

    public bool RemoveIfStale(string roomId, TimeSpan ttl)
    {
        lock (_lock)
        {
            if (!_rooms.TryGetValue(roomId, out var room)) return false;
            if (room.Participants.Count > 0) return false;
            if (DateTimeOffset.UtcNow - room.LastActivity < ttl) return false;

            _rooms.TryRemove(roomId, out _);
            return true;
        }
    }

    public PlaybackStateDto? GetPlayback(string roomId)
    {
        lock (_lock)
        {
            if (!_rooms.TryGetValue(roomId, out var room)) return null;
            return ToPlaybackDto(room.Playback);
        }
    }

    public PlaybackStateDto? UpdatePlayback(string roomId, Action<PlaybackState> mutate)
    {
        lock (_lock)
        {
            if (!_rooms.TryGetValue(roomId, out var room)) return null;
            mutate(room.Playback);
            room.LastActivity = DateTimeOffset.UtcNow;
            return ToPlaybackDto(room.Playback);
        }
    }

    private static PlaybackStateDto ToPlaybackDto(PlaybackState p) => new(
        p.SourceJson, p.PositionSeconds, p.IsPlaying,
        p.UpdatedAt.ToUnixTimeMilliseconds());

    private static ParticipantDto ToDto(RoomParticipant p) => new(
        p.ConnectionId, p.ClientId, p.DisplayName, p.JoinedAt);

    private static ChatMessageDto ToDto(ChatMessage m) => new(
        m.Id, m.AuthorClientId, m.AuthorName, m.Text, m.SentAt);
}
