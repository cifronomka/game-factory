#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
required=(
  AGENTS.md README.md FACTORY_WORKFLOW.md
  factory-template/README.md
  factory-template/docs/PRODUCT_SPEC.md
  factory-template/docs/GAME_DESIGN.md
  factory-template/docs/TECHNICAL_ARCHITECTURE.md
  factory-template/docs/ART_DIRECTION.md
  factory-template/docs/AUDIO_DIRECTION.md
  factory-template/docs/ASSET_PLAN.md
  factory-template/docs/MONETIZATION.md
  factory-template/docs/PLATFORM_REQUIREMENTS.md
  factory-template/docs/QA_PLAN.md
  factory-template/docs/ACCEPTANCE_CRITERIA.md
  factory-template/docs/RELEASE_PLAN.md
  factory-template/visual-references/README.md
  scripts/create-game.sh
)

missing=0
for path in "${required[@]}"; do
  if [[ ! -f "$repo_root/$path" ]]; then
    echo "MISSING: $path" >&2
    missing=1
  fi
done

for path in \
  factory-template/visual-references/concepts \
  factory-template/visual-references/ui-mockups \
  factory-template/visual-references/characters \
  factory-template/visual-references/stage-references \
  factory-template/assets/backgrounds \
  factory-template/assets/characters \
  factory-template/assets/effects \
  factory-template/assets/ui \
  factory-template/assets/audio \
  factory-template/src factory-template/tests factory-template/scripts \
  factory-template/dist factory-template/releases games; do
  if [[ ! -d "$repo_root/$path" ]]; then
    echo "MISSING DIRECTORY: $path" >&2
    missing=1
  fi
done

if [[ $missing -ne 0 ]]; then
  exit 1
fi

echo "Factory structure is complete."
