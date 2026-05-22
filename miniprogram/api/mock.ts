/**
 * Mock API — 本地测试用，后端不可用时开启
 * 在 index.ts 顶部把 USE_MOCK 改为 true 即可
 */

import type {
  User, Goal, Session, Checkin,
  OnboardingPayload, OnboardingResult,
  CheckinPayload, CheckinResult,
  WeeklyReport, ChatMessage,
} from '../types/index'

// ── 固定的 mock 实体 ──────────────────────────────────────────────────────────

const MOCK_USER: User = {
  _id: 'mock_user_001',
  nickname: '李凯',
  avatar: '',
  plan: 'free',
  planExpire: null,
  onboarded: false,
  timezone: 'Asia/Shanghai',
  createdAt: '2026-05-01T00:00:00Z',
}

let mockGoal: Goal | null = null
let mockSession: Session | null = null
let mockDayIndex = 12
let mockStreak = 5

function buildGoal(payload: OnboardingPayload): Goal {
  const today = new Date().toISOString().slice(0, 10)
  return {
    _id: 'mock_goal_001',
    userId: MOCK_USER._id,
    title: payload.rawInput.slice(0, 20) || '副业启动计划',
    category: payload.category,
    rawInput: payload.rawInput,
    blocker: payload.blocker,
    phase: {
      name: '启动期',
      target: '完成第一个可交付成果',
      durationDays: 21,
    },
    dailyMinutes: payload.dailyMinutes,
    preferTime: payload.availableTime,
    startDate: today,
    status: 'active',
    aiPlan: {
      goalTitle: payload.rawInput.slice(0, 20) || '副业启动计划',
      phase: { name: '启动期', target: '完成第一个可交付成果', durationDays: 21 },
      dailyActions: [
        { dayRange: '1-7', theme: '梳理方向', example: '列出3个可以接的设计订单方向' },
        { dayRange: '8-14', theme: '建立存在感', example: '整理作品集，发布第一条展示内容' },
        { dayRange: '15-21', theme: '获得第一单', example: '主动联系2个潜在客户' },
      ],
      recommendTime: payload.availableTime,
      dailyMinutes: payload.dailyMinutes,
      encouragement: '你已经想了半年了，今天开始行动，就已经赢过99%的人。',
    },
    createdAt: today,
  }
}

function buildSession(goal: Goal): Session {
  const today = new Date().toISOString().slice(0, 10)
  return {
    _id: 'mock_session_001',
    userId: MOCK_USER._id,
    goalId: goal._id,
    date: today,
    dayIndex: mockDayIndex,
    action: '整理 3 个可以接的设计订单方向',
    estimatedMin: goal.dailyMinutes,
    status: 'pending',
    actualMin: null,
    skippedReason: null,
    generatedAt: new Date().toISOString(),
  }
}

// ── Mock API 函数 ─────────────────────────────────────────────────────────────

export async function mockWxLogin(): Promise<{ token: string; user: User }> {
  await delay(300)
  return { token: 'mock_token_abc123', user: { ...MOCK_USER } }
}

export async function mockCreateGoal(payload: OnboardingPayload): Promise<OnboardingResult> {
  await delay(1200) // 模拟 AI 生成延迟
  mockGoal = buildGoal(payload)
  mockSession = buildSession(mockGoal)
  MOCK_USER.onboarded = true
  return { goal: mockGoal, session: mockSession }
}

export async function mockGetGoals(): Promise<Goal[]> {
  await delay(200)
  return mockGoal ? [mockGoal] : [buildGoal({
    rawInput: '把副业做起来',
    category: 'work',
    blocker: 'no_time',
    availableTime: '21:00',
    dailyMinutes: 25,
  })]
}

export async function mockGetTodaySession(goalId: string): Promise<Session> {
  await delay(200)
  if (!mockGoal) {
    mockGoal = buildGoal({ rawInput: '把副业做起来', category: 'work', blocker: 'no_time', availableTime: '21:00', dailyMinutes: 25 })
  }
  if (!mockSession) {
    mockSession = buildSession(mockGoal)
  }
  return { ...mockSession }
}

