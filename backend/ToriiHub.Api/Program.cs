using ToriiHub.Api.Hubs;
using ToriiHub.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR(options =>
{
    options.MaximumReceiveMessageSize = 64 * 1024;
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
});

builder.Services.AddSingleton<IRoomStore, InMemoryRoomStore>();
builder.Services.AddHostedService<RoomCleanupService>();
builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();
app.MapHealthChecks("/health");
app.MapHub<RoomHub>("/hubs/room");

var indexHtml = Path.Combine(app.Environment.WebRootPath ?? "wwwroot", "index.html");
if (File.Exists(indexHtml))
{
    app.MapFallbackToFile("index.html");
}

app.Run();
