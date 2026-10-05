import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const DAILY_CLAIM_STREAK_DAYS = 7;

/** Multipliers on base credits: day 3 = 2×, day 7 = 4×; other days 1×. */
export function dailyClaimRewardForDay(streakDay: number, baseCredits?: number): number {
  const base = baseCredits ?? dailyClaimBaseCredits();
  const day = Math.max(1, Math.min(DAILY_CLAIM_STREAK_DAYS, Math.floor(streakDay)));
  const mult = day === 3 ? 2 : day === 7 ? 4 : 1;
  return base * mult;
}

export function dailyClaimBaseCredits(): number {
  const raw = Deno.env.get("DAILY_CLAIM_BASE_CREDITS");
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 2;
}

export function buildDailyClaimSchedule(baseCredits?: number) {
  const base = baseCredits ?? dailyClaimBaseCredits();
  return Array.from({ length: DAILY_CLAIM_STREAK_DAYS }, (_, i) => {
    const day = i + 1;
    return { day, credits: dailyClaimRewardForDay(day, base) };
  });
}

function utcDateString(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

type ClaimRow = {
  claim_month_start?: string | null;
  claim_days_completed?: number | null;
  last_claim_utc_date?: string | null;
  credits_balance?: number | null;
};

/** Days claimed this UTC month (1–7). Missing calendar days do not reset progress. */
export function effectiveClaimDaysCompleted(row: ClaimRow, _today = utcDateString()): number {
  const monthStart = startOfUtcMonth();
  const storedMonth = row.claim_month_start ? Date.parse(String(row.claim_month_start)) : 0;
  if (!storedMonth || storedMonth < monthStart.getTime()) return 0;

  const completed = Number(row.claim_days_completed ?? 0);
  return Math.max(0, Math.min(DAILY_CLAIM_STREAK_DAYS, completed));
}

export function canClaimToday(row: ClaimRow, today = utcDateString()): boolean {
  const monthStart = startOfUtcMonth();
  const storedMonth = row.claim_month_start ? Date.parse(String(row.claim_month_start)) : 0;
  if (!storedMonth || storedMonth < monthStart.getTime()) return true;

  const last = row.last_claim_utc_date ? String(row.last_claim_utc_date) : "";
  if (last === today) return false;

  const effective = effectiveClaimDaysCompleted(row, today);
  return effective < DAILY_CLAIM_STREAK_DAYS;
}

export function nextClaimStreakDay(row: ClaimRow, today = utcDateString()): number | null {
  if (!canClaimToday(row, today)) return null;
  return effectiveClaimDaysCompleted(row, today) + 1;
}

export function nextClaimReward(row: ClaimRow, today = utcDateString()): number | null {
  const next = nextClaimStreakDay(row, today);
  if (!next) return null;
  return dailyClaimRewardForDay(next);
}

export function dailyClaimStatusFromRow(row: ClaimRow) {
  const today = utcDateString();
  const base = dailyClaimBaseCredits();
  const schedule = buildDailyClaimSchedule(base);
  const effectiveCompleted = effectiveClaimDaysCompleted(row, today);
  const nextDay = nextClaimStreakDay(row, today);
  const claimable = canClaimToday(row, today);

  return {
    streakDaysCompleted: effectiveCompleted,
    canClaimToday: claimable,
    nextStreakDay: nextDay,
    nextReward: nextDay ? dailyClaimRewardForDay(nextDay, base) : null,
    baseCreditsPerDay: base,
    schedule: schedule.map((s) => ({
      ...s,
      claimed: s.day <= effectiveCompleted,
      isBonusDay: s.day === 3 || s.day === 7,
    })),
    allClaimedThisMonth: effectiveCompleted >= DAILY_CLAIM_STREAK_DAYS && !claimable,
    claimMonthStart: row.claim_month_start || startOfUtcMonth().toISOString(),
  };
}

async function resetClaimMonthIfNeeded(admin: SupabaseClient, userId: string, row: ClaimRow) {
  const monthStart = startOfUtcMonth();
  const storedMonth = row.claim_month_start ? Date.parse(String(row.claim_month_start)) : 0;
  if (storedMonth && storedMonth >= monthStart.getTime()) return row;

  const { error } = await admin
    .from("user_billing")
    .update({
      claim_month_start: monthStart.toISOString(),
      claim_days_completed: 0,
      last_claim_utc_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return {
    ...row,
    claim_month_start: monthStart.toISOString(),
    claim_days_completed: 0,
    last_claim_utc_date: null,
  };
}

export async function getDailyClaimStatus(admin: SupabaseClient, userId: string) {
  const { data: row } = await admin
    .from("user_billing")
    .select("claim_month_start, claim_days_completed, last_claim_utc_date, credits_balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) {
    return dailyClaimStatusFromRow({});
  }

  const synced = await resetClaimMonthIfNeeded(admin, userId, row);
  return dailyClaimStatusFromRow(synced);
}

export class DailyClaimError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function performDailyClaim(admin: SupabaseClient, userId: string) {
  const { data: row } = await admin
    .from("user_billing")
    .select("claim_month_start, claim_days_completed, last_claim_utc_date, credits_balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) throw new DailyClaimError("NO_BILLING", "Billing profile missing.", 404);

  const synced = await resetClaimMonthIfNeeded(admin, userId, row);
  const today = utcDateString();

  if (!canClaimToday(synced, today)) {
    const last = synced.last_claim_utc_date ? String(synced.last_claim_utc_date) : "";
    if (last === today) {
      throw new DailyClaimError("ALREADY_CLAIMED", "You already claimed today's credits.", 409);
    }
    throw new DailyClaimError("CLAIM_COMPLETE", "All 7 daily claims finished for this month.", 400);
  }

  const completed = effectiveClaimDaysCompleted(synced, today);
  const nextDay = completed + 1;
  const reward = dailyClaimRewardForDay(nextDay);
  const balanceAfter = Number(synced.credits_balance ?? 0) + reward;
  const monthStart = startOfUtcMonth().toISOString();

  const { error: updErr } = await admin
    .from("user_billing")
    .update({
      credits_balance: balanceAfter,
      claim_month_start: monthStart,
      claim_days_completed: nextDay,
      last_claim_utc_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (updErr) throw new Error(updErr.message);

  await admin.from("credit_ledger").insert({
    user_id: userId,
    delta: reward,
    balance_after: balanceAfter,
    action: "daily_claim",
    metadata: { streakDay: nextDay, reward, month: monthStart },
  });

  return {
    claimed: true,
    streakDay: nextDay,
    reward,
    creditsBalance: balanceAfter,
    dailyClaim: dailyClaimStatusFromRow({
      claim_month_start: monthStart,
      claim_days_completed: nextDay,
      last_claim_utc_date: today,
      credits_balance: balanceAfter,
    }),
  };
}
