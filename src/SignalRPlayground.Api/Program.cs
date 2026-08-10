using Scalar.AspNetCore;
using SignalRPlayground.Api.Hubs;
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Add SignalR services


// 2. Configure CORS to allow the React frontend domain
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactAppPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:3000") // Change to your React app URL
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required by SignalR
    });
});
builder.Services.AddSignalR();


var app = builder.Build();

// 2. Aplicar o middleware do CORS
app.UseRouting();
// 3. Apply CORS before mapping endpoints
app.UseCors("ReactAppPolicy");

// Map the hub to a specific route
app.MapHub<ChatHub>("/chatHub");
app.MapHub<LocationHub>("/locationHub");

app.UseDefaultFiles();
app.UseStaticFiles();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}




//app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
