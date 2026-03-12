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
echo "Build done. Files:"
ls -la
