import type {
  User, Goal, Session, Checkin,
  OnboardingPayload, OnboardingResult,
  CheckinPayload, CheckinResult,
  WeeklyReport, ChatMessage, GoalStatus,
} from '../types/index'
import {
  mockWxLogin, mockCreateGoal, mockGetGoals, mockGetTodaySession,
  mockGetTodayCheckin, mockSubmitCheckin, mockStreamChatMessage,
  mockGetWeeklyReport, mockUpdateGoalStatus,
} from './mock'

// ← 改成 true 开启本地 mock，不需要后端
const USE_MOCK = true

const BASE_URL = 'https://rise.likai.me'
const TIMEOUT = 10000

// ── Raw backend shapes (snake_case) ─────────────────────────────────────────

interface RawUser {
  id: string
  nickname: string | null
  avatar: string | null
  plan: 'free' | 'pro'
  plan_expire: string | null
  onboarded: boolean
  timezone: string
  created_at: string
}

interface RawGoal {
  id: string
  user_id: string
  title: string
  category: string
  raw_input: string
  blocker: string | null
  phase_name: string | null
  phase_target: string | null
  phase_duration_days: number
  daily_minutes: number
  prefer_time: string
  start_date: string
  status: 'active' | 'paused' | 'completed' | 'archived'
  ai_plan: Goal['aiPlan'] | null
  created_at: string
}

interface RawSession {
  id: string
  user_id: string
  goal_id: string
  date: string
  day_index: number
  action: string
  estimated_min: number
  status: 'pending' | 'done' | 'skipped'
  actual_min: number | null
  skipped_reason: string | null
  generated_at: string
}

