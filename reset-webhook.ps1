param(
    [string]$BotToken,
    [string]$TunnelUrl
)

if (-not $BotToken) {
    Write-Host "❌ Please provide your bot token"
    exit 1
}
if (-not $TunnelUrl) {
    Write-Host "❌ Please provide your tunnel URL (like https://abc123.ngrok.io)"
    exit 1
}

# 1. List existing webhooks
Write-Host "Listing existing webhooks..."
$webhooks = Invoke-RestMethod -Uri "https://webexapis.com/v1/webhooks" `
    -Headers @{ "Authorization" = "Bearer $BotToken" }

if ($webhooks.items.Count -gt 0) {
    foreach ($wh in $webhooks.items) {
        Write-Host "Deleting webhook: $($wh.id) ($($wh.targetUrl))"
        Invoke-RestMethod -Method Delete -Uri "https://webexapis.com/v1/webhooks/$($wh.id)" `
            -Headers @{ "Authorization" = "Bearer $BotToken" }
    }
}
else {
    Write-Host "No webhooks to delete."
}

# 2. Create a new webhook
Write-Host "Creating new webhook..."
$body = @"
{
  "name": "webex-ai-agents-webhook",
  "targetUrl": "$TunnelUrl/webhook",
  "resource": "messages",
  "event": "created"
}
"@

$newWebhook = Invoke-RestMethod -Method Post -Uri "https://webexapis.com/v1/webhooks" `
    -Headers @{ "Authorization" = "Bearer $BotToken"; "Content-Type" = "application/json" } `
    -Body $body

Write-Host "✅ New webhook created with ID: $($newWebhook.id)"
Write-Host "Target URL: $($newWebhook.targetUrl)"