#!/bin/sh
set -eu

tar \
  --exclude='.git' \
  --exclude='.pnp.*' \
  --exclude='node_modules' \
  --exclude='*/node_modules' \
  --exclude='*/dist' \
  --exclude='*/playwright-report' \
  --exclude='*/test-results' \
  -C /source -cf - . | tar -C /workspace -xf -
node .yarn/releases/yarn-4.17.1.cjs install --immutable

if [ "$1" = 'yarn' ]; then
  shift
  exec node .yarn/releases/yarn-4.17.1.cjs "$@"
fi

exec "$@"
