namespace ToriiHub.Api.Models;

public sealed class RoomParticipant
{
    public required string ConnectionId { get; init; }
    public required string ClientId { get; init; }
    public required string DisplayName { get; init; }
    public DateTimeOffset JoinedAt { get; init; } = DateTimeOffset.UtcNow;
}
