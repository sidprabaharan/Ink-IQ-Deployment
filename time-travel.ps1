param([string]$tag)

if (-not $tag) { 
    Write-Host "Usage: ./time-travel.ps1 vX.Y.Z" -ForegroundColor Yellow
    Write-Host "Example: ./time-travel.ps1 v1.0.0" -ForegroundColor Gray
    exit 1 
}

Write-Host "🚀 Time-traveling to $tag..." -ForegroundColor Cyan

# Checkout the specified git tag
Write-Host "📂 Checking out git tag: $tag" -ForegroundColor Blue
git checkout $tag

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to checkout tag $tag" -ForegroundColor Red
    exit 1
}

# Reset the database to match the migration state at this tag
Write-Host "🗄️  Resetting database..." -ForegroundColor Blue
npx supabase db reset

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to reset database" -ForegroundColor Red
    exit 1
}

# Apply seed data
Write-Host "🌱 Seeding database..." -ForegroundColor Blue
npx supabase db seed

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to seed database" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Now running code + DB at $tag" -ForegroundColor Green
Write-Host "💡 Run 'git checkout main' to return to the latest version" -ForegroundColor Gray



















