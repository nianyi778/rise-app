# Rise · MVP 技术方案

> 别让紧急的事，埋掉重要的你。

---

## 一、产品定位

Rise 是一款面向中国 25-35 岁打工人的 AI 目标教练小程序。核心机制：AI 帮用户识别、拆解并每日守护他们「重要但不紧急」的 Q2 目标，通过温暖问责替代冷冰冰的任务清单。

**MVP 范围**：单目标 + AI 对话 + 每日专注 + 打卡回顾，不包含社交、多端同步。

---

## 二、技术栈

### 前端
| 层 | 选型 | 理由 |
|----|------|------|
| 框架 | 微信小程序原生 | 无需审核延迟，直接触达用户 |
| UI 组件 | 自研（参考 design/ 原型） | 定制毛玻璃风格，组件库无法还原 |
| 状态管理 | MobX-miniprogram | 响应式，比 Redux 轻 |
| 动画 | wxss animation + Canvas | 专注计时器圆环 + 粒子庆祝 |

### 后端
| 层 | 选型 | 理由 |
|----|------|------|
| 运行环境 | 微信云开发（CloudBase） | 免运维，天然打通 openid，免 AppSecret 鉴权 |
| 数据库 | 云数据库（MongoDB-like） | 文档结构适合 AI 生成的非结构化数据 |
| 云函数 | Node.js 18 | Claude API 调用、业务逻辑 |
| 文件存储 | 云存储 | 用户头像、分享卡片图 |
| 定时触发 | 云函数定时器 | 每日推送、周报生成 |

### AI
| 场景 | 模型 | 理由 |
|------|------|------|
| 目标理解 & 拆解（首次）| Claude Sonnet 4.6 | 需要高质量推理，一次性 |
| 每日行动生成 | Claude Haiku 4.5 | 高频调用，控制成本 |
| 复盘分析 & 周报 | Claude Sonnet 4.6 | 质量优先 |
| 实时对话 | Claude Haiku 4.5 + streaming | 低延迟，流式输出 |

**成本估算**（1000 DAU）：
- Haiku：~$8/天（每人 2 次调用 × 500 tokens）
- Sonnet：~$15/天（每人 1 次 × 1000 tokens）
- 月均云函数 + 数据库：~¥200

---

## 三、系统架构

```
┌─────────────────────────────────────────────┐
│              微信小程序客户端                  │
│  Splash → Onboarding → 首页 → 专注 → 复盘    │
└──────────────────┬──────────────────────────┘
                   │ wx.cloud.callFunction
                   │ wx.cloud.database
                   ▼
┌─────────────────────────────────────────────┐
│              微信云开发                        │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 云函数    │  │ 云数据库  │  │ 定时器    │  │
│  │ ai-chat  │  │ users    │  │ daily-   │  │
│  │ ai-plan  │  │ goals    │  │ push     │  │
│  │ checkin  │  │ sessions │  │ weekly-  │  │
│  │ report   │  │ checkins │  │ report   │  │
│  └────┬─────┘  └──────────┘  └──────────┘  │
└───────┼─────────────────────────────────────┘
        │ HTTPS
        ▼
┌─────────────────┐
│  Anthropic API  │
│  Claude Haiku   │
│  Claude Sonnet  │
└─────────────────┘
```

---

## 四、数据库设计

### users
```json
{
  "_id": "openid_xxx",
  "nickname": "李凯",
  "avatar": "cloud://...",
  "timezone": "Asia/Shanghai",
  "plan": "free",          // free | pro
  "planExpire": null,
  "onboarded": true,
  "createdAt": "2026-05-19T09:00:00Z"
}
```

### goals
```json
{
  "_id": "goal_xxx",
  "userId": "openid_xxx",
  "title": "副业启动",
  "category": "create",    // work | health | learn | fin | create | relate | custom
  "rawInput": "我想把副业做起来，已经拖了半年了",
  "blocker": "no_time",    // no_time | no_start | interrupted | fear
  "phase": {
    "name": "建立接单能力",
    "target": "接到第 1 个订单",
    "durationDays": 21
  },
  "dailyMinutes": 25,
  "preferTime": "21:30",
  "startDate": "2026-05-08",
  "status": "active",      // active | paused | completed | archived
  "aiPlan": { ... },       // Claude 生成的完整方案
  "createdAt": "2026-05-08T..."
}
```

### sessions（每日任务）
```json
{
  "_id": "sess_xxx",
  "userId": "openid_xxx",
  "goalId": "goal_xxx",
  "date": "2026-05-19",
  "dayIndex": 12,
  "action": "整理 3 个可以接的设计订单方向",
  "estimatedMin": 25,
  "status": "pending",     // pending | done | skipped
  "actualMin": null,
  "skippedReason": null,
  "generatedAt": "2026-05-19T06:00:00Z"
}
```

### checkins（打卡记录）
```json
{
  "_id": "ci_xxx",
  "userId": "openid_xxx",
  "sessionId": "sess_xxx",
  "goalId": "goal_xxx",
  "date": "2026-05-19",
  "mood": "great",         // hard | ok | good | great
  "note": "比想象的顺利很多",
  "focusMin": 28,
  "streakDay": 5,
  "createdAt": "..."
}
```

---

## 五、AI 提示词架构

### 5.1 目标理解 & 方案生成（首次，Sonnet）

