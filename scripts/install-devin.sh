#!/bin/sh
# install-devin.sh — install (or refresh) AI-DLC for Devin in a project with one
# command, from this fork's source:
#
#   cd your-project
#   curl -fsSL https://raw.githubusercontent.com/BrianSouza/ai-dlc-devin/main/scripts/install-devin.sh | sh
#
# It installs Bun when it is missing, downloads this repository, builds the
# copy runtime (scripts/package-release.ts --copy-runtime-only) and runs the
# same `aidlc config --harness devin` every harness uses, which merges
# AGENTS.md and .gitignore without touching the project's own lines and keeps
# existing AI-DLC work under aidlc/. A team's own .devin/config.json is kept
# and merged (scripts/install-devin-config.ts). Run it again to refresh.
#
# Options (after `sh -s --` when piped):
#   --ref <branch|tag>   source ref to install (default: main)
#   --repo <owner/name>  GitHub repository to install from (default: BrianSouza/ai-dlc-devin)
#   --project <dir>      project folder (default: the current folder)
#   --force              let config replace AI-DLC files you edited
set -eu

REPO=${AIDLC_DEVIN_REPO:-BrianSouza/ai-dlc-devin}
REF=${AIDLC_DEVIN_REF:-main}
PROJECT=$(pwd)
FORCE=""

say() { printf '%s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --ref) [ $# -ge 2 ] || die "--ref needs a value"; REF=$2; shift 2 ;;
    --repo) [ $# -ge 2 ] || die "--repo needs a value"; REPO=$2; shift 2 ;;
    --project) [ $# -ge 2 ] || die "--project needs a value"; PROJECT=$2; shift 2 ;;
    --force) FORCE=--force; shift ;;
    -h|--help) sed -n '2,24p' "$0" 2>/dev/null || true; exit 0 ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac
done

for tool in git curl tar; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is required; install it and run this again"
done
[ -d "$PROJECT" ] || die "project folder not found: $PROJECT"
PROJECT=$(cd "$PROJECT" && pwd)
git -C "$PROJECT" rev-parse --git-dir >/dev/null 2>&1 ||
  die "$PROJECT is not a git repository; run \`git init\` there first"

if ! command -v bun >/dev/null 2>&1; then
  if [ -x "$HOME/.bun/bin/bun" ]; then
    PATH="$HOME/.bun/bin:$PATH"
  else
    say "Installing Bun (https://bun.sh), which AI-DLC runs on..."
    curl -fsSL https://bun.sh/install | bash >/dev/null
    PATH="$HOME/.bun/bin:$PATH"
    command -v bun >/dev/null 2>&1 || die "Bun did not install; see https://bun.sh/docs/installation"
  fi
fi

WORK=$(mktemp -d "${TMPDIR:-/tmp}/aidlc-devin.XXXXXX")
trap 'rm -rf "$WORK"' EXIT INT TERM
SRC="$WORK/src"
mkdir -p "$SRC"

say "Downloading AI-DLC for Devin ($REPO, $REF)..."
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$REF" | tar -xz -C "$SRC" --strip-components=1 ||
  die "could not download $REPO at $REF"

say "Building the Devin runtime..."
(cd "$SRC" && bun install --frozen-lockfile >/dev/null 2>&1) || die "bun install failed in the downloaded source"
(cd "$SRC" && bun scripts/package-release.ts --copy-runtime-only --output "$WORK/release" >/dev/null) ||
  die "building the Devin runtime failed"
set -- "$WORK"/release/aidlc-copy-runtime-*.tar.gz
[ -f "$1" ] || die "the build produced no copy runtime"
RUNTIME=$1

say "Installing into $PROJECT..."
bun "$SRC/scripts/install-devin-config.ts" save "$PROJECT" "$WORK/team-config.json"
status=0
(cd "$PROJECT" && bun "$SRC/dist/devin/.devin/tools/aidlc.ts" config --harness devin --yes --from "$RUNTIME" $FORCE) ||
  status=$?
bun "$SRC/scripts/install-devin-config.ts" restore "$PROJECT" "$WORK/team-config.json"
[ "$status" -eq 0 ] || exit "$status"

(cd "$PROJECT" && bun .devin/tools/aidlc.ts doctor) || true

cat <<'EOF'

AI-DLC for Devin is installed.

Devin CLI / Devin Desktop: start `devin` in this folder, then type
  /aidlc --doctor
  /aidlc <what you want to build>

Devin Cloud: commit and push .devin/, aidlc/, AGENTS.md and .gitignore, give
Devin access to this repository, and add Bun to its environment blueprint:
  initialize: |
    curl -fsSL https://bun.sh/install | bash
The project's .devin/config.json already declares the aidlc-devin cloud
plugin. In a cloud session, type: @skills:aidlc <what you want to build>
EOF
