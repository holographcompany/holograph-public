cd path/to/holograph-public
rsync -av --exclude='.git' --exclude='node_modules/' ../holograph-private/ .  # Sync files from private repo
git add .
git commit -m "Updating public repo with latest changes"
git push origin main

