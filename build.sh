#!/bin/bash
set -e
npm install
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
if [ ! -d "BlooketFlooder" ]; then
  git clone https://github.com/VillainsRule/BlooketFlooder
fi
cd BlooketFlooder && bun i && cd ..
echo "Build done"
