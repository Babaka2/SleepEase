import { useState, useEffect } from 'react';
import {
  ChevronRight,
  Moon,
  User,
  Sun,
  Globe,
  Shield,
  FileText,
  Home,
  Compass,
  MessageCircle,
  Bell,
  Palette,
  Volume2,
  HelpCircle,
  Mail,
  Star,
  Award,
  Heart,
  LogOut,
  BookOpen,
  Smartphone,
  Calendar
} from 'lucide-react';
import PhoneFrame from './PhoneFrame';

type Mode = 'General Mode' | 'Islamic Mode';

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
  | 'settings-islamic'
  | 'language-selection';

interface SettingsModeSwitchingIslamicProps {
  navigate: (screen: Screen, mode?: 'general' | 'islamic' | null) => void;
  currentMode: 'general' | 'islamic';
  userInfo: { name: string; email: string };
  onLogout: () => void;
  currentLanguage: Language;
}

import { Language, translations } from '../translations';
import { updateUserMode } from '../../services/auth';

export default function SettingsModeSwitchingIslamic({ navigate, currentMode, userInfo, onLogout, currentLanguage }: SettingsModeSwitchingIslamicProps) {
  const t = translations[currentLanguage].settings;

  type CompassEvent = DeviceOrientationEvent & {
    webkitCompassHeading?: number;
  };

  type DeviceOrientationWithPermission = {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };

  const handleModeSwitch = async () => {
    const newMode = currentMode === 'general' ? 'islamic' : 'general';
    try {
      await updateUserMode(newMode);
    } catch (e) {
      console.error('Mode update failed:', e);
    }
    navigate(newMode === 'general' ? 'general-home' : 'islamic-home', newMode);
  };

  // --- Panel state ---
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<Record<string, string> | null>(null);
  const [qiblaBearing, setQiblaBearing] = useState<number | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [qiblaStatus, setQiblaStatus] = useState('Finding your Qibla direction...');
  const [compassReady, setCompassReady] = useState(false);
  const [needsCompassPermission, setNeedsCompassPermission] = useState(false);
  const [hijriDate, setHijriDate] = useState('');
  const [quranProgress, setQuranProgress] = useState(() => {
    try { const s = localStorage.getItem('sleepease_quran'); return s ? JSON.parse(s) : { surah: 'Al-Baqarah', ayah: 45 }; }
    catch { return { surah: 'Al-Baqarah', ayah: 45 }; }
  });
  const [notifEnabled, setNotifEnabled] = useState(() => localStorage.getItem('sleepease_notif') !== 'false');
  const [selectedTheme, setSelectedTheme] = useState(() => localStorage.getItem('sleepease_theme') || 'islamic-dark');
  const [selectedSound, setSelectedSound] = useState(() => localStorage.getItem('sleepease_sound') || 'makkah');
  const [savedDuas, setSavedDuas] = useState<string[]>(() => {
    try { const s = localStorage.getItem('sleepease_duas'); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Calculate Hijri date on mount
  useEffect(() => {
    try {
      const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
      setHijriDate(fmt.format(new Date()));
    } catch { setHijriDate(''); }
  }, []);

  // Fetch prayer times when panel opens
  useEffect(() => {
    if (activePanel !== 'prayer-times' || prayerTimes) return;
    (async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
        const d = new Date();
        const r = await fetch(
          `https://api.aladhan.com/v1/timings/${d.getDate()}-${d.getMonth()+1}-${d.getFullYear()}?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&method=2`);
        const j = await r.json();
        if (j.data?.timings) setPrayerTimes(j.data.timings);
        else throw new Error('no timings');
      } catch {
        setPrayerTimes({ Fajr: '5:42', Sunrise: '6:58', Dhuhr: '12:30', Asr: '15:45', Maghrib: '18:15', Isha: '19:30' });
      }
    })();
  }, [activePanel, prayerTimes]);

  const startCompassTracking = async () => {
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
      setQiblaStatus('Compass not supported on this device/browser');
      return;
    }

    const OrientationCtor = DeviceOrientationEvent as unknown as DeviceOrientationWithPermission;
    if (typeof OrientationCtor.requestPermission === 'function') {
      try {
        const permission = await OrientationCtor.requestPermission();
        if (permission !== 'granted') {
          setQiblaStatus('Compass permission denied');
          return;
        }
      } catch {
        setQiblaStatus('Compass permission was not granted');
        return;
      }
    }

    setNeedsCompassPermission(false);

    const handleOrientation = (event: CompassEvent) => {
      let heading: number | null = null;
      if (typeof event.webkitCompassHeading === 'number') {
        heading = event.webkitCompassHeading;
      } else if (typeof event.alpha === 'number') {
        heading = (360 - event.alpha + 360) % 360;
      }

      if (heading === null) return;
      setDeviceHeading(Math.round(heading));
      setCompassReady(true);
      setQiblaStatus('Rotate your phone to align with the yellow pointer');
    };

    window.addEventListener('deviceorientation', handleOrientation as EventListener, true);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation as EventListener, true);
    };
  };

  // Calculate Qibla when panel opens
  useEffect(() => {
    if (activePanel !== 'qibla') return;

    let cleanupCompass: (() => void) | undefined;

    (async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
        const toR = (d: number) => d * Math.PI / 180;
        const toD = (r: number) => r * 180 / Math.PI;
        const dL = toR(39.8262 - pos.coords.longitude);
        const y = Math.sin(dL) * Math.cos(toR(21.4225));
        const x = Math.cos(toR(pos.coords.latitude)) * Math.sin(toR(21.4225))
                - Math.sin(toR(pos.coords.latitude)) * Math.cos(toR(21.4225)) * Math.cos(dL);
        setQiblaBearing(Math.round((toD(Math.atan2(y, x)) + 360) % 360));
      } catch {
        setQiblaBearing(45);
        setQiblaStatus('Using default direction. Please allow location for accurate Qibla.');
      }

      if (typeof window !== 'undefined' && typeof DeviceOrientationEvent !== 'undefined') {
        const OrientationCtor = DeviceOrientationEvent as unknown as DeviceOrientationWithPermission;
        if (typeof OrientationCtor.requestPermission === 'function') {
          setNeedsCompassPermission(true);
          setQiblaStatus('Tap enable compass to start live direction');
        } else {
          cleanupCompass = await startCompassTracking();
        }
      } else {
        setQiblaStatus('Compass not supported on this device/browser');
      }
    })();

    return () => {
      if (cleanupCompass) cleanupCompass();
    };
  }, [activePanel]);

  // Dynamic labels
  const nextPrayerLabel = prayerTimes ? `Next: Fajr ${prayerTimes.Fajr}` : t.prayerTimesDesc;
  const qiblaLabel = qiblaBearing !== null ? `${qiblaBearing}° from North` : t.qiblaDesc;
  const hijriLabel = hijriDate || t.hijriDesc;
    const qiblaPointer = qiblaBearing === null
      ? 0
      : Math.round((qiblaBearing - (deviceHeading ?? 0) + 360) % 360);
    const qiblaDelta = qiblaBearing === null || deviceHeading === null
      ? null
      : Math.min(qiblaPointer, 360 - qiblaPointer);
    const isAligned = qiblaDelta !== null && qiblaDelta <= 10;

  const quranLabel = `${quranProgress.surah}, Ayah ${quranProgress.ayah}`;
  const notifLabel = notifEnabled ? t.prayerReminders : 'Off';
  const themeLabel = selectedTheme === 'islamic-dark' ? 'Islamic Dark' : selectedTheme === 'dark' ? 'Dark' : 'Light';
  const soundLabel = selectedSound === 'makkah' ? 'Makkah Adhan' : selectedSound === 'madinah' ? 'Madinah Adhan' : 'Default';
  const duasCount = savedDuas.length;

  // Constants
  const PRAYER_NAMES = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const SURAHS = ['Al-Fatihah','Al-Baqarah','Ali Imran','An-Nisa','Al-Maidah','Al-Anam','Al-Araf','Al-Anfal','At-Tawbah','Yunus','Hud','Yusuf','Ar-Rad','Ibrahim','Al-Hijr','An-Nahl','Al-Isra','Al-Kahf','Maryam','Ta-Ha','Ya-Sin','Ar-Rahman','Al-Waqiah','Al-Mulk','Al-Qalam','Al-Jinn','Al-Muzzammil','Al-Ikhlas','Al-Falaq','An-Nas'];
  const THEMES = [{ id: 'islamic-dark', label: 'Islamic Dark' }, { id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }];
  const SOUNDS = [{ id: 'makkah', label: 'Makkah Adhan' }, { id: 'madinah', label: 'Madinah Adhan' }, { id: 'default', label: 'Default' }];
  const MILESTONES = [
    { name: 'First Check-in', icon: '✅', earned: true },
    { name: '7-Day Streak', icon: '🔥', earned: true },
    { name: 'Night Owl', icon: '🦉', earned: true },
    { name: 'Calm Master', icon: '🧘', earned: true },
    { name: "Du'a Reader", icon: '📖', earned: true },
    { name: 'Early Bird', icon: '🌅', earned: true },
    { name: 'Qibla Finder', icon: '🧭', earned: true },
    { name: 'Moon Gazer', icon: '🌙', earned: false },
    { name: '30-Day Streak', icon: '💎', earned: false },
    { name: 'Quran Completer', icon: '📚', earned: false },
  ];
  const COMMON_DUAS = [
    { id: 'sleep', title: "Du'a Before Sleep", arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا', translation: 'In Your name, O Allah, I die and I live.' },
    { id: 'wakeup', title: "Du'a Upon Waking", arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ', translation: 'All praise is for Allah who gave us life after having taken it from us.' },
    { id: 'anxiety', title: "Du'a for Anxiety", arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ', translation: 'O Allah, I seek refuge in You from worry and grief.' },
    { id: 'peace', title: "Du'a for Peace", arabic: 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ', translation: 'O Allah, You are Peace, and from You comes peace.' },
    { id: 'guidance', title: "Du'a for Guidance", arabic: 'اللَّهُمَّ اهْدِنِي وَسَدِّدْنِي', translation: 'O Allah, guide me and keep me on the right path.' },
    { id: 'gratitude', title: "Du'a of Gratitude", arabic: 'رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ', translation: 'My Lord, enable me to be grateful for Your favor.' },
  ];
  const FAQ_ITEMS = [
    { q: 'How does mood tracking work?', a: 'Check in daily with your mood and emotions. The app tracks patterns over time to help you understand your emotional well-being.' },
    { q: 'How are prayer times calculated?', a: 'Prayer times are calculated based on your location using the Islamic Society of North America (ISNA) method.' },
    { q: 'Is my data private?', a: 'Yes, all your data is encrypted and stored securely. We never share your personal information with third parties.' },
    { q: 'How does the AI assistant work?', a: 'The AI assistant uses advanced language models to provide Islamic guidance and emotional support based on Quran and Sunnah.' },
    { q: 'Can I switch between modes?', a: 'Yes, you can switch between General and Islamic modes at any time from the Settings page.' },
  ];

  const toggleDua = (id: string) => {
    const next = savedDuas.includes(id) ? savedDuas.filter(d => d !== id) : [...savedDuas, id];
    setSavedDuas(next);
    localStorage.setItem('sleepease_duas', JSON.stringify(next));
  };
  const updateQuran = (patch: Partial<typeof quranProgress>) => {
    const p = { ...quranProgress, ...patch };
    setQuranProgress(p);
    localStorage.setItem('sleepease_quran', JSON.stringify(p));
  };

  const getPanelTitle = () => {
    const titles: Record<string, string> = {
      'prayer-times': t.prayerTimes, qibla: t.qiblaDirection, hijri: t.hijriCalendar, quran: t.quranProgress,
      notifications: t.notifications, theme: t.theme, sound: t.sound, account: t.manageAccount,
      milestones: t.spiritualMilestones, duas: t.savedDuas, help: t.helpCenter, contact: t.contactSupport,
      privacy: t.privacyPolicy, terms: t.termsOfService,
    };
    return titles[activePanel || ''] || '';
  };

  const renderPanelContent = () => {
    switch (activePanel) {
      case 'prayer-times':
        return (
          <div className="space-y-3">
            {PRAYER_NAMES.map(n => (
              <div key={n} className="flex items-center justify-between p-4 rounded-2xl bg-white/10 border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    {n === 'Sunrise' ? '🌅' : n === 'Maghrib' ? '🌇' : '🕌'}
                  </div>
                  <span className="text-white font-medium">{n}</span>
                </div>
                <span className="text-emerald-200 text-lg font-mono">{prayerTimes?.[n] || '--:--'}</span>
              </div>
            ))}
          </div>
        );
      case 'qibla':
        return (
          <div className="flex flex-col items-center gap-6 pt-4">
            <div className="relative w-48 h-48">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-400/30" />
              <div className="absolute inset-2 rounded-full border border-white/10" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 text-emerald-300 text-xs font-bold">N</div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 text-white/40 text-xs">S</div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 text-white/40 text-xs">E</div>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 text-white/40 text-xs">W</div>
              <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `rotate(${qiblaPointer}deg)` }}>
                <div className="w-1 h-20 bg-gradient-to-t from-transparent via-emerald-400 to-yellow-400 rounded-full -translate-y-2" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-emerald-500/30 border-2 border-emerald-400 flex items-center justify-center text-sm">🕋</div>
              </div>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-300">{qiblaBearing ?? '...'}°</p>
              <p className="text-white/60 text-sm mt-1">from North</p>
              <p className="text-emerald-100/50 text-xs mt-2">Direction to Makkah (Kaaba)</p>
              <p className={`text-xs mt-2 ${isAligned ? 'text-emerald-300' : 'text-emerald-100/70'}`}>
                {isAligned ? 'Aligned. You are facing Qibla.' : qiblaDelta !== null ? `${qiblaDelta}° away from Qibla` : qiblaStatus}
              </p>
              {deviceHeading !== null && (
                <p className="text-white/40 text-xs mt-1">Your heading: {deviceHeading}°</p>
              )}
            </div>
            {needsCompassPermission && (
              <button
                onClick={() => { void startCompassTracking(); }}
                className="px-4 py-2 rounded-xl bg-emerald-500/25 border border-emerald-400/30 text-emerald-100 text-sm"
              >
                Enable Compass
              </button>
            )}
            {!compassReady && !needsCompassPermission && (
              <p className="text-white/45 text-xs text-center px-4">Live compass is unavailable. You can still use the degree value above.</p>
            )}
          </div>
        );
      case 'hijri':
        return (
          <div className="space-y-4">
            <div className="text-center p-6 rounded-2xl bg-white/10 border border-white/10">
              <p className="text-emerald-300 text-sm mb-2">Hijri Date</p>
              <p className="text-white text-2xl font-bold">{hijriDate || 'Loading...'}</p>
              <p className="text-white/50 text-sm mt-3">Gregorian: {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 border border-white/10">
              <p className="text-emerald-300 text-sm mb-2">Islamic Months</p>
              <div className="grid grid-cols-3 gap-2">
                {['Muharram','Safar','Rabi I','Rabi II','Jumada I','Jumada II','Rajab','Shaban','Ramadan','Shawwal','Dhul Qidah','Dhul Hijjah'].map(m => (
                  <div key={m} className={`text-center py-2 rounded-lg text-xs ${hijriDate.includes(m) ? 'bg-emerald-500/30 text-emerald-200 font-bold' : 'bg-white/5 text-white/50'}`}>{m}</div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'quran':
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white/10 border border-white/10">
              <p className="text-emerald-300 text-sm mb-3">Current Surah</p>
              <select value={quranProgress.surah} onChange={e => updateQuran({ surah: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded-xl text-white p-3 text-sm">
                {SURAHS.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
              </select>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 border border-white/10">
              <p className="text-emerald-300 text-sm mb-3">Current Ayah</p>
              <div className="flex items-center gap-4">
                <button onClick={() => updateQuran({ ayah: Math.max(1, quranProgress.ayah - 1) })}
                  className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 text-lg">−</button>
                <span className="text-white text-2xl font-bold flex-1 text-center">{quranProgress.ayah}</span>
                <button onClick={() => updateQuran({ ayah: quranProgress.ayah + 1 })}
                  className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 text-lg">+</button>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 text-center">
              <p className="text-emerald-200 text-sm">📖 Keep reading! You are making great progress.</p>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-3">
            {[{ key: 'prayer', label: 'Prayer Reminders', desc: 'Get notified for each prayer time' },
              { key: 'bedtime', label: 'Bedtime Reminder', desc: 'Reminder to prepare for sleep' },
              { key: 'mood', label: 'Mood Check-in', desc: 'Daily mood tracking reminder' },
              { key: 'quran', label: 'Quran Reading', desc: 'Daily Quran reading reminder' },
              { key: 'dua', label: "Daily Du'a", desc: 'Morning and evening reminder' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-4 rounded-2xl bg-white/10 border border-white/10">
                <div>
                  <p className="text-white text-sm font-medium">{item.label}</p>
                  <p className="text-white/50 text-xs mt-0.5">{item.desc}</p>
                </div>
                <button onClick={() => { setNotifEnabled(!notifEnabled); localStorage.setItem('sleepease_notif', String(!notifEnabled)); }}
                  className={`w-12 h-7 rounded-full transition-colors relative ${notifEnabled ? 'bg-emerald-500' : 'bg-white/20'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-transform ${notifEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
        );
      case 'theme':
        return (
          <div className="space-y-3">
            {THEMES.map(th => (
              <button key={th.id} onClick={() => { setSelectedTheme(th.id); localStorage.setItem('sleepease_theme', th.id); }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedTheme === th.id ? 'bg-emerald-500/20 border-emerald-400/40' : 'bg-white/10 border-white/10'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl border border-white/20 ${th.id === 'islamic-dark' ? 'bg-emerald-900' : th.id === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  <span className="text-white font-medium">{th.label}</span>
                </div>
                {selectedTheme === th.id && <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">✓</div>}
              </button>
            ))}
          </div>
        );
      case 'sound':
        return (
          <div className="space-y-3">
            {SOUNDS.map(s => (
              <button key={s.id} onClick={() => { setSelectedSound(s.id); localStorage.setItem('sleepease_sound', s.id); }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedSound === s.id ? 'bg-emerald-500/20 border-emerald-400/40' : 'bg-white/10 border-white/10'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-lg">🔊</div>
                  <span className="text-white font-medium">{s.label}</span>
                </div>
                {selectedSound === s.id && <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">✓</div>}
              </button>
            ))}
          </div>
        );
      case 'account':
        return (
          <div className="space-y-4">
            {[{ label: 'Name', value: userInfo.name || 'Guest' }, { label: 'Email', value: userInfo.email || 'No email' },
              { label: 'Mode', value: currentMode === 'islamic' ? 'Islamic Mode' : 'General Mode' }, { label: 'App Version', value: '1.0.0' }].map(f => (
              <div key={f.label} className="p-4 rounded-2xl bg-white/10 border border-white/10">
                <p className="text-emerald-300 text-xs mb-1">{f.label}</p>
                <p className="text-white font-medium">{f.value}</p>
              </div>
            ))}
          </div>
        );
      case 'milestones':
        return (
          <div className="space-y-3">
            {MILESTONES.map(m => (
              <div key={m.name} className={`flex items-center gap-3 p-4 rounded-2xl border ${m.earned ? 'bg-white/10 border-white/10' : 'bg-white/5 border-white/5 opacity-50'}`}>
                <span className="text-2xl">{m.icon}</span>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{m.name}</p>
                  <p className="text-white/50 text-xs">{m.earned ? 'Earned' : 'Locked'}</p>
                </div>
                {m.earned && <span className="text-emerald-400 text-sm">✓</span>}
              </div>
            ))}
          </div>
        );
      case 'duas':
        return (
          <div className="space-y-3">
            {COMMON_DUAS.map(dua => (
              <div key={dua.id} className="p-4 rounded-2xl bg-white/10 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white text-sm font-medium">{dua.title}</p>
                  <button onClick={() => toggleDua(dua.id)} className="text-lg">
                    {savedDuas.includes(dua.id) ? '❤️' : '🤍'}
                  </button>
                </div>
                <p className="text-emerald-200 text-right text-lg leading-loose mb-2" dir="rtl">{dua.arabic}</p>
                <p className="text-white/60 text-xs italic">{dua.translation}</p>
              </div>
            ))}
          </div>
        );
      case 'help':
        return (
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <button key={i} onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                className="w-full text-left p-4 rounded-2xl bg-white/10 border border-white/10">
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm font-medium pr-4">{item.q}</p>
                  <ChevronRight className={`w-4 h-4 text-white/40 transition-transform flex-shrink-0 ${expandedFaq === i ? 'rotate-90' : ''}`} />
                </div>
                {expandedFaq === i && <p className="text-white/60 text-xs mt-3 leading-relaxed">{item.a}</p>}
              </button>
            ))}
          </div>
        );
      case 'contact':
        return (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-white/10 border border-white/10 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-emerald-300" />
              </div>
              <h3 className="text-white font-medium mb-2">Get in Touch</h3>
              <p className="text-white/60 text-sm mb-4">Send us a message and we'll respond as soon as possible.</p>
              <a href="mailto:support@sleepease.app" className="inline-block px-6 py-3 rounded-xl bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 text-sm font-medium">
                support@sleepease.app
              </a>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 border border-white/10">
              <p className="text-white/60 text-xs text-center">Response time: Usually within 24 hours</p>
            </div>
          </div>
        );
      case 'privacy':
        return (
          <div className="space-y-4">
            {[{ t: 'Data Collection', d: 'SleepEase collects minimal data necessary for personalized recommendations including mood entries, sleep patterns, and app usage.' },
              { t: 'Data Security', d: 'All personal data is encrypted using AES-256 encryption and stored securely on Firebase servers with strict access controls.' },
              { t: 'Data Sharing', d: 'We never sell or share your personal data with third parties. Anonymized analytics may be used to improve performance.' },
              { t: 'Your Rights', d: 'You can request access, modification, or deletion of your data at any time via support@sleepease.app.' }].map(s => (
              <div key={s.t} className="p-4 rounded-2xl bg-white/10 border border-white/10">
                <h3 className="text-emerald-300 text-sm font-medium mb-2">{s.t}</h3>
                <p className="text-white/60 text-xs leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        );
      case 'terms':
        return (
          <div className="space-y-4">
            {[{ t: 'Terms of Use', d: 'By using SleepEase, you agree to these terms. The app is intended for wellness and relaxation purposes only.' },
              { t: 'Not Medical Advice', d: 'SleepEase is not a substitute for professional medical advice, diagnosis, or treatment. Always seek qualified health providers.' },
              { t: 'AI Disclaimer', d: 'AI-generated responses are for general guidance only and should not be relied upon for religious rulings (fatwa). Consult qualified scholars.' },
              { t: 'Updates', d: 'We may update these terms from time to time. Continued use constitutes acceptance of updated terms.' }].map(s => (
              <div key={s.t} className="p-4 rounded-2xl bg-white/10 border border-white/10">
                <h3 className="text-emerald-300 text-sm font-medium mb-2">{s.t}</h3>
                <p className="text-white/60 text-xs leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        );
      default: return null;
    }
  };

  return (
    <PhoneFrame>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950 via-slate-950 to-emerald-900" />

      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-40 left-10 w-40 h-40 bg-yellow-400/10 rounded-full blur-3xl" />
      </div>

      {/* Scrollable Content */}
      <div className="relative w-full h-full px-6 pt-14 pb-28 overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-white text-2xl font-light mb-1 flex items-center gap-2">
            <Moon className="w-6 h-6 text-yellow-300" />
            {t.title}
          </h1>
          <p className="text-emerald-100/70 text-sm">{t.subtitle}</p>
        </div>

        {/* Profile Card */}
        <div className="mb-6 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-xl border border-emerald-400/20 p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400/40 to-teal-400/40 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
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
            </div>
            <div className="flex-1">
              <h3 className="text-white text-lg font-medium">{userInfo.name || translations[currentLanguage].islamicHome.guest}</h3>
              <p className="text-emerald-100/80 text-sm">{userInfo.email || 'No email'}</p>
              <div className="flex items-center gap-2 mt-1">
                <Star className="w-3 h-3 text-yellow-400" />
                <span className="text-emerald-100/70 text-xs">{t.blessedMember}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40" />
          </div>
        </div>

        {/* ISLAMIC SETTINGS */}
        <SectionLabel text={t.islamicSettingsTitle} />
        <div className="space-y-2 mb-6">
          {/* Prayer Times */}
          <SettingRow
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 9v11a2 2 0 002 2h14a2 2 0 002-2V9l-9-7z" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="2" />
            </svg>}
            label={t.prayerTimes}
            subtitle={nextPrayerLabel}
            iconBg="from-emerald-500/30 to-teal-500/30"
            onClick={() => setActivePanel('prayer-times')}
          />

          {/* Qibla Direction */}
          <SettingRow
            icon={<Compass className="w-5 h-5" />}
            label={t.qiblaDirection}
            subtitle={qiblaLabel}
            iconBg="from-blue-500/30 to-cyan-500/30"
            onClick={() => setActivePanel('qibla')}
          />

          {/* Hijri Calendar */}
          <SettingRow
            icon={<Calendar className="w-5 h-5" />}
            label={t.hijriCalendar}
            subtitle={hijriLabel}
            iconBg="from-purple-500/30 to-indigo-500/30"
            onClick={() => setActivePanel('hijri')}
          />

          {/* Quran Reading */}
          <SettingRow
            icon={<BookOpen className="w-5 h-5" />}
            label={t.quranProgress}
            subtitle={quranLabel}
            iconBg="from-amber-500/30 to-yellow-500/30"
            onClick={() => setActivePanel('quran')}
          />
        </div>

        {/* PREFERENCES */}
        <SectionLabel text={t.preferences} />
        <div className="space-y-2 mb-6">
          {/* App Mode */}
          <SettingRow
            icon={<Sun className="w-5 h-5" />}
            label={t.appMode}
            subtitle={currentMode === 'general' ? t.generalMode : t.islamicMode}
            iconBg="from-orange-500/30 to-amber-500/30"
            onClick={handleModeSwitch}
          />

          {/* Notifications */}
          <SettingRow
            icon={<Bell className="w-5 h-5" />}
            label={t.notifications}
            subtitle={notifLabel}
            iconBg="from-emerald-500/30 to-green-500/30"
            badge={notifEnabled ? 'On' : 'Off'}
            onClick={() => setActivePanel('notifications')}
          />

          {/* Theme */}
          <SettingRow
            icon={<Palette className="w-5 h-5" />}
            label={t.theme}
            subtitle={themeLabel}
            iconBg="from-teal-500/30 to-cyan-500/30"
            onClick={() => setActivePanel('theme')}
          />

          {/* Sound */}
          <SettingRow
            icon={<Volume2 className="w-5 h-5" />}
            label={t.sound}
            subtitle={soundLabel}
            iconBg="from-blue-500/30 to-indigo-500/30"
            onClick={() => setActivePanel('sound')}
          />

          {/* Language */}
          <SettingRow
            icon={<Globe className="w-5 h-5" />}
            label={t.language}
            subtitle={currentLanguage === 'en' ? 'English' : currentLanguage === 'zh' ? '中文' : currentLanguage === 'ar' ? 'العربية' : 'Bahasa Melayu'}
            iconBg="from-purple-500/30 to-pink-500/30"
            onClick={() => navigate('language-selection')}
          />
        </div>

        {/* ACCOUNT */}
        <SectionLabel text={t.account} />
        <div className="space-y-2 mb-6">
          <SettingRow
            icon={<User className="w-5 h-5" />}
            label={t.manageAccount}
            subtitle={t.personalInfo}
            iconBg="from-slate-500/30 to-gray-500/30"
            onClick={() => setActivePanel('account')}
          />

          <SettingRow
            icon={<Award className="w-5 h-5" />}
            label={t.spiritualMilestones}
            subtitle={`${MILESTONES.filter(m => m.earned).length} badges earned`}
            iconBg="from-yellow-500/30 to-amber-500/30"
            onClick={() => setActivePanel('milestones')}
          />

          <SettingRow
            icon={<Heart className="w-5 h-5" />}
            label={t.savedDuas}
            subtitle={`${duasCount} saved`}
            iconBg="from-red-500/30 to-rose-500/30"
            onClick={() => setActivePanel('duas')}
          />
        </div>

        {/* SUPPORT */}
        <SectionLabel text={t.support} />
        <div className="space-y-2 mb-6">
          <SettingRow
            icon={<HelpCircle className="w-5 h-5" />}
            label={t.helpCenter}
            subtitle={t.helpCenterDesc}
            iconBg="from-cyan-500/30 to-teal-500/30"
            onClick={() => setActivePanel('help')}
          />

          <SettingRow
            icon={<Mail className="w-5 h-5" />}
            label={t.contactSupport}
            subtitle={t.contactDesc}
            iconBg="from-blue-500/30 to-indigo-500/30"
            onClick={() => setActivePanel('contact')}
          />
        </div>

        {/* LEGAL */}
        <SectionLabel text={t.legal} />
        <div className="space-y-2 mb-6">
          <SettingRow
            icon={<Shield className="w-5 h-5" />}
            label={t.privacyPolicy}
            subtitle={t.yourDataSafe}
            iconBg="from-green-500/30 to-emerald-500/30"
            onClick={() => setActivePanel('privacy')}
          />

          <SettingRow
            icon={<FileText className="w-5 h-5" />}
            label={t.termsOfService}
            subtitle={t.usageAgreement}
            iconBg="from-slate-500/30 to-gray-500/30"
            onClick={() => setActivePanel('terms')}
          />
        </div>

        {/* ABOUT */}
        <SectionLabel text={t.about} />
        <div className="space-y-2 mb-6">
          <SettingRow
            icon={<Smartphone className="w-5 h-5" />}
            label={t.appVersion}
            subtitle={t.appVersionDesc}
            iconBg="from-purple-500/30 to-indigo-500/30"
            hideArrow
          />
        </div>

        {/* Log Out Button */}
        <button className="w-full mb-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-rose-500/20 backdrop-blur-xl border border-red-400/20 px-5 py-4 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95" onClick={onLogout}>
          <LogOut className="w-5 h-5 text-red-400" />
          <span className="text-white font-medium">{t.logOut}</span>
        </button>
      </div>

      {/* Panel Overlay */}
      {activePanel && (
        <div className="absolute inset-0 z-50 flex flex-col">
          <div className="h-14 bg-black/40" onClick={() => setActivePanel(null)} />
          <div className="flex-1 rounded-t-3xl bg-gradient-to-b from-emerald-950 to-slate-950 border-t border-emerald-400/20 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
              <h2 className="text-white text-lg font-medium">{getPanelTitle()}</h2>
              <button onClick={() => setActivePanel(null)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 text-sm">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {renderPanelContent()}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="absolute left-0 right-0 bottom-5 px-10">
        <div className="w-full rounded-2xl bg-white/12 backdrop-blur-md border border-white/15 px-4 py-3 flex justify-between items-center">
          <button className="flex flex-col items-center gap-1" onClick={() => navigate('islamic-home')}>
            <Home className="w-5 h-5 text-white/60" />
            <span className="text-[10px] text-white/55">{translations[currentLanguage].islamicHome.home}</span>
          </button>
          <button className="flex flex-col items-center gap-1" onClick={() => navigate('mood-history-islamic')}>
            <Compass className="w-5 h-5 text-white/60" />
            <span className="text-[10px] text-white/55">{translations[currentLanguage].islamicHome.qibla}</span>
          </button>
          <button className="flex flex-col items-center gap-1" onClick={() => navigate('ai-chat-islamic')}>
            <MessageCircle className="w-5 h-5 text-white/60" />
            <span className="text-[10px] text-white/55">{translations[currentLanguage].islamicHome.ai}</span>
          </button>
          <button className="flex flex-col items-center gap-1">
            <User className="w-5 h-5 text-white" />
            <span className="text-[10px] text-white/85">{translations[currentLanguage].islamicHome.profile}</span>
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ---------- Components ---------- */

function SectionLabel({ text }: { text: string }) {
  return <p className="text-emerald-100/50 text-xs tracking-widest mb-3 mt-2">{text}</p>;
}

function SettingRow({
  icon,
  label,
  subtitle,
  iconBg,
  badge,
  hideArrow = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  iconBg: string;
  badge?: string;
  hideArrow?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className="w-full rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-4 flex items-center gap-3 transition-all hover:bg-white/15 active:scale-95"
      onClick={onClick}
    >
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center text-white flex-shrink-0`}>
        {icon}
      </div>

      <div className="flex-1 text-left min-w-0">
        <p className="text-white text-sm font-medium">{label}</p>
        {subtitle && <p className="text-emerald-100/70 text-xs mt-0.5">{subtitle}</p>}
      </div>

      {badge && (
        <div className="px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/30">
          <span className="text-emerald-200 text-xs font-medium">{badge}</span>
        </div>
      )}

      {!hideArrow && <ChevronRight className="w-5 h-5 text-white/40 flex-shrink-0" />}
    </button>
  );
}