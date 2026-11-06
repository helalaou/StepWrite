#!/bin/sh
# Netlify runs this before each build (netlify.toml): exit status 0 skips the
# build, 1 runs it. Every deploy uses credits from the free plan, so only main
# is built, and only when a file the site is built from has changed.

[ "$CONTEXT" = "production" ] || exit 0

# A deploy started again by hand, or the site's first one
if [ "$CACHED_COMMIT_REF" = "$COMMIT_REF" ] || ! git cat-file -e "$CACHED_COMMIT_REF^{commit}" 2>/dev/null; then
  exit 1
fi

git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- client server netlify.toml .nvmrc
