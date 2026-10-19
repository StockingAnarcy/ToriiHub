namespace ToriiHub.Api.Contracts;

public sealed record ChatMessageDto(
    string Id,
    string AuthorClientId,
    string AuthorName,
    string Text,
    DateTimeOffset SentAt
);
