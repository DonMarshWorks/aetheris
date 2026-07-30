#!/usr/bin/env bash
# Prepare this folder for GitHub Pages, then print the two commands you need.
# Usage:  ./publish.sh <your-github-username>
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: ./publish.sh <your-github-username>" >&2
  exit 1
fi
USER_NAME="$1"
# github.io hostnames are lowercase; the repo path keeps its casing
HOST_NAME="$(printf '%s' "$USER_NAME" | tr '[:upper:]' '[:lower:]')"
REPO="aetheris"

# Bake the real URLs into the social-preview metadata.
for f in index.html README.md; do
  if grep -q REPLACE_USER "$f"; then
    sed -i.bak "s|REPLACE_USER|${HOST_NAME}|g" "$f" && rm -f "$f.bak"
    echo "updated $f"
  fi
done

if [ ! -d .git ]; then
  git init -q
  # works on every git version, including before `init -b` existed
  git symbolic-ref HEAD refs/heads/main
fi
git add -A
git commit -q -m "Aetheris: a procedural world held in climatic balance" || echo "nothing new to commit"

cat <<MSG

Committed. Three steps left:

  1. Create an empty public repo named "${REPO}" at
     https://github.com/new
     (no README, no .gitignore, no license — this folder already has them)

  2. Push it:

     git remote add origin https://github.com/${USER_NAME}/${REPO}.git
     git push -u origin main

  3. Turn on Pages:
     Settings -> Pages -> Source: "Deploy from a branch"
                          Branch: main, folder: / (root) -> Save

Your site will be live in a minute or two at:

     https://${HOST_NAME}.github.io/${REPO}/

MSG
