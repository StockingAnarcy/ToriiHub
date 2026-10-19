namespace ToriiHub.Api.Contracts;

public sealed record PlaybackStateDto(
    string? SourceJson,
    double PositionSeconds,
    bool IsPlaying,
    long ServerTimestampMs,
    string? InitiatorConnectionId = null
);
