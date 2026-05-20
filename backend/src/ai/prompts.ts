import type { Checkin, Goal } from '../types/index.js';

// ── Goal Plan (Sonnet) ──────────────────────────────────────────────────────

export const GOAL_PLAN_SYSTEM = `你是 Rise 的 AI 目标教练。用温暖、直接的语气，像一个聪明的朋友，而非效率工具。

你的任务：根据用户描述的目标，生成一份结构化执行方案。

输出严格遵循以下 JSON 格式，不要有任何其他文字：
{
  "goalTitle": "简洁目标名（4-8字）",
  "phase": {
    "name": "第一阶段名称",
    "target": "具体里程碑",
    "durationDays": 21
  },
  "dailyActions": [
    { "dayRange": "1-7",   "theme": "主题", "example": "具体示例行动" },
    { "dayRange": "8-14",  "theme": "主题", "example": "具体示例行动" },
    { "dayRange": "15-21", "theme": "主题", "example": "具体示例行动" }
  ],
  "recommendTime": "21:00",
  "dailyMinutes": 25,
  "encouragement": "一句温暖的话（20字内）"
}`;

export function buildGoalPlanPrompt(
  rawInput: string,
  blocker: string | undefined,
  availableTime: string | undefined,
  dailyMinutes: number
): string {
  return `目标描述：${rawInput}
最大阻力：${blocker ?? '未填写'}
可用时间段：${availableTime ?? '晚上'}
每天能投入时间：${dailyMinutes} 分钟`;
}

// ── Daily Action (Haiku) ────────────────────────────────────────────────────

export const DAILY_ACTION_SYSTEM = `你是 Rise AI 教练。每天为用户生成今日具体行动。
行动必须：具体可操作、25分钟内可完成、承接昨日进展。
只输出行动本身，不要解释，不要加引号。`;

export function buildDailyActionPrompt(
  goal: Pick<Goal, 'title' | 'phase_name' | 'phase_target'>,
  dayIndex: number,
  yesterdayCheckin: (Pick<Checkin, 'mood'> & { action?: string }) | null
): string {
  const yesterday = yesterdayCheckin
    ? `昨日完成：${yesterdayCheckin.action ?? '未记录'}（已完成）\n昨日心情：${yesterdayCheckin.mood}`
    : '昨日进展：无记录（今天是第一天）';

  return `目标：${goal.title}
阶段：${goal.phase_name ?? '执行期'}（${goal.phase_target ?? '稳步推进'}）
今天是第 ${dayIndex} 天
${yesterday}

生成今日行动（一句话，20字以内，具体可操作）：`;
}

// ── Reflection Chat (Haiku, streaming) ─────────────────────────────────────

export const REFLECTION_SYSTEM = `你是 Rise AI 教练，用户刚完成今日目标。进行简短温暖的复盘对话。
- 先肯定，再问感受
- 根据心情调整语气：great=庆祝，hard=安慰，ok/good=鼓励
- 最多 3 轮对话，不啰嗦
- 回复控制在 60 字以内`;

export function buildReflectionPrompt(
  messages: Array<{ role: string; content: string }>,
  goal: Pick<Goal, 'title'>,
  checkin: Pick<Checkin, 'mood' | 'note'>
): string {
  const history =
    messages.length > 0
      ? '\n\n对话历史：\n' +
        messages.map((m) => `${m.role === 'user' ? '用户' : 'Rise'}：${m.content}`).join('\n')
      : '';

  return `今日完成：${goal.title}
心情：${checkin.mood}
备注：${checkin.note ?? '无'}${history}`;
}

// ── Weekly Report (Sonnet) ──────────────────────────────────────────────────

export const WEEKLY_REPORT_SYSTEM = `你是 Rise AI 教练，生成用户本周目标报告。
输出：温暖、个人化、有洞察，像朋友的周末总结，不像 KPI 汇报。
严格输出以下 JSON，不要有其他文字：
{
  "breakthrough": "本周最大突破（1句，20字内）",
  "observation": "AI 观察（2-3句，说出用户可能没意识到的模式）",
  "nextWeekDirection": "下周方向（1句，20字内）"
}`;

export function buildWeeklyReportPrompt(
  nickname: string | null,
  goal: Pick<Goal, 'title'>,
  weekData: {
    weekStartDay: number;
    weekEndDay: number;
    completedDays: number;
    details: Array<{ date: string; action: string; mood?: string; note?: string }>;
  }
): string {
  const details =
    weekData.details.length > 0
      ? weekData.details
          .map(
            (d) =>
              `${d.date}：${d.action}（心情：${d.mood ?? '无打卡'}${d.note ? '，备注：' + d.note : ''}）`
          )
          .join('\n')
      : '本周暂无打卡记录';

  return `用户：${nickname ?? '用户'}
目标：${goal.title}，第 ${weekData.weekStartDay}-${weekData.weekEndDay} 天
本周打卡：${weekData.completedDays}/7 天
各日行动和心情：
${details}`;
}
