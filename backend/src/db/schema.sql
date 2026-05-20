-- users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nickname TEXT,
  avatar TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  plan_expire TIMESTAMPTZ,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- goals
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  raw_input TEXT NOT NULL,
  blocker TEXT,
  phase_name TEXT,
  phase_target TEXT,
  phase_duration_days INTEGER NOT NULL DEFAULT 21,
  daily_minutes INTEGER NOT NULL DEFAULT 25,
  prefer_time TEXT NOT NULL DEFAULT '21:00',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active',
  ai_plan JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS goals_user_id_idx ON goals(user_id);
CREATE INDEX IF NOT EXISTS goals_status_idx ON goals(status);

-- sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_index INTEGER NOT NULL DEFAULT 1,
  action TEXT NOT NULL,
  estimated_min INTEGER NOT NULL DEFAULT 25,
  status TEXT NOT NULL DEFAULT 'pending',
  actual_min INTEGER,
  skipped_reason TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(goal_id, date)
);
CREATE INDEX IF NOT EXISTS sessions_user_date_idx ON sessions(user_id, date);

-- checkins
CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mood TEXT NOT NULL,
  note TEXT,
  focus_min INTEGER NOT NULL DEFAULT 25,
  streak_day INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS checkins_user_idx ON checkins(user_id, date);
