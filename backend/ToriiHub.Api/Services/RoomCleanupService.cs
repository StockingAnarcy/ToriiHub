using ToriiHub.Api.Services;

namespace ToriiHub.Api.Services;

public sealed class RoomCleanupService : BackgroundService
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

    private readonly IRoomStore _store;
    private readonly ILogger<RoomCleanupService> _logger;

    public RoomCleanupService(IRoomStore store, ILogger<RoomCleanupService> logger)
    {
        _store = store;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (OperationCanceledException) { return; }

            try
            {
                var removed = _store.GetActiveRoomIds()
                    .Where(id => _store.RemoveIfStale(id, Ttl))
                    .ToList();
                if (removed.Count > 0)
                {
                    _logger.LogInformation("Cleaned up {Count} stale rooms: {Ids}",
                        removed.Count, string.Join(", ", removed));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Room cleanup failed");
            }
        }
    }
}