interface RawCheckin {
  id: string
  user_id: string
  session_id: string
  goal_id: string
  date: string
  mood: 'hard' | 'ok' | 'good' | 'great'
  note: string | null
  focus_min: number
  streak_day: number
  created_at: string
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapUser(r: RawUser): User {
  return {
    _id: r.id,
    nickname: r.nickname ?? '',
    avatar: r.avatar ?? '',
    plan: r.plan,
    planExpire: r.plan_expire,
    onboarded: r.onboarded,
    timezone: r.timezone,
    createdAt: r.created_at,
  }
}

function mapGoal(r: RawGoal): Goal {
  return {
    _id: r.id,
    userId: r.user_id,
    title: r.title,
    category: r.category as Goal['category'],
    rawInput: r.raw_input,
    blocker: (r.blocker ?? 'no_time') as Goal['blocker'],
    phase: {
      name: r.phase_name ?? '',
      target: r.phase_target ?? '',
      durationDays: r.phase_duration_days,
    },
    dailyMinutes: r.daily_minutes,
    preferTime: r.prefer_time,
    startDate: r.start_date,
    status: r.status,
    aiPlan: r.ai_plan ?? {
      goalTitle: r.title,
      phase: { name: r.phase_name ?? '', target: r.phase_target ?? '', durationDays: r.phase_duration_days },
      dailyActions: [],
      recommendTime: r.prefer_time,
      dailyMinutes: r.daily_minutes,
      encouragement: '',
    },
    createdAt: r.created_at,
  }
}

function mapSession(r: RawSession): Session {
  return {
    _id: r.id,
    userId: r.user_id,
    goalId: r.goal_id,
    date: r.date,
    dayIndex: r.day_index,
    action: r.action,
    estimatedMin: r.estimated_min,
    status: r.status,
    actualMin: r.actual_min,
    skippedReason: r.skipped_reason,
    generatedAt: r.generated_at,
  }
}

function mapCheckin(r: RawCheckin): Checkin {
  return {
    _id: r.id,
    userId: r.user_id,
    sessionId: r.session_id,
    goalId: r.goal_id,
    date: r.date,
    mood: r.mood,
    note: r.note ?? '',
    focusMin: r.focus_min,
    streakDay: r.streak_day,
    createdAt: r.created_at,
  }
}

// ── HTTP client ───────────────────────────────────────────────────────────────

function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  data?: Record<string, unknown>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token') as string
    wx.request({
      url: `${BASE_URL}${path}`,
      method,
      data,
      timeout: TIMEOUT,
      header: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T)
        } else {
          const body = res.data as { error?: string }
          reject(new Error(body?.error ?? `HTTP ${res.statusCode}`))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg ?? '网络错误'))
      },
    })
  })
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function wxLogin(): Promise<{ token: string; user: User }> {
  if (USE_MOCK) return mockWxLogin()
  return new Promise((resolve, reject) => {
    wx.login({
      success: async (loginRes) => {
        if (!loginRes.code) { reject(new Error('wx.login 失败')); return }
        try {
          const res = await request<{ token: string; user: RawUser }>(
            '/auth/login', 'POST', { code: loginRes.code },
          )
          wx.setStorageSync('token', res.token)
          resolve({ token: res.token, user: mapUser(res.user) })
        } catch (e) { reject(e) }
      },
      fail: (err) => reject(new Error(err.errMsg)),
    })
  })
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export async function createGoal(payload: OnboardingPayload): Promise<OnboardingResult> {
  if (USE_MOCK) return mockCreateGoal(payload)
  const res = await request<{ goal: RawGoal; session: RawSession }>(
    '/goals', 'POST', payload as unknown as Record<string, unknown>,
  )
  return { goal: mapGoal(res.goal), session: mapSession(res.session) }
}

export async function getGoals(): Promise<Goal[]> {
  if (USE_MOCK) return mockGetGoals()
  const res = await request<{ goals: RawGoal[] }>('/goals', 'GET')
  return res.goals.map(mapGoal)
}

export async function getTodaySession(goalId: string): Promise<Session> {
  if (USE_MOCK) return mockGetTodaySession(goalId)
  const res = await request<{ session: RawSession }>(`/goals/${goalId}/session`, 'GET')
  return mapSession(res.session)
}

export async function updateGoalStatus(goalId: string, status: GoalStatus): Promise<Goal> {
  if (USE_MOCK) return mockUpdateGoalStatus(goalId, status)
  const res = await request<{ goal: RawGoal }>(`/goals/${goalId}`, 'PUT', { status })
  return mapGoal(res.goal)
}

// ── Checkin ───────────────────────────────────────────────────────────────────

export async function getTodayCheckin(): Promise<Checkin[]> {
  if (USE_MOCK) return mockGetTodayCheckin()
  const res = await request<{ checkins: Array<RawCheckin & { action: string }> }>('/checkin/today', 'GET')
  return res.checkins.map(mapCheckin)
}

export async function submitCheckin(payload: CheckinPayload): Promise<CheckinResult> {
  if (USE_MOCK) return mockSubmitCheckin(payload)
  const res = await request<{ checkin: RawCheckin; streakDay: number; isNewRecord: boolean }>(
    '/checkin', 'POST', payload as unknown as Record<string, unknown>,
  )
  return { checkin: mapCheckin(res.checkin), streakDay: res.streakDay, isNewRecord: res.isNewRecord }
}

// ── AI Chat (streaming via chunked transfer) ──────────────────────────────────

export function streamChatMessage(
  goalId: string,
  checkinId: string | undefined,
  messages: ChatMessage[],
  onChunk: (delta: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): WechatMiniprogram.RequestTask {
  if (USE_MOCK) return mockStreamChatMessage(goalId, checkinId, messages, onChunk, onDone, onError)
  const token = wx.getStorageSync('token') as string
  const task = wx.request({
    url: `${BASE_URL}/ai/chat`,
    method: 'POST',
    data: {
      goalId,
      checkinId,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    },
    header: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'text/plain',
    },
    enableChunked: true,
    responseType: 'text',
    success() { onDone() },
    fail(err) { onError(new Error(err.errMsg ?? 'stream error')) },
  })
  task.onChunkReceived((res) => {
    const text = String.fromCharCode(...new Uint8Array(res.data))
    onChunk(text)
  })
  return task
}

// ── Weekly Report ─────────────────────────────────────────────────────────────

export async function getWeeklyReport(weekOffset = 0): Promise<WeeklyReport> {
  if (USE_MOCK) return mockGetWeeklyReport(weekOffset)
  const res = await request<{
    week: { monday: string; sunday: string; completedDays: number; totalDays: number }
    goal: RawGoal
    sessions: Array<{ date: string; action: string; status: string; actual_min: number | null; mood: string | null; note: string | null }>
    insight: { breakthrough: string; observation: string; nextWeekDirection: string }
  }>(`/report/weekly${weekOffset > 0 ? `?offset=${weekOffset}` : ''}`, 'GET')

  const totalFocusMin = res.sessions.reduce((s, r) => s + (r.actual_min ?? 0), 0)
  const dailyData = res.sessions.map(s => ({
    date: s.date,
    action: s.action,
    mood: (s.mood as WeeklyReport['dailyData'][0]['mood']) ?? null,
    focusMin: s.actual_min ?? 0,
    status: s.status as WeeklyReport['dailyData'][0]['status'],
  }))

  return {
    weekLabel: `${res.week.monday} ~ ${res.week.sunday}`,
    completedDays: res.week.completedDays,
    totalDays: res.week.totalDays,
    totalFocusMin,
    streakMax: 0,
    highlight: res.insight.breakthrough,
    aiObservation: res.insight.observation,
    nextWeekDirection: res.insight.nextWeekDirection,
    dailyData,
  }
}
