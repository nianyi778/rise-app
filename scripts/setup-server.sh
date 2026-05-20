#!/bin/bash
set -e

# 腾讯云香港 VPS 首次初始化脚本
# 用法: bash setup-server.sh（root 身份执行）

echo "==> 安装 Docker"
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "==> 安装 docker compose plugin"
apt-get install -y docker-compose-plugin 2>/dev/null || \
  yum install -y docker-compose-plugin 2>/dev/null || true

echo "==> 克隆项目"
git clone https://github.com/YOUR_USERNAME/rise-app.git /opt/rise-app

echo "==> 创建 .env 文件（请手动填写）"
cat > /opt/rise-app/backend/.env << 'EOF'
PORT=3000
DATABASE_URL=postgres://rise:CHANGE_ME@db:5432/rise
DB_PASSWORD=CHANGE_ME
ANTHROPIC_API_KEY=sk-ant-CHANGE_ME
JWT_SECRET=CHANGE_ME_32_CHARS_RANDOM
WX_APPID=CHANGE_ME
WX_SECRET=CHANGE_ME
EOF

echo "==> 配置 Nginx 反向代理"
apt-get install -y nginx 2>/dev/null || yum install -y nginx 2>/dev/null || true
cat > /etc/nginx/conf.d/rise.conf << 'NGINX'
server {
    listen 80;
    server_name YOUR_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
    }
}
NGINX
nginx -s reload 2>/dev/null || systemctl start nginx

echo ""
echo "✓ 初始化完成。接下来："
echo "  1. 编辑 /opt/rise-app/backend/.env 填入真实配置"
echo "  2. 替换 /etc/nginx/conf.d/rise.conf 中的 YOUR_DOMAIN"
echo "  3. 运行: cd /opt/rise-app && docker compose up -d"
echo "  4. 首次迁移: ./scripts/deploy.sh --first-run"
echo "  5. 配置 HTTPS: certbot --nginx -d YOUR_DOMAIN"
