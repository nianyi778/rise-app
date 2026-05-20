import type { User, Goal, Session, Checkin, ChatMessage } from '../types/index'

interface StoreState {
  userInfo: User | null
  currentGoal: Goal | null
  todaySession: Session | null
  recentCheckins: Checkin[]
  streakDays: number
  chatHistory: ChatMessage[]
  isLoading: boolean
  hasOnboarded: boolean
}

const defaultState: StoreState = {
  userInfo: null,
  currentGoal: null,
  todaySession: null,
  recentCheckins: [],
  streakDays: 0,
  chatHistory: [],
  isLoading: false,
  hasOnboarded: false,
}

// 轻量响应式 store，基于发布订阅
type Listener = (state: StoreState) => void

class Store {
  private state: StoreState = { ...defaultState }
  private listeners: Set<Listener> = new Set()

  getState(): Readonly<StoreState> {
    return this.state
  }

  setState(patch: Partial<StoreState>): void {
    this.state = { ...this.state, ...patch }
    this.notify()
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private notify(): void {
    this.listeners.forEach(fn => fn(this.state))
  }

  // 便捷 setter
  setUser(user: User): void {
    this.setState({ userInfo: user, hasOnboarded: user.onboarded })
  }

  setCurrentGoal(goal: Goal | null): void {
    this.setState({ currentGoal: goal })
  }

  setTodaySession(session: Session | null): void {
    this.setState({ todaySession: session })
  }

  setStreakDays(days: number): void {
    this.setState({ streakDays: days })
  }

  appendCheckin(checkin: Checkin): void {
    this.setState({
      recentCheckins: [checkin, ...this.state.recentCheckins].slice(0, 30),
      streakDays: checkin.streakDay,
    })
  }

  pushChatMessage(msg: ChatMessage): void {
    this.setState({
      chatHistory: [...this.state.chatHistory, msg],
    })
  }

  clearChatHistory(): void {
    this.setState({ chatHistory: [] })
  }

  setLoading(loading: boolean): void {
    this.setState({ isLoading: loading })
  }

  reset(): void {
    this.state = { ...defaultState }
    this.notify()
  }
}

export const store = new Store()
export type { StoreState }
