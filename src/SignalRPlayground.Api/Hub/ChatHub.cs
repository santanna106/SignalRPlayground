using Microsoft.AspNetCore.SignalR;

namespace SignalRPlayground.Api.Hubs;

public class ChatHub : Hub
{
    // Clients call this method to broadcast messages
    public async Task SendMessage(string user, string message)
    {
        // Sends the message to all connected clients
        await Clients.All.SendAsync("ReceiveMessage", user, message);
    }
}