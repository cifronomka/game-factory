#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
template_dir="$repo_root/factory-template"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <game-slug>" >&2
  exit 2
fi

game_slug="$1"
if [[ ! "$game_slug" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "Invalid slug: use lowercase ASCII letters, digits, and single hyphens." >&2
  exit 2
fi

target_dir="$repo_root/games/$game_slug"
if [[ ! -d "$template_dir" ]]; then
  echo "Template not found: $template_dir" >&2
  exit 1
fi
if [[ -e "$target_dir" ]]; then
  echo "Game already exists; nothing was overwritten: $target_dir" >&2
  exit 1
fi

mkdir -p "$repo_root/games"
cp -R "$template_dir" "$target_dir"
find "$target_dir/dist" "$target_dir/releases" -mindepth 1 ! -name '.gitkeep' -delete 2>/dev/null || true

echo "Created game project: $target_dir"
echo "Next: fill $target_dir/docs before implementation."
