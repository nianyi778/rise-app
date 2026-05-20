export interface User {
  id: string;
  nickname: string | null;
  avatar: string | null;
  plan: 'free' | 'pro';
  plan_expire: Date | null;
  onboarded: boolean;
  timezone: string;
  created_at: Date;
}

export interface AiPlan {
  goalTitle: string;
  phase: {
    name: string;
    target: string;
    durationDays: number;
  };
  dailyActions: Array<{
    dayRange: string;
    theme: string;
    example: string;
  }>;
  recommendTime: string;
  dailyMinutes: number;
  encouragement: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  category: string;
  raw_input: string;
  blocker: string | null;
  phase_name: string | null;
  phase_target: string | null;
  phase_duration_days: number;
  daily_minutes: number;
  prefer_time: string;
  start_date: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  ai_plan: AiPlan | null;
  created_at: Date;
}

export interface Session {
  id: string;
  user_id: string;
  goal_id: string;
  date: string;
  day_index: number;
  action: string;
  estimated_min: number;
  status: 'pending' | 'done' | 'skipped';
  actual_min: number | null;
  skipped_reason: string | null;
  generated_at: Date;
}

export interface Checkin {
  id: string;
  user_id: string;
  session_id: string;
  goal_id: string;
  date: string;
  mood: 'hard' | 'ok' | 'good' | 'great';
  note: string | null;
  focus_min: number;
  streak_day: number;
  created_at: Date;
}

export type Variables = {
  userId: string;
};

export type AppEnv = {
  Variables: Variables;
};
