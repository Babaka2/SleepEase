/// <reference types="vite/client" />

import { auth } from '../lib/firebaseClient';

const API_BASE_URL = import.meta.env.DEV ? '/api' : 'https://sleepease-backend.onrender.com';

export interface HomeStats {
  streak: number;
  sleepIndexPct: number;
  stabilityPct: number;
  engagementCount: number;
  islamicCheckIns: number;
  reflectionCount: number;
}

type AppMode = 'general' | 'islamic';

interface OpenApiSchema {
  paths?: Record<string, unknown>;
}

interface StreakResponse {
  streak?: number;
}

interface SleepIndexResponse {
  sleep_improvement_index?: number;
}

interface EmotionalTrendResponse {
  avg_stability?: number;
}

interface EngagementResponse {
  total_30d_logs?: number;
}

interface MoodHistoryItem {
  mode?: string;
  emotion?: string;
  note?: string;
  content?: string;
  date?: string;
  created_at?: string;
}

interface SleepHistoryItem {
  hours?: number;
  quality?: number;
  mood?: string;
  date?: string;
  created_at?: string;
}

interface SleepHistoryResponse {
  data?: SleepHistoryItem[];
}

const pathSupportCache = new Map<string, boolean>();

async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not logged in');
  }
  return user.getIdToken();
}

async function fetchWithAuth<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }

  return response.json() as Promise<T>;
}

