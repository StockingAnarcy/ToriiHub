# ---- Frontend build ----
FROM node:20-alpine AS frontend-build
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Backend build ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build
WORKDIR /src/backend
COPY backend/ ./
COPY --from=frontend-build /src/frontend/dist ./ToriiHub.Api/wwwroot/
RUN dotnet restore ToriiHub.Api/ToriiHub.Api.csproj
RUN dotnet publish ToriiHub.Api/ToriiHub.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ---- Runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=backend-build /app/publish ./
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "ToriiHub.Api.dll"]