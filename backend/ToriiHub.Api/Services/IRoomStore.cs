using ToriiHub.Api.Contracts;
using ToriiHub.Api.Models;

namespace ToriiHub.Api.Services;

public interface IRoomStore
{
    JoinResult Join(string roomId, string connectionId, string clientId, string displayName);
    LeaveResult? Leave(string connectionId);
    ChatMessageDto? AddMessage(string connectionId, string text);
    string? GetRoomId(string connectionId);  
    IReadOnlyCollection<string> GetActiveRoomIds();
    bool RemoveIfStale(string roomId, TimeSpan ttl);
    PlaybackStateDto? GetPlayback(string roomId);
    PlaybackStateDto? UpdatePlayback(string roomId, Action<PlaybackState> mutate);
}

public sealed record JoinResult(RoomSnapshot Snapshot, ParticipantDto Joined);

public sealed record LeaveResult(
    string RoomId,
    string ConnectionId,
    string ClientId,
    string DisplayName
);
