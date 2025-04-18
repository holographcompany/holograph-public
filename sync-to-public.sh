#!/bin/bash

# --------------------------------------------
# Sync current clean snapshot from private repo to public
# --------------------------------------------

set -e  # Exit on any error

echo "📥 Fetching latest changes from private repo..."
git checkout main
git pull origin main --no-rebase

# Check if a secret file exists
if git ls-files | grep -q "gcs-key.*\.json"; then
  echo "❌ ERROR: Detected gcs-key*.json file in Git history or staging area!"
  echo "🔒 These files must not be pushed to public repositories."
  echo "👉 Please remove them and run: git commit --amend or git rebase -i"
  exit 1
fi

# Optional: remind about `.gitignore`
if ! grep -q "gcs-key" .gitignore; then
  echo "⚠️ WARNING: .gitignore does not appear to ignore gcs-key.json files!"
  echo "✏️ Consider adding this line: gcs-key*.json"
fi

# Create a temporary clean snapshot
echo "🧹 Creating clean snapshot for public sync..."
TEMP_DIR=~/holograph-public-push-temp
rm -rf "$TEMP_DIR"
mkdir "$TEMP_DIR"

rsync -av --progress ./ "$TEMP_DIR" \
  --exclude .git \
  --exclude node_modules \
  --exclude .next

cd "$TEMP_DIR"

# Initialize new repo and push a single clean commit
echo "🚀 Initializing and pushing snapshot..."
git init
git checkout -b main
git add .
git commit -m "Snapshot for AI - $(date)"
git remote add origin https://github.com/holographcompany/holograph-public.git
git push origin main --force

# Cleanup
cd ~
rm -rf "$TEMP_DIR"

echo "✅ Sync to public repo completed successfully!"
