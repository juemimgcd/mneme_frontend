#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
SCRIPT_NAME="$(basename -- "${BASH_SOURCE[0]}")"

APP_DIR="${APP_DIR:-$SCRIPT_DIR}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/mneme-frontend}"
BRANCH="${BRANCH:-master}"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "APP_DIR does not look like a git repository: $APP_DIR" >&2
  exit 1
fi

cd "$APP_DIR"

echo "[0/6] deployment config"
echo "APP_DIR=$APP_DIR"
echo "DEPLOY_DIR=$DEPLOY_DIR"
echo "BRANCH=$BRANCH"

echo "[1/6] fetch latest code from $BRANCH"
git fetch origin "$BRANCH"

if [[ -f "$APP_DIR/$SCRIPT_NAME" ]] \
  && ! git ls-files --error-unmatch -- "$SCRIPT_NAME" >/dev/null 2>&1 \
  && git cat-file -e "origin/$BRANCH:$SCRIPT_NAME" 2>/dev/null; then
  backup_path="${APP_DIR}/${SCRIPT_NAME}.bootstrap.$(date +%Y%m%d%H%M%S).bak"
  echo "Move local bootstrap script to $backup_path to avoid pull conflicts"
  mv "$APP_DIR/$SCRIPT_NAME" "$backup_path"
fi

if git ls-files --error-unmatch -- "$SCRIPT_NAME" >/dev/null 2>&1 \
  && ! git diff --quiet -- "$SCRIPT_NAME"; then
  backup_path="${APP_DIR}/${SCRIPT_NAME}.local.$(date +%Y%m%d%H%M%S).bak"
  echo "Backup modified tracked script to $backup_path before pull"
  cp "$APP_DIR/$SCRIPT_NAME" "$backup_path"
  git restore -- "$SCRIPT_NAME"
fi

echo "[2/6] pull latest code from $BRANCH"
git pull --ff-only origin "$BRANCH"

echo "[3/6] install dependencies"
npm ci

echo "[4/6] build frontend"
npm run build

echo "[5/6] sync dist to nginx directory"
sudo mkdir -p "$DEPLOY_DIR"
sudo rm -rf "${DEPLOY_DIR:?}/"*
sudo cp -r dist/. "$DEPLOY_DIR/"

echo "[6/6] reload nginx"
sudo nginx -t
sudo systemctl reload nginx

echo "frontend deployment completed"
