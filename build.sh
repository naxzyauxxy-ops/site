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
# Clone Cookie Clicker from MonkeyGG2
echo "Cloning Cookie Clicker..."
rm -rf _monkey_tmp
git clone --depth=1 --filter=blob:none --sparse https://github.com/MonkeyGG2/monkeygg2.github.io _monkey_tmp
cd _monkey_tmp
git sparse-checkout set games/cookie-clicker
cd ..
mkdir -p public/games/cookie-clicker
cp -r _monkey_tmp/games/cookie-clicker/. public/games/cookie-clicker/
rm -rf _monkey_tmp
echo "Cookie Clicker ready"
echo "Build done."
ls -la
