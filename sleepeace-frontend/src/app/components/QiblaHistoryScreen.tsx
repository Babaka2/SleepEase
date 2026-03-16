import { useState, useEffect, useMemo } from 'react';
import { 
  Home, 
  Compass, 
  User, 
  ChevronRight, 
  Moon,
  Calendar, 
  MessageCircle,
  Award,
  Target,
  Sparkles,
  TrendingUp,
  Activity,
  BarChart3,
  Clock,
  Flame,
  Star,
  BookOpen,
  ArrowLeft,
  Heart,
  Sun,
  Wind,
  Brain,
  Shield,
  BedDouble,
} from 'lucide-react';
import PhoneFrame from './PhoneFrame';
import { Language, translations } from '../translations';
import { getMoodHistory, type MoodEntry } from '../../services/mood';
import { fetchMyScores, type MyScores } from '../../services/analytics';

type Screen = 
  | 'mode-selection' 
  | 'general-home' 
  | 'islamic-home' 
  | 'mood-check-general' 
  | 'mood-check-islamic'
  | 'content-general'
  | 'content-islamic'
  | 'ai-chat'
  | 'ai-chat-islamic'
  | 'mood-history-general'
  | 'mood-history-islamic'
  | 'settings'
  | 'settings-islamic';

type Mode = 'general' | 'islamic' | null;

interface QiblaHistoryScreenProps {
  navigate: (screen: Screen, mode?: Mode) => void;
  currentLanguage: Language;
}

type MoodKey = 'peaceful' | 'grateful' | 'worried' | 'tired' | 'seeking';

const moodMeta: Record<MoodKey, { label: string; emoji: string; color: string; bgColor: string }> = {
  peaceful: { label: 'Peaceful', emoji: '🌙', color: 'text-emerald-400', bgColor: 'bg-emerald-400/30' },
  grateful: { label: 'Grateful', emoji: '🤲', color: 'text-green-400', bgColor: 'bg-green-400/30' },
  worried: { label: 'Worried', emoji: '😰', color: 'text-amber-400', bgColor: 'bg-amber-400/30' },
  tired: { label: 'Tired', emoji: '😴', color: 'text-purple-400', bgColor: 'bg-purple-400/30' },
  seeking: { label: 'Seeking', emoji: '🤔', color: 'text-blue-400', bgColor: 'bg-blue-400/30' },
};

const ALL_MOOD_KEYS: MoodKey[] = ['peaceful', 'grateful', 'worried', 'tired', 'seeking'];

function mapEmotionToMoodKey(emotion: string): MoodKey {
  const e = emotion.toLowerCase();
  if (e === 'peaceful' || e === 'calm') return 'peaceful';
  if (e === 'grateful' || e === 'happy') return 'grateful';
  if (e === 'worried' || e === 'anxious' || e === 'overwhelmed') return 'worried';
  if (e === 'tired') return 'tired';
  if (e === 'seeking' || e === 'sad') return 'seeking';
  return 'peaceful';
}

