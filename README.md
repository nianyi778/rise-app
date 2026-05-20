# Rise 瑞

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-22-green.svg)
![WeChat Mini Program](https://img.shields.io/badge/WeChat-Mini%20Program-07c160.svg)

> **别让紧急的事，埋掉重要的你。**
> Don't let urgent things bury the important you.

Rise is a WeChat Mini Program AI life coach for Chinese office workers (25–35). It helps users protect their Q2 goals — the important-but-not-urgent things that keep getting buried by daily urgency. Input a goal, get a 21-day AI plan, track daily focus sessions, and receive weekly progress reports.

---

## Features 功能特性

- **AI Goal Planning** — Claude Sonnet analyzes your goal and generates a structured 21-day action plan with daily 25-minute tasks
- **Daily Focus Timer** — built-in Pomodoro-style focus session with animated progress tracking
- **Check-in & Reflection** — post-session mood logging + streaming AI reflection chat powered by Claude Haiku
- **Weekly Reports** — personalized weekly digest visualizing completion streaks, focus time, and growth insights
- **Glassmorphism UI** — iOS-style frosted glass aesthetic with a warm cream × deep navy × amber palette
- **WeChat Auth** — one-tap login via WeChat OAuth, no password required

---

## Tech Stack 技术栈

| Layer | Technology |
|---|---|
| Frontend | WeChat Mini Program (TypeScript, WXML, WXSS) — native, no frameworks |
| Backend | Node.js 22 + Hono.js |
| Database | PostgreSQL 16 |
| AI | Anthropic Claude Sonnet (plan generation) + Haiku (daily actions, streaming chat) |
| Auth | WeChat OAuth 2.0 → JWT |
| Deployment | Docker + docker-compose on Tencent Cloud HK VPS (2c2g) |
| HTTPS | Certbot (Let's Encrypt) + Nginx |

---

## Quick Start 快速开始

### Prerequisites

- Node.js 22+
- Docker & docker-compose
- WeChat DevTools (latest)
- An [Anthropic API key](https://console.anthropic.com/)
- A WeChat Mini Program AppID + Secret (from [mp.weixin.qq.com](https://mp.weixin.qq.com))

### 1. Clone

```bash
git clone https://github.com/your-username/rise-app.git
cd rise-app
```

### 2. Backend Setup

```bash
# Copy and fill in environment variables
cp backend/.env.example backend/.env
# Edit backend/.env — see Environment Variables section below

# Start PostgreSQL + API server
docker-compose up -d

# Verify
curl http://localhost:3000/health
```

### 3. Run Migrations

```bash
# Migrations run automatically on container start via the entrypoint script.
# To run manually:
docker-compose exec api node dist/db/migrate.js
```

### 4. Frontend Setup

1. Open **WeChat DevTools** → Import Project → select the `miniprogram/` directory
2. Set your AppID in `project.config.json`
3. In `miniprogram/api/index.ts`, update `BASE_URL` to point to your backend (e.g. `https://your-domain.com/api`)
4. Click **Compile** — the app loads in the simulator

---

## Environment Variables 环境变量

Create `backend/.env` from the example file. All variables are required.

| Variable | Description | Example |
|---|---|---|
| `PORT` | HTTP port the API listens on | `3000` |
| `DATABASE_URL` | Full PostgreSQL connection string | `postgresql://rise:password@postgres:5432/rise` |
| `DB_PASSWORD` | PostgreSQL password (used by docker-compose) | `changeme` |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | `sk-ant-...` |
| `JWT_SECRET` | Secret for signing JWTs (32+ random chars) | `your-jwt-secret` |
| `WX_APPID` | WeChat Mini Program App ID | `wx1234567890abcdef` |
| `WX_SECRET` | WeChat Mini Program App Secret | `abc123...` |

---

## Deployment 部署

### First-time VPS Setup

```bash
# Run the setup script on a fresh Ubuntu 22.04 VPS
bash scripts/setup-server.sh
```

This installs Docker, docker-compose, Nginx, Certbot, and configures the firewall.

### HTTPS with Certbot

```bash
# After DNS points to your server
sudo certbot --nginx -d your-domain.com
```

Nginx proxies `your-domain.com/api` → `localhost:3000`.

### Deploy Updates

```bash
# From your local machine (requires SSH access)
bash scripts/deploy.sh
```

The deploy script performs a rolling update: pulls the latest image, restarts the API container with zero database downtime.

### docker-compose Services

| Service | Description |
|---|---|
| `api` | Hono.js backend (Node 22, port 3000) |
| `postgres` | PostgreSQL 16 with persistent volume |

---

## Project Structure 项目结构

```
rise-app/
├── miniprogram/              # WeChat Mini Program frontend
│   ├── pages/                # 8 pages: welcome, wizard, home, focus, complete, reflection, report, goals
│   ├── api/index.ts          # API client with snake_case→camelCase mapping
│   ├── store/index.ts        # Lightweight pub-sub store
│   ├── utils/                # Helpers (Canvas, date, animation)
│   └── custom-tab-bar/       # Glassmorphism tab bar with SVG icons
├── backend/                  # Hono.js API server
│   └── src/
│       ├── routes/           # auth, goals, checkin, ai, report
│       ├── db/               # PostgreSQL schema + migrations
│       ├── ai/               # Claude prompt builders
│       └── middleware/       # JWT auth
├── scripts/
│   ├── setup-server.sh       # First-time VPS setup
│   └── deploy.sh             # Rolling deploy
├── docker-compose.yml        # api + postgres services
└── design/                   # HTML prototypes (open in browser to preview)
```

---

## Contributing 贡献

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes with clear messages
4. Open a Pull Request describing what you changed and why

Please keep PRs focused — one feature or fix per PR. For significant changes, open an issue first to discuss the approach.

---

## License

MIT © 2025 Rise 瑞