async function hasPath(path: string): Promise<boolean> {
  if (pathSupportCache.has(path)) {
    return Boolean(pathSupportCache.get(path));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/openapi.json`);
    if (!response.ok) {
      pathSupportCache.set(path, false);
      return false;
    }

    const schema = await response.json() as OpenApiSchema;
    const supported = Boolean(schema.paths && Object.prototype.hasOwnProperty.call(schema.paths, path));
    pathSupportCache.set(path, supported);
    return supported;
  } catch {
    pathSupportCache.set(path, false);
    return false;
  }
}

function parseLegacyMode(content?: string): AppMode {
  const raw = String(content || '').toLowerCase();
  return raw.includes('mode:islamic') ? 'islamic' : 'general';
}

function parseLegacyMood(content?: string): { mode: AppMode; note?: string; emotion?: string } {
  const raw = String(content || '');
  const emotionMatch = raw.match(/mood:([^;]+)/i);
  const modeMatch = raw.match(/mode:([^;]+)/i);
  const noteMatch = raw.match(/note:(.*)$/i);

  return {
    emotion: emotionMatch?.[1]?.trim(),
    mode: (modeMatch?.[1]?.trim().toLowerCase() === 'islamic' ? 'islamic' : 'general'),
    note: noteMatch?.[1]?.trim() || undefined,
  };
}

function normalizeListPayload<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const candidates = ['data', 'items', 'results', 'entries', 'logs'];
    for (const key of candidates) {
      const candidate = record[key];
      if (Array.isArray(candidate)) {
        return candidate as T[];
      }
    }
  }

  return [];
}

function buildStreakFromDates(entries: MoodHistoryItem[]): number {
  const dates = new Set(
    entries
      .map((entry) => {
        const raw = String(entry.date || entry.created_at || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0];
      })
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
  );

  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = cursor.toISOString().split('T')[0];
    if (!dates.has(key)) {
      if (streak === 0) {
        cursor.setDate(cursor.getDate() - 1);
        const yesterday = cursor.toISOString().split('T')[0];
        if (!dates.has(yesterday)) {
          return 0;
        }
      } else {
        break;
      }
    } else {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }

    while (dates.has(cursor.toISOString().split('T')[0])) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    break;
  }

  return streak;
}

function getFulfilledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

export async function fetchHomeStats(mode: AppMode): Promise<HomeStats> {
  const token = await getAuthToken();
  const uid = auth.currentUser?.uid || '';

  const [modernStreak, modernSleepIndex, modernTrend, modernEngagement, modernMood] = await Promise.all([
    hasPath('/logs/streak'),
    hasPath('/analytics/sleep_index'),
    hasPath('/analytics/emotional_trend'),
    hasPath('/analytics/engagement'),
    hasPath('/logs/mood'),
  ]);

  const [streakResult, sleepIndexResult, trendResult, engagementResult, moodResult, legacyGratitudeResult, sleepHistoryResult] = await Promise.allSettled([
    modernStreak ? fetchWithAuth<StreakResponse>('/logs/streak', token) : Promise.resolve({}),
    modernSleepIndex ? fetchWithAuth<SleepIndexResponse>('/analytics/sleep_index', token) : Promise.resolve({}),
    modernTrend ? fetchWithAuth<EmotionalTrendResponse>('/analytics/emotional_trend', token) : Promise.resolve({}),
    modernEngagement ? fetchWithAuth<EngagementResponse>('/analytics/engagement', token) : Promise.resolve({}),
    modernMood ? fetchWithAuth<MoodHistoryItem[]>('/logs/mood?limit=100', token) : Promise.resolve([]),
    fetchWithAuth<unknown>('/gratitude/list?user_id=' + encodeURIComponent(uid), token),
    fetchWithAuth<SleepHistoryResponse>('/sleep/history?user_id=' + encodeURIComponent(uid), token),
  ]);

  const streakData = getFulfilledValue<StreakResponse>(streakResult, {});
  const sleepIndexData = getFulfilledValue<SleepIndexResponse>(sleepIndexResult, {});
  const trendData = getFulfilledValue<EmotionalTrendResponse>(trendResult, {});
  const engagementData = getFulfilledValue<EngagementResponse>(engagementResult, {});
  const moodData = normalizeListPayload<MoodHistoryItem>(getFulfilledValue<unknown>(moodResult, []));
  const legacyGratitudeData = normalizeListPayload<MoodHistoryItem>(getFulfilledValue<unknown>(legacyGratitudeResult, []));
  const sleepHistoryData = normalizeListPayload<SleepHistoryItem>(getFulfilledValue<SleepHistoryResponse>(sleepHistoryResult, {}).data ?? []);

  const normalizedLegacyMoodData: MoodHistoryItem[] = legacyGratitudeData.map((entry) => {
    const parsed = parseLegacyMood(entry.content);
    return {
      ...entry,
      mode: parsed.mode,
      note: parsed.note,
      emotion: parsed.emotion,
      created_at: entry.created_at || entry.date,
    };
  });

  const allMoodData = moodData.length > 0 ? moodData : normalizedLegacyMoodData;
  const scopedMoodData = allMoodData.filter((entry) => {
    const entryMode = String(entry.mode ?? '').toLowerCase();
    return mode === 'islamic' ? entryMode === 'islamic' : entryMode !== 'islamic';
  });
  const relevantMoodData = scopedMoodData.length > 0 ? scopedMoodData : allMoodData;

  const fallbackStreak = buildStreakFromDates(relevantMoodData);
  const fallbackEngagement = relevantMoodData.length + sleepHistoryData.length;
  const fallbackIslamic = relevantMoodData.length;
  const fallbackReflections = relevantMoodData.filter((entry) => String(entry.note || '').trim().length > 0).length;
  const fallbackSleepIndex = sleepHistoryData.length > 0
    ? Math.round(
        sleepHistoryData.reduce((sum, entry) => sum + Math.max(0, Math.min(10, Number(entry.quality ?? 0))), 0) /
        sleepHistoryData.length * 10
      )
    : 0;
  const moodScoreMap: Record<string, number> = {
    peaceful: 90,
    grateful: 85,
    calm: 80,
    happy: 80,
    seeking: 60,
    tired: 45,
    worried: 40,
    anxious: 35,
    overwhelmed: 30,
    sad: 35,
  };
  const fallbackStability = relevantMoodData.length > 0
    ? Math.round(
        relevantMoodData.reduce((sum, entry) => {
          const emotion = String(entry.emotion ?? '').toLowerCase();
          return sum + (moodScoreMap[emotion] ?? 50);
        }, 0) / relevantMoodData.length
      )
    : 0;

  const streak = Math.max(0, Number(streakData.streak ?? fallbackStreak));
  const sleepIndexPct = Math.max(0, Math.min(100, Math.round(Number(sleepIndexData.sleep_improvement_index ?? fallbackSleepIndex))));
  const stabilityPct = Math.max(0, Math.min(100, Math.round(Number(trendData.avg_stability ?? 0) * 100 || fallbackStability)));
  const engagementCount = Math.max(0, Number(engagementData.total_30d_logs ?? fallbackEngagement));
  const islamicCheckIns = Math.max(0, fallbackIslamic);
  const reflectionCount = Math.max(0, fallbackReflections);

  if (mode === 'general') {
    return {
      streak,
      sleepIndexPct,
      stabilityPct,
      engagementCount,
      islamicCheckIns,
      reflectionCount,
    };
  }

  return {
    streak,
    sleepIndexPct,
    stabilityPct,
    engagementCount,
    islamicCheckIns,
    reflectionCount,
  };
}