function formatRelativeDay(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function computeStreak(entries: MoodEntry[]): number {
  const dates = new Set(
    entries.map(e => {
      const d = e.created_at ? new Date(e.created_at) : null;
      return d && !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
    }).filter(Boolean)
  );
  let streak = 0;
  const cursor = new Date();
  let key = cursor.toISOString().split('T')[0];
  if (!dates.has(key)) {
    cursor.setDate(cursor.getDate() - 1);
    key = cursor.toISOString().split('T')[0];
    if (!dates.has(key)) return 0;
  }
  while (dates.has(cursor.toISOString().split('T')[0])) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function computeWeeklyHeights(entries: MoodEntry[]): number[] {
  const buckets: number[][] = [[], [], [], [], [], [], []];
  const scoreMap: Record<MoodKey, number> = { grateful: 90, peaceful: 80, tired: 50, worried: 35, seeking: 55 };
  entries.forEach(e => {
    const d = e.created_at ? new Date(e.created_at) : null;
    if (!d || isNaN(d.getTime())) return;
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays > 6) return;
    const dow = d.getDay();
    buckets[dow].push(scoreMap[mapEmotionToMoodKey(e.emotion)] || 50);
  });
  return buckets.map(b => b.length > 0 ? Math.round(b.reduce((a, c) => a + c, 0) / b.length) : 0);
}

function computeTrendPercent(entries: MoodEntry[]): number {
  const scoreMap: Record<MoodKey, number> = { grateful: 90, peaceful: 80, tired: 50, worried: 35, seeking: 55 };
  const now = new Date();
  const thisWeek: number[] = [];
  const lastWeek: number[] = [];
  entries.forEach(e => {
    const d = e.created_at ? new Date(e.created_at) : null;
    if (!d || isNaN(d.getTime())) return;
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    const score = scoreMap[mapEmotionToMoodKey(e.emotion)] || 50;
    if (diff <= 6) thisWeek.push(score);
    else if (diff <= 13) lastWeek.push(score);
  });
  if (lastWeek.length === 0) return 0;
  const avgThis = thisWeek.reduce((a, c) => a + c, 0) / (thisWeek.length || 1);
  const avgLast = lastWeek.reduce((a, c) => a + c, 0) / lastWeek.length;
  return Math.round(((avgThis - avgLast) / avgLast) * 100);
}

export default function QiblaHistoryScreen({ navigate, currentLanguage }: QiblaHistoryScreenProps) {
  const t = translations[currentLanguage];
  const qiblaMetricsText = {
    dayStreak: t.explore.dayStreak,
    checkIns: t.explore.checkIns,
    reflections: currentLanguage === 'zh' ? '反思' : currentLanguage === 'ar' ? 'تأملات' : currentLanguage === 'ms' ? 'Refleksi' : 'Reflections',
  };
  const [selectedTab, setSelectedTab] = useState<'overview' | 'insights' | 'history'>('overview');
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<MyScores | null>(null);

  useEffect(() => {
    getMoodHistory(100)
      .then(data => {
        const islamic = data.filter(e => e.mode === 'islamic');
        setEntries(islamic.length > 0 ? islamic : data);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));

    fetchMyScores().then(setScores).catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const streak = computeStreak(entries);
    const checkIns = entries.length;
    const reflections = entries.filter((entry) => String(entry.note || '').trim().length > 0).length;
    return { streak, checkIns, reflections };
  }, [entries]);

  const distribution = useMemo(() => {
    const counts: Record<MoodKey, number> = { peaceful: 0, grateful: 0, worried: 0, tired: 0, seeking: 0 };
    entries.forEach(e => counts[mapEmotionToMoodKey(e.emotion)]++);
    const total = entries.length || 1;
    return ALL_MOOD_KEYS.map(key => ({ key, pct: Math.round((counts[key] / total) * 100) }));
  }, [entries]);

  const weeklyHeights = useMemo(() => computeWeeklyHeights(entries), [entries]);
  const trendPercent = useMemo(() => computeTrendPercent(entries), [entries]);

  const checkins = useMemo(() => {
    return entries.slice(0, 10).map(e => ({
      day: formatRelativeDay(e.created_at),
      time: formatTime(e.created_at),
      mood: mapEmotionToMoodKey(e.emotion),
      note: e.note,
    }));
  }, [entries]);

  const insights = useMemo(() => {
    const scoreMap: Record<MoodKey, number> = { grateful: 90, peaceful: 80, tired: 50, worried: 35, seeking: 55 };
    const result: { icon: React.ReactNode; title: string; description: string; gradient: string; iconBg: string; tag: string }[] = [];

    if (trendPercent > 0) {
      result.push({
        icon: <TrendingUp className="w-5 h-5" />,
        title: 'Spiritual Progress',
        description: `Your peaceful moments increased by ${Math.abs(trendPercent)}% this week, MashaAllah`,
        gradient: 'from-emerald-500/20 to-green-500/20', iconBg: 'from-emerald-400/30 to-green-400/30', tag: 'MashaAllah',
      });
    } else if (trendPercent < 0) {
      result.push({
        icon: <Activity className="w-5 h-5" />,
        title: 'Seek Inner Peace',
        description: `Mood scores dipped ${Math.abs(trendPercent)}% — try extra dhikr and du'a this week`,
        gradient: 'from-red-500/20 to-rose-500/20', iconBg: 'from-red-400/30 to-rose-400/30', tag: 'Reminder',
      });
    }

    // Time-of-day pattern
    const hourBuckets: Record<string, number[]> = { morning: [], afternoon: [], evening: [], night: [] };
    entries.forEach(e => {
      const d = e.created_at ? new Date(e.created_at) : null;
      if (!d || isNaN(d.getTime())) return;
      const h = d.getHours();
      const score = scoreMap[mapEmotionToMoodKey(e.emotion)] || 50;
      if (h >= 5 && h < 12) hourBuckets.morning.push(score);
      else if (h >= 12 && h < 17) hourBuckets.afternoon.push(score);
      else if (h >= 17 && h < 21) hourBuckets.evening.push(score);
      else hourBuckets.night.push(score);
    });
    const avgByPeriod = Object.entries(hourBuckets)
      .filter(([, scores]) => scores.length > 0)
      .map(([period, scores]) => ({ period, avg: scores.reduce((a, c) => a + c, 0) / scores.length }))
      .sort((a, b) => b.avg - a.avg);

    if (avgByPeriod.length > 0) {
      const best = avgByPeriod[0];
      const periodLabel = best.period === 'evening' ? 'after Maghrib' : best.period === 'night' ? 'after Isha' : best.period === 'morning' ? 'after Fajr' : 'in the afternoon';
      result.push({
        icon: <Moon className="w-5 h-5" />,
        title: 'Best Reflection Time',
        description: `Check-ins ${periodLabel} show highest peace levels (avg ${Math.round(best.avg)}%)`,
        gradient: 'from-indigo-500/20 to-purple-500/20', iconBg: 'from-indigo-400/30 to-purple-400/30', tag: 'Pattern',
      });
    }

    // Most common mood
    const sorted = [...distribution].sort((a, b) => b.pct - a.pct);
    if (sorted[0] && sorted[0].pct > 0) {
      result.push({
        icon: <Heart className="w-5 h-5" />,
        title: `Mostly ${moodMeta[sorted[0].key].label}`,
        description: `${sorted[0].pct}% of your spiritual check-ins are "${moodMeta[sorted[0].key].label}" — Alhamdulillah`,
        gradient: 'from-pink-500/20 to-rose-500/20', iconBg: 'from-pink-400/30 to-rose-400/30', tag: 'Insight',
      });
    }

    if (stats.streak >= 3) {
      result.push({
        icon: <Flame className="w-5 h-5" />,
        title: `${stats.streak}-Day Streak!`,
        description: `You've maintained a ${stats.streak}-day check-in streak — keep up the dedication, SubhanAllah!`,
        gradient: 'from-amber-500/20 to-orange-500/20', iconBg: 'from-amber-400/30 to-orange-400/30', tag: 'Achievement',
      });
    }

    if (entries.length === 0) {
      result.push({
        icon: <Sparkles className="w-5 h-5" />,
        title: 'Begin Your Journey',
        description: 'Check in with your spiritual state daily to see personalized insights here, InShaAllah',
        gradient: 'from-emerald-500/20 to-teal-500/20', iconBg: 'from-emerald-400/30 to-teal-400/30', tag: 'Start',
      });
    }

    return result;
  }, [entries, distribution, trendPercent, stats.streak]);

  return (
    <PhoneFrame>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950 via-slate-950 to-emerald-900" />
      
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" />

      {/* Content */}
      <div className="relative w-full h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-14 pb-4">
          <button 
            className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all hover:bg-white/15 active:scale-95" 
            onClick={() => navigate('islamic-home')}
          >
            <ArrowLeft className="w-5 h-5 text-white/80" />
          </button>
          
          <div className="flex-1">
            <h1 className="text-white text-xl font-medium flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 12.5c-1.2.7-2.6 1.1-4.1 1.1-4.4 0-8-3.6-8-8 0-1.5.4-2.9 1.1-4.1A9 9 0 1 0 21 12.5Z"
                  stroke="#F5D36C"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 18.2s-2.5-1.5-3.6-2.9c-1.1-1.4-.7-3.2.6-4.1 1-.7 2.3-.5 3 .4.7-.9 2-.9 3-.2 1.2.8 1.5 2.6.4 4-1.1 1.5-3.4 2.8-3.4 2.8Z"
                  fill="#F5D36C"
                  opacity="0.9"
                />
              </svg>
              {t.settings.qiblaDirection}
            </h1>
            <p className="text-emerald-100/70 text-xs">{t.islamicHome.contentDesc}</p>
          </div>

          <button className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-100/70" />
            <span className="text-emerald-100/70 text-xs">{t.explore.week}</span>
            <ChevronRight className="w-3 h-3 text-emerald-100/50" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 mb-4">
          <div className="rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 p-1 flex gap-1">
            <TabButton 
              label={t.explore.overview} 
              active={selectedTab === 'overview'} 
              onClick={() => setSelectedTab('overview')}
            />
            <TabButton 
              label={t.explore.insights} 
              active={selectedTab === 'insights'} 
              onClick={() => setSelectedTab('insights')}
            />
            <TabButton 
              label={t.explore.history} 
              active={selectedTab === 'history'} 
              onClick={() => setSelectedTab('history')}
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-28">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-emerald-100/50 text-sm">{currentLanguage === 'zh' ? '加载中...' : currentLanguage === 'ar' ? 'جارٍ التحميل...' : currentLanguage === 'ms' ? 'Memuatkan...' : 'Loading...'}</div>
            </div>
          ) : (
            <>
              {selectedTab === 'overview' && (
                <OverviewTab
                  stats={stats}
                  distribution={distribution}
                  weeklyHeights={weeklyHeights}
                  trendPercent={trendPercent}
                  scores={scores}
                  labels={qiblaMetricsText}
                />
              )}
              {selectedTab === 'insights' && (
                <InsightsTab insights={insights} />
              )}
              {selectedTab === 'history' && (
                <HistoryTab checkins={checkins} />
              )}
            </>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="absolute left-0 right-0 bottom-5 px-10">
          <div className="w-full rounded-2xl bg-white/12 backdrop-blur-md border border-white/15 px-4 py-3 flex justify-between items-center">
            <button className="flex flex-col items-center gap-1" onClick={() => navigate('islamic-home')}>
              <Home className="w-5 h-5 text-white/60" />
              <span className="text-[10px] text-white/55">{t.islamicHome.home}</span>
            </button>
            <button className="flex flex-col items-center gap-1">
              <Compass className="w-5 h-5 text-white" />
              <span className="text-[10px] text-white/85">{t.islamicHome.qibla}</span>
            </button>
            <button className="flex flex-col items-center gap-1" onClick={() => navigate('ai-chat-islamic')}>
              <MessageCircle className="w-5 h-5 text-white/60" />
              <span className="text-[10px] text-white/55">{t.islamicHome.ai}</span>
            </button>
            <button className="flex flex-col items-center gap-1" onClick={() => navigate('settings-islamic')}>
              <User className="w-5 h-5 text-white/60" />
              <span className="text-[10px] text-white/55">{t.islamicHome.profile}</span>
            </button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ---------- Tab Components ---------- */

interface OverviewProps {
  stats: { streak: number; checkIns: number; reflections: number };
  distribution: { key: MoodKey; pct: number }[];
  weeklyHeights: number[];
  trendPercent: number;
  scores: MyScores | null;
  labels: { dayStreak: string; checkIns: string; reflections: string };
}

function OverviewTab({ stats, distribution, weeklyHeights, trendPercent, scores, labels }: OverviewProps) {
  const maxH = Math.max(...weeklyHeights, 1);

  return (
    <div className="space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Flame className="w-5 h-5" />}
          value={String(stats.streak)}
          label={labels.dayStreak}
          gradient="from-emerald-500/25 to-teal-500/25"
          iconColor="text-emerald-400"
        />
        <StatCard
          icon={<Target className="w-5 h-5" />}
          value={String(stats.checkIns)}
          label={labels.checkIns}
          gradient="from-amber-500/25 to-yellow-500/25"
          iconColor="text-yellow-400"
        />
        <StatCard
          icon={<Award className="w-5 h-5" />}
          value={String(stats.reflections)}
          label={labels.reflections}
          gradient="from-purple-500/25 to-pink-500/25"
          iconColor="text-purple-400"
        />
      </div>

      {/* Spiritual Growth Chart */}
      <div className="rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-sm font-medium">Spiritual Growth</h3>
          <div className={`flex items-center gap-1 text-xs ${trendPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            <TrendingUp className="w-3 h-3" />
            <span>{trendPercent >= 0 ? '+' : ''}{trendPercent}%</span>
          </div>
        </div>

        {/* Line Chart */}
        <div className="h-32 flex items-end justify-between gap-2 mb-3">
          {weeklyHeights.map((height, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex flex-col justify-end" style={{ height: '100px' }}>
                <div 
                  className="w-full bg-gradient-to-t from-emerald-500/40 to-teal-500/40 rounded-t-xl transition-all"
                  style={{ height: `${maxH > 0 ? Math.round((height / maxH) * 100) : 0}%` }}
                />
              </div>
              <span className="text-emerald-100/40 text-xs">{'SMTWTFS'[i]}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-emerald-100/70">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
            <span>Growth</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-teal-500/60" />
            <span>Peace</span>
          </div>
        </div>
      </div>

      {/* Mood Distribution */}
      <div className="rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 p-5">
        <h3 className="text-white text-sm font-medium mb-4">Emotional State</h3>

        <div className="space-y-3">
          {distribution.map((s) => (
            <div key={s.key} className="flex items-center gap-3">
              <span className="text-2xl">{moodMeta[s.key].emoji}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-emerald-100/90 text-xs">{moodMeta[s.key].label}</span>
                  <span className="text-emerald-100/70 text-xs font-medium">{s.pct}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${moodMeta[s.key].bgColor} transition-all`}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prayer Consistency */}
      {stats.streak >= 3 && (
        <div className="rounded-3xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-xl border border-blue-400/20 p-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🕌</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white text-sm font-medium mb-1">Consistency</h3>
              <p className="text-emerald-100/80 text-xs mb-2">{stats.streak}-day check-in streak! Keep it up 🌟</p>
            </div>
          </div>
        </div>
      )}

      {/* Achievement */}
      {stats.streak >= 7 && (
        <div className="rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 backdrop-blur-xl border border-amber-400/20 p-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400/30 to-amber-400/30 flex items-center justify-center flex-shrink-0">
              <Award className="w-6 h-6 text-yellow-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white text-sm font-medium mb-1">New Milestone!</h3>
              <p className="text-emerald-100/80 text-xs">{stats.streak}-day streak unlocked 🌟</p>
            </div>
          </div>
        </div>
      )}

      {stats.checkIns === 0 && (
        <div className="rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-xl border border-emerald-400/20 p-5 text-center">
          <p className="text-emerald-100/70 text-sm">No check-ins yet. Start your spiritual journey to see real data here!</p>
        </div>
      )}

      {/* AI Analytics Scores */}
      {scores && (
        <div className="space-y-3">
          <h3 className="text-emerald-100 text-sm font-medium flex items-center gap-2">
            <Brain className="w-4 h-4 text-emerald-400" />
            AI Analytics
          </h3>

          {/* Sleep Improvement Index */}
          <div className="rounded-2xl bg-gradient-to-br from-teal-500/15 to-emerald-500/15 backdrop-blur-xl border border-teal-400/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-teal-400" />
                <span className="text-white/90 text-xs font-medium">Sleep Improvement Index</span>
              </div>
              <span className="text-lg font-bold text-teal-400">
                {scores.sleep_improvement_index?.sleep_improvement_index?.toFixed(0) ?? '\u2014'}
                <span className="text-xs text-white/40">/100</span>
              </span>
            </div>
            {scores.sleep_improvement_index?.sub_scores && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                <QMiniBar label="Quality" value={scores.sleep_improvement_index.sub_scores.quality_score} max={40} color="bg-teal-400" />
                <QMiniBar label="Duration" value={scores.sleep_improvement_index.sub_scores.duration_fitness} max={30} color="bg-emerald-400" />
                <QMiniBar label="Consistency" value={scores.sleep_improvement_index.sub_scores.consistency} max={30} color="bg-green-400" />
              </div>
            )}
          </div>

          {/* Emotion Stability Score */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500/15 to-green-500/15 backdrop-blur-xl border border-emerald-400/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-white/90 text-xs font-medium">Emotion Stability Score</span>
              </div>
              <span className="text-lg font-bold text-emerald-400">
                {scores.emotion_stability?.emotion_stability_score?.toFixed(0) ?? '\u2014'}
                <span className="text-xs text-white/40">/100</span>
              </span>
            </div>
            {scores.emotion_stability?.sub_scores && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <QMiniBar label="Mood Consistency" value={scores.emotion_stability.sub_scores.mood_consistency} max={30} color="bg-emerald-400" />
                <QMiniBar label="Sentiment Trend" value={scores.emotion_stability.sub_scores.sentiment_trend} max={25} color="bg-green-400" />
                <QMiniBar label="AI Stability" value={scores.emotion_stability.sub_scores.ai_stability_avg} max={25} color="bg-teal-400" />
                <QMiniBar label="Streak Bonus" value={scores.emotion_stability.sub_scores.streak_bonus} max={20} color="bg-lime-400" />
              </div>
            )}
          </div>

          {/* Sleep Prediction */}
          {scores.sleep_prediction?.predicted_quality != null && (
            <div className="rounded-2xl bg-gradient-to-br from-yellow-500/15 to-amber-500/15 backdrop-blur-xl border border-yellow-400/20 p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span className="text-white/90 text-xs font-medium">Tonight's Sleep Prediction</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-yellow-400">{scores.sleep_prediction.predicted_quality}</span>
                <span className="text-xs text-white/40">/10 quality</span>
                <span className="ml-auto text-xs text-white/50">
                  {(scores.sleep_prediction.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
              <div className="text-[10px] text-white/40 mt-1">
                Based on {scores.sleep_prediction.training_samples} entries \u00b7 mood: {scores.sleep_prediction.current_mood}
              </div>
            </div>
          )}

          {/* Persona */}
          {scores.persona && (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400/30 to-amber-400/30 flex items-center justify-center">
                <Star className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <div className="text-white/90 text-xs font-medium">{scores.persona.persona}</div>
                <div className="text-white/40 text-[10px]">{scores.persona.traits?.join(' \u00b7 ')}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface InsightsTabProps {
  insights: { icon: React.ReactNode; title: string; description: string; gradient: string; iconBg: string; tag: string }[];
}

function InsightsTab({ insights }: InsightsTabProps) {
  return (
    <div className="space-y-4">
      {insights.map((ins, i) => (
        <InsightCard key={i} {...ins} />
      ))}
    </div>
  );
}

function HistoryTab({ checkins }: { checkins: { day: string; time: string; mood: MoodKey; note?: string }[] }) {
  return (
    <div className="space-y-3">
      <p className="text-emerald-100/70 text-xs mb-2">Recent spiritual check-ins</p>
      {checkins.length === 0 && (
        <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-6 text-center">
          <p className="text-emerald-100/50 text-sm">No check-ins yet</p>
        </div>
      )}
      {checkins.map((checkin, i) => (
        <div 
          key={i}
          className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl flex-shrink-0">
              {moodMeta[checkin.mood].emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white text-sm font-medium">{moodMeta[checkin.mood].label}</span>
                <span className="text-emerald-100/60 text-xs">{checkin.time}</span>
              </div>
              <p className="text-emerald-100/70 text-xs mb-2">{checkin.day}</p>
              {checkin.note && (
                <div className="rounded-lg bg-white/10 p-2 mt-2">
                  <p className="text-emerald-100/80 text-xs italic">"{checkin.note}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Components ---------- */

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
        active 
          ? 'bg-white/20 text-white shadow-lg' 
          : 'text-emerald-100/70 hover:text-white/90'
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({
  icon,
  value,
  label,
  gradient,
  iconColor,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  gradient: string;
  iconColor: string;
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} backdrop-blur-xl border border-white/20 p-3`}>
      <div className={`${iconColor} mb-2`}>{icon}</div>
      <p className="text-white text-xl font-bold">{value}</p>
      <p className="text-emerald-100/80 text-xs mt-0.5">{label}</p>
    </div>
  );
}

function InsightCard({
  icon,
  title,
  description,
  gradient,
  iconBg,
  tag,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  iconBg: string;
  tag?: string;
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} backdrop-blur-xl border border-white/20 p-4`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center text-white flex-shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-white text-sm font-medium">{title}</h4>
            {tag && (
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white/90 text-xs">
                {tag}
              </span>
            )}
          </div>
          <p className="text-emerald-100/80 text-xs leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}

function QMiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-[10px] text-white/50 mb-1">
        <span>{label}</span>
        <span>{value?.toFixed(0)}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}