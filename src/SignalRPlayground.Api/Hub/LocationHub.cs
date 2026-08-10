using Microsoft.AspNetCore.SignalR;

namespace SignalRPlayground.Api.Hubs;

public class LocationHub : Hub
{
    // Clients call this method to broadcast messages
    public async Task SendLocation(decimal latitude, decimal logintude)
    {
        // Sends the message to all connected clients
        await Clients.All.SendAsync("ReceiveLocation", latitude, logintude);
    }

    public async Task SendLocationData(string latitude, string logintude)
    {
        // Sends the message to all connected clients
        await Clients.All.SendAsync("ReceiveLocation", latitude, logintude);
    }
}