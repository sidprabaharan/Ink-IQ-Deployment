#!/usr/bin/env bash
set -e

tag="$1"

if [ -z "$tag" ]; then 
    echo "Usage: ./time-travel.sh vX.Y.Z"
    echo "Example: ./time-travel.sh v1.0.0"
    exit 1
fi

echo "🚀 Time-traveling to $tag..."

# Checkout the specified git tag
echo "📂 Checking out git tag: $tag"
git checkout "$tag"

# Reset the database to match the migration state at this tag
echo "🗄️  Resetting database..."
npx supabase db reset

# Apply seed data
echo "🌱 Seeding database..."
npx supabase db seed

echo "✅ Now running code + DB at $tag"
echo "💡 Run 'git checkout main' to return to the latest version"








