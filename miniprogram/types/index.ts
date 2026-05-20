export interface User {
  _id: string        // openid
  nickname: string
  avatar: string
  timezone: string
  plan: 'free' | 'pro'
  planExpire: string | null
  onboarded: boolean
  createdAt: string
}

export type GoalCategory = 'work' | 'health' | 'learn' | 'fin' | 'create' | 'relate' | 'custom'
export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived'
export type BlockerType = 'no_time' | 'no_start' | 'interrupted' | 'fear'

export interface GoalPhase {
  name: string
  target: string
  durationDays: number
}

export interface DailyActionTemplate {
  dayRange: string
  theme: string
  example: string
}

export interface AIPlan {
  goalTitle: string
  phase: GoalPhase
  dailyActions: DailyActionTemplate[]
  recommendTime: string
  dailyMinutes: number
  encouragement: string
}

export interface Goal {
  _id: string
  userId: string
  title: string
  category: GoalCategory
  rawInput: string
  blocker: BlockerType
  phase: GoalPhase
  dailyMinutes: number
  preferTime: string
  startDate: string
  status: GoalStatus
  aiPlan: AIPlan
  createdAt: string
}

export type SessionStatus = 'pending' | 'done' | 'skipped'

export interface Session {
  _id: string
  userId: string
  goalId: string
  date: string
  dayIndex: number
  action: string
  estimatedMin: number
  status: SessionStatus
  actualMin: number | null
  skippedReason: string | null
  generatedAt: string
}

export type MoodType = 'hard' | 'ok' | 'good' | 'great'

export interface Checkin {
  _id: string
  userId: string
  sessionId: string
  goalId: string
  date: string
  mood: MoodType
  note: string
  focusMin: number
  streakDay: number
  createdAt: string
}

// API response wrappers
export interface ApiResponse<T> {
  code: number
  data: T
  message?: string
}

export interface OnboardingPayload {
  rawInput: string
  category: GoalCategory
  blocker: BlockerType
  availableTime: string
  dailyMinutes: number
}

export interface OnboardingResult {
  goal: Goal
  session: Session
}

export interface CheckinPayload {
  sessionId: string
  goalId: string
  mood: MoodType
  note: string
  focusMin: number
}

export interface CheckinResult {
  checkin: Checkin
  streakDay: number
  isNewRecord: boolean
}

export interface WeeklyReport {
  weekLabel: string
  completedDays: number
  totalDays: number
  totalFocusMin: number
  streakMax: number
  highlight: string
  aiObservation: string
  nextWeekDirection: string
  dailyData: Array<{
    date: string
    action: string
    mood: MoodType | null
    focusMin: number
    status: SessionStatus
  }>
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
