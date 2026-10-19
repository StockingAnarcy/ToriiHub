namespace ToriiHub.Api.Contracts;

public sealed record RoomSnapshot(
    string RoomId,
    IReadOnlyList<ParticipantDto> Participants,
    IReadOnlyList<ChatMessageDto> ChatHistory,
    PlaybackStateDto? Playback
);
