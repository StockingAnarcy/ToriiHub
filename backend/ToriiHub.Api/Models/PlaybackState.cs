namespace ToriiHub.Api.Models;

public sealed class PlaybackState
{
    public string? SourceJson { get; set; }
    public double PositionSeconds { get; set; }
    public bool IsPlaying { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
