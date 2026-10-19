namespace ToriiHub.Api.Models;

public sealed class ChatMessage
{
    public required string Id { get; init; }
    public required string AuthorClientId { get; init; }
    public required string AuthorName { get; init; }
    public required string Text { get; init; }
    public DateTimeOffset SentAt { get; init; } = DateTimeOffset.UtcNow;
}