export async function mockGetTodayCheckin(): Promise<Checkin[]> {
  await delay(200)
  return []
}

export async function mockSubmitCheckin(payload: CheckinPayload): Promise<CheckinResult> {
  await delay(400)
  mockStreak += 1
  const checkin: Checkin = {
    _id: 'mock_checkin_001',
    userId: MOCK_USER._id,
    sessionId: payload.sessionId,
    goalId: payload.goalId,
    date: new Date().toISOString().slice(0, 10),
    mood: payload.mood,
    note: payload.note,
    focusMin: payload.focusMin,
    streakDay: mockStreak,
    createdAt: new Date().toISOString(),
  }
  return { checkin, streakDay: mockStreak, isNewRecord: mockStreak % 7 === 0 }
}

export function mockStreamChatMessage(
  _goalId: string,
  _checkinId: string | undefined,
  messages: ChatMessage[],
  onChunk: (delta: string) => void,
  onDone: () => void,
  _onError: (err: Error) => void,
): WechatMiniprogram.RequestTask {
  const lastMsg = messages[messages.length - 1]?.content ?? ''

  let reply = '我听到你了。'
  if (lastMsg.includes('卡') || lastMsg.includes('不知道')) {
    reply = '卡住是正常的，说明你在认真对待这件事。今天只需要做一件事：打开文档，写下3个方向的名字。就这一步。'
  } else if (lastMsg.includes('没时间') || lastMsg.includes('忙')) {
    reply = '你今晚 21:00 之后有空吗？哪怕 20 分钟。我们只做一件小事，不要求完美。'
  } else if (lastMsg.includes('完成') || lastMsg.includes('做到')) {
    reply = '太好了！连续第 ' + mockStreak + ' 天，你已经在建立一个新的身份认同了。明天继续？'
  } else {
    const replies = [
      '你愿意说说今天的感受吗？',
      '听起来你在认真思考这件事，这很好。',
      '我觉得你比你自己想象的更有能力做到这件事。',
      '你觉得现在最大的阻力是什么？',
    ]
    reply = replies[Math.floor(Math.random() * replies.length)]
  }

  let i = 0
  const chars = reply.split('')
  const timer = setInterval(() => {
    if (i < chars.length) {
      onChunk(chars[i])
      i++
    } else {
      clearInterval(timer)
      onDone()
    }
  }, 40)

  return { abort: () => clearInterval(timer) } as unknown as WechatMiniprogram.RequestTask
}

export async function mockGetWeeklyReport(_weekOffset = 0): Promise<WeeklyReport> {
  await delay(400)
  const days = ['2026-05-16', '2026-05-17', '2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22']
  const statuses: Array<'done' | 'skipped' | 'pending'> = ['done', 'done', 'skipped', 'done', 'done', 'done', 'pending']
  const moods: Array<'hard' | 'ok' | 'good' | 'great' | null> = ['ok', 'good', null, 'good', 'great', 'great', null]
  return {
    weekLabel: '5月16日 ~ 5月22日',
    completedDays: 5,
    totalDays: 7,
    totalFocusMin: 125,
    streakMax: mockStreak,
    highlight: '周四完成了作品集整理，这是半年来第一次把想法落成了实际文件。',
    aiObservation: '这周你跳过了周三，但周四立刻恢复了。这说明你有很强的反弹能力，不会因为一次中断就放弃。',
    nextWeekDirection: '下周可以尝试联系 1-2 个潜在客户，哪怕只是发一条消息试探一下。',
    dailyData: days.map((date, i) => ({
      date,
      action: ['整理订单方向', '研究竞品定价', '休息', '完成作品集', '写第一篇介绍', '准备客户话术', '今日任务'][i],
      mood: moods[i],
      focusMin: statuses[i] === 'done' ? 25 : 0,
      status: statuses[i],
    })),
  }
}

export async function mockUpdateGoalStatus(_goalId: string, _status: string): Promise<Goal> {
  await delay(200)
  return mockGoal ?? buildGoal({ rawInput: '把副业做起来', category: 'work', blocker: 'no_time', availableTime: '21:00', dailyMinutes: 25 })
}

// ── 工具 ──────────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
