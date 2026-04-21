#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-www.mneme.com.cn}"
APEX_DOMAIN="${APEX_DOMAIN:-mneme.com.cn}"
SITE_CONF_NAME="${SITE_CONF_NAME:-mneme.conf}"
SITE_ROOT="${SITE_ROOT:-/var/www/mneme-frontend}"
BACKEND_UPSTREAM="${BACKEND_UPSTREAM:-http://124.223.14.145:8000}"
NGINX_AVAILABLE_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
SITE_CONF_PATH="${NGINX_AVAILABLE_DIR}/${SITE_CONF_NAME}"
ENABLE_HTTPS="${ENABLE_HTTPS:-false}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo bash $0" >&2
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "nginx is not installed. Install it first:" >&2
  echo "  sudo apt update && sudo apt install -y nginx" >&2
  exit 1
fi

mkdir -p "${SITE_ROOT}"

cat > "${SITE_CONF_PATH}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${APEX_DOMAIN};
    return 301 \$scheme://${DOMAIN}\$request_uri;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    root ${SITE_ROOT};
    index index.html;

    client_max_body_size 20m;

    location /api/ {
        rewrite ^/api/?(.*)$ /\$1 break;
        proxy_pass ${BACKEND_UPSTREAM};
        proxy_http_version 1.1;
        proxy_set_header Host \$proxy_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
        try_files /index.html =404;
    }

    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files \$uri =404;
    }

    location / {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sfn "${SITE_CONF_PATH}" "${NGINX_ENABLED_DIR}/${SITE_CONF_NAME}"

if [[ -f "${NGINX_ENABLED_DIR}/default" ]]; then
  rm -f "${NGINX_ENABLED_DIR}/default"
fi

nginx -t
systemctl reload nginx

echo "Nginx site installed:"
echo "  domain: ${DOMAIN}"
echo "  apex redirect: ${APEX_DOMAIN} -> ${DOMAIN}"
echo "  site root: ${SITE_ROOT}"
echo "  backend upstream: ${BACKEND_UPSTREAM}"
echo "  conf: ${SITE_CONF_PATH}"

if [[ "${ENABLE_HTTPS}" == "true" ]]; then
  if ! command -v certbot >/dev/null 2>&1; then
    echo "certbot is not installed. Install it first:" >&2
    echo "  sudo apt update && sudo apt install -y certbot python3-certbot-nginx" >&2
    exit 1
  fi

  if [[ -z "${CERTBOT_EMAIL}" ]]; then
    echo "CERTBOT_EMAIL is required when ENABLE_HTTPS=true" >&2
    exit 1
  fi

  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${CERTBOT_EMAIL}" --redirect
  systemctl reload nginx
  echo "HTTPS enabled for ${DOMAIN}"
fi

echo
echo "Next step:"
echo "  build and publish frontend files into ${SITE_ROOT}"
