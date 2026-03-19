#!/bin/bash
set -e
npm install
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
echo "Bun version: $(bun --version)"
# Clone BlooketFlooder
rm -rf BlooketFlooder
git clone https://github.com/VillainsRule/BlooketFlooder
cd BlooketFlooder
bun i
cd ..
# Clone MonkeyGG2 self-hosted games into public/games/
echo "Cloning MonkeyGG2 games..."
rm -rf _monkey_tmp
git clone --depth=1 https://github.com/MonkeyGG2/monkeygg2.github.io _monkey_tmp
mkdir -p public/games
cp -r _monkey_tmp/games/. public/games/
rm -rf _monkey_tmp
echo "Games ready: $(ls public/games | wc -l) games"
# Clone interstellar-astro icons
echo "Fetching game icons..."
mkdir -p public/assets/media/icons
git clone --depth=1 --filter=blob:none --sparse https://github.com/UseInterstellar/Interstellar-Astro _interstellar_tmp
cd _interstellar_tmp
git sparse-checkout set public/assets/media/icons
cd ..
cp -r _interstellar_tmp/public/assets/media/icons/. public/assets/media/icons/
rm -rf _interstellar_tmp
echo "Icons: $(ls public/assets/media/icons | wc -l)"
echo "Build done."
ls -la
