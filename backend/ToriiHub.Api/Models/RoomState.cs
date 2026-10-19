namespace ToriiHub.Api.Models;

public sealed class RoomState
{
    public const int MaxParticipants = 5;
    public const int MaxChatHistory = 200;

    public required string Id { get; init; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset LastActivity { get; set; } = DateTimeOffset.UtcNow;

    // Мутации — только под lock в InMemoryRoomStore
    public Dictionary<string, RoomParticipant> Participants { get; } = new();
    public List<ChatMessage> ChatHistory { get; } = new();
    public PlaybackState Playback { get; } = new();
}
