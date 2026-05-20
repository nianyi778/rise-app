#!/bin/bash
set -e

# Rise 部署脚本 — 腾讯云香港 VPS
# 用法: ./scripts/deploy.sh [--first-run]

REPO_DIR="/opt/rise-app"
COMPOSE="docker compose"

echo "==> 拉取最新代码"
git -C "$REPO_DIR" pull origin main

echo "==> 构建镜像"
$COMPOSE -f "$REPO_DIR/docker-compose.yml" build --no-cache api

echo "==> 滚动重启 API（零停机）"
$COMPOSE -f "$REPO_DIR/docker-compose.yml" up -d --no-deps api

if [ "$1" = "--first-run" ]; then
  echo "==> 首次部署：初始化数据库"
  sleep 3
  $COMPOSE -f "$REPO_DIR/docker-compose.yml" exec api node -e \
    "import('./dist/db/migrate.js').then(m => m.migrate()).then(() => process.exit(0))"
fi

echo "==> 清理旧镜像"
docker image prune -f

echo "==> 部署完成"
$COMPOSE -f "$REPO_DIR/docker-compose.yml" ps
