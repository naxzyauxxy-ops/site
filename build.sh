#!/bin/bash
set -e
npm install
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
echo "Bun version: $(bun --version)"
# Always re-clone to get latest flooder
rm -rf BlooketFlooder
git clone https://github.com/VillainsRule/BlooketFlooder
cd BlooketFlooder
bun i
cd ..
# Clone interstellar-astro icons into public so they're served from our domain
echo "Fetching game icons..."
mkdir -p public/assets/media/icons
git clone --depth=1 --filter=blob:none --sparse https://github.com/UseInterstellar/Interstellar-Astro interstellar-tmp
cd interstellar-tmp
git sparse-checkout set public/assets/media/icons
cd ..
cp -r interstellar-tmp/public/assets/media/icons/. public/assets/media/icons/
rm -rf interstellar-tmp
echo "Icons copied: $(ls public/assets/media/icons | wc -l)"
echo "Build done."
ls -la
