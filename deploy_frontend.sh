#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/mneme-frontend}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/mneme-frontend}"
BRANCH="${BRANCH:-master}"

cd "$APP_DIR"

echo "[1/5] pull latest code from $BRANCH"
git pull --ff-only origin "$BRANCH"

echo "[2/5] install dependencies"
npm ci

echo "[3/5] build frontend"
npm run build

echo "[4/5] sync dist to nginx directory"
sudo mkdir -p "$DEPLOY_DIR"
sudo rm -rf "${DEPLOY_DIR:?}/"*
sudo cp -r dist/. "$DEPLOY_DIR/"

echo "[5/5] reload nginx"
sudo nginx -t
sudo systemctl reload nginx

echo "frontend deployment completed"
