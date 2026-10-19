namespace ToriiHub.Api.Contracts;

public sealed record ParticipantDto(
    string ConnectionId,
    string ClientId,
    string DisplayName,
    DateTimeOffset JoinedAt
);
