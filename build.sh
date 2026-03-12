#!/bin/bash
set -e

# Install npm deps
npm install

# Install bun
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

# Clone BlooketFlooder if not present
if [ ! -d "flooder" ]; then
  git clone https://github.com/VillainsRule/BlooketFlooder flooder
fi

# Install flooder deps
cd flooder && bun install && cd ..

echo "Build complete!"
