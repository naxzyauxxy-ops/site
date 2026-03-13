#!/bin/bash
set -e
echo "=== Installing npm deps ==="
npm install

echo "=== Installing bun ==="
curl -fsSL https://bun.sh/install | bash || true

export PATH="$HOME/.bun/bin:$PATH"

echo "=== Cloning BlooketFlooder ==="
rm -rf BlooketFlooder
git clone https://github.com/VillainsRule/BlooketFlooder
cd BlooketFlooder && bun i && cd ..

echo "=== Build complete ==="