```
system: |
  你是 Rise 的 AI 目标教练。用温暖、直接的语气，
  像一个聪明的朋友，而非效率工具。

  你的任务：根据用户描述的目标，生成一份结构化执行方案。

  输出 JSON 格式：
  {
    "goalTitle": "简洁目标名（4-8字）",
    "phase": {
      "name": "第一阶段名称",
      "target": "具体里程碑",
      "durationDays": 21
    },
    "dailyActions": [
      { "dayRange": "1-7", "theme": "...", "example": "..." },
      ...
    ],
    "recommendTime": "HH:MM",
    "dailyMinutes": 25,
    "encouragement": "一句温暖的话（20字内）"
  }

user: |
  目标描述：{{rawInput}}
  最大阻力：{{blocker}}
  可用时间段：{{availableTime}}
  每天能投入时间：{{dailyMinutes}} 分钟
```

### 5.2 每日行动生成（Haiku）

```
system: |
  你是 Rise AI 教练。每天为用户生成今日具体行动。
  行动必须：具体可操作、25分钟内可完成、承接昨日进展。

user: |
  目标：{{goalTitle}}
  阶段：{{phaseName}}（{{phaseTarget}}）
  今天是第 {{dayIndex}} 天
  昨日完成：{{yesterdayAction}}（{{yesterdayStatus}}）
  昨日心情：{{yesterdayMood}}

  生成今日行动（一句话，20字内）：
```

### 5.3 复盘对话（Haiku，streaming）

```
system: |
  你是 Rise AI 教练，用户刚完成今日目标。
  进行简短温暖的复盘对话。
  - 先肯定，再问感受
  - 根据心情调整语气：great=庆祝，hard=安慰
  - 最多 3 轮对话，不啰嗦

user: |
  [对话历史]
  今日完成：{{action}}
  心情：{{mood}}
  备注：{{note}}
```

### 5.4 周报生成（Sonnet）

```
system: |
  你是 Rise AI 教练，生成用户本周目标报告。
  输出：温暖、个人化、有洞察，像朋友的周末总结，不像 KPI 汇报。

user: |
  用户：{{nickname}}
  目标：{{goalTitle}}，第 {{weekStart}}-{{weekEnd}} 天
  本周打卡：{{completedDays}}/7 天
  各日行动和心情：{{detailArray}}
  
  请生成：
  1. 本周最大突破（1句）
  2. AI 观察（2-3句，说出用户可能没意识到的模式）
  3. 下周方向（1句）
```

---

## 六、云函数清单

| 函数名 | 触发方式 | 功能 |
|--------|----------|------|
| `onboarding` | 客户端调用 | 处理目标输入，调用 Sonnet 生成方案 |
| `daily-generate` | 定时 06:00 | 为所有 active 目标生成当日 session |
| `checkin` | 客户端调用 | 记录打卡，更新 streak，触发复盘对话 |
| `ai-chat` | 客户端调用（streaming）| 实时对话，Haiku streaming |
| `weekly-report` | 定时 周日 20:00 | 生成周报，发送订阅消息 |
| `push-reminder` | 定时，按用户 preferTime | 发送今日任务订阅消息 |
| `payment` | 客户端调用 | 微信支付，升级 Pro |

---

## 七、微信能力接入

### 订阅消息（关键路径）
```
模板1：今日任务提醒
  - 任务内容：整理 3 个可以接的设计订单方向
  - 预计时长：25 分钟
  - 推荐时间：今晚 8:30

模板2：周报生成通知
  - 报告摘要：本周完成 5/7 天 🔥 连续 5 天
```

### 微信支付
```
产品：Rise Pro 会员
  - 月付：¥29/月
  - 年付：¥199/年（折合 ¥16.6/月）
  
实现：wx.requestPayment + 云函数验签 + 更新 user.plan
```

---

## 八、开发周期（4 周 MVP）

### Week 1：基础架构
- [ ] 云开发环境初始化（数据库、云函数、存储）
- [ ] 用户登录（wx.login + openid 绑定）
- [ ] Onboarding 页面 + AI 目标方案生成
- [ ] 基础数据模型

### Week 2：核心功能
- [ ] 首页（今日任务卡片 + 进展）
- [ ] 专注计时器（圆环 + 暂停 / 结束）
- [ ] 打卡完成页（心情选择 + streak）
- [ ] 每日任务自动生成（定时云函数）

### Week 3：AI 深化 + 回顾
- [ ] 复盘对话（streaming 对话）
- [ ] 周报页面 + 周报自动生成
- [ ] 订阅消息接入（每日提醒）
- [ ] 我的目标页（目标管理）

### Week 4：商业化 + 打磨
- [ ] 微信支付 + Pro 会员
- [ ] 免费版限制（1 个目标 + 基础功能）
- [ ] 分享卡片生成（Canvas 绘制）
- [ ] 性能优化 + Bug 修复
- [ ] 提交微信审核

---

## 九、商业化设计

### 免费版
- 1 个 active 目标
- AI 每日行动生成
- 基础打卡 + 连续天数
- 每周 AI 周报（文字）

### Pro 版（¥29/月 · ¥199/年）
- 最多 3 个目标（并行守护）
- 完整 AI 复盘对话（不限次数）
- 周报分享卡片
- 历史数据导出
- 优先响应（Sonnet 替代 Haiku）

### 增长飞轮
```
完成打卡 → 生成分享卡片 → 朋友圈曝光
→ 好奇点击 → 扫码进入 → 新用户 onboarding
```

---

## 十、关键风险 & 对策

| 风险 | 概率 | 对策 |
|------|------|------|
| Claude API 延迟 >3s | 中 | Haiku 首选 + streaming 显示打字状态 |
| 微信订阅消息审核 | 中 | 提前申请模板，准备备用文案 |
| 用户 Day 3 流失 | 高 | Day 2 推送特别设计，降低第 3 天难度 |
| 目标拆解质量差 | 低 | Sonnet 生成 + 人工后验样本（冷启动 100 条）|
| 微信支付接入慢 | 中 | Week 3 开始申请，预留 1 周审核时间 |
