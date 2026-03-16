import { useState } from 'react';
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
  Settings as SettingsIcon,
  Smartphone
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

interface SettingsModeSwitchingProps {
  navigate: (screen: Screen, mode?: 'general' | 'islamic' | null) => void;
  currentMode: 'general' | 'islamic';
  userInfo: { name: string; email: string };
  onLogout: () => void;
  currentLanguage: Language;
}

import { Language, translations } from '../translations';
import { updateUserMode } from '../../services/auth';

export default function SettingsModeSwitching({ navigate, currentMode, userInfo, onLogout, currentLanguage }: SettingsModeSwitchingProps) {
  const t = translations[currentLanguage].settings;

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
  const [notifEnabled, setNotifEnabled] = useState(() => localStorage.getItem('sleepease_notif_gen') !== 'false');
  const [selectedTheme, setSelectedTheme] = useState(() => localStorage.getItem('sleepease_theme_gen') || 'dark');
  const [selectedSound, setSelectedSound] = useState(() => localStorage.getItem('sleepease_sound_gen') || 'enabled');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { const s = localStorage.getItem('sleepease_favs'); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const notifLabel = notifEnabled ? t.remindersUpdates : 'Off';
  const themeLabel = selectedTheme === 'dark' ? 'Dark Mode' : selectedTheme === 'light' ? 'Light Mode' : 'System';
  const soundLabel = selectedSound === 'enabled' ? 'Enabled' : 'Disabled';
  const favsCount = favorites.length;

  const THEMES = [{ id: 'dark', label: 'Dark Mode' }, { id: 'light', label: 'Light Mode' }, { id: 'system', label: 'System Default' }];
  const SOUNDS = [{ id: 'enabled', label: 'Enabled' }, { id: 'disabled', label: 'Disabled' }];
  const ACHIEVEMENTS = [
    { name: 'First Check-in', icon: '\u2705', earned: true },
    { name: '7-Day Streak', icon: '\ud83d\udd25', earned: true },
    { name: 'Night Owl', icon: '\ud83e\udd89', earned: true },
    { name: 'Calm Master', icon: '\ud83e\uddd8', earned: true },
    { name: 'Early Bird', icon: '\ud83c\udf05', earned: true },
    { name: 'Mindful Listener', icon: '\ud83c\udfa7', earned: true },
    { name: 'Deep Breather', icon: '\ud83d\udca8', earned: true },
    { name: 'Moon Gazer', icon: '\ud83c\udf19', earned: false },
    { name: '30-Day Streak', icon: '\ud83d\udc8e', earned: false },
    { name: 'Sleep Master', icon: '\ud83c\udfc6', earned: false },
  ];
  const FAVORITE_CONTENT = [
    { id: 'rain', title: 'Rain Sounds', desc: 'Nature ambient' },
    { id: 'meditation', title: 'Deep Meditation', desc: '10 min guided session' },
    { id: 'breathing', title: '4-7-8 Breathing', desc: 'Relaxation technique' },
    { id: 'ocean', title: 'Ocean Waves', desc: 'Nature ambient' },
    { id: 'bodyscan', title: 'Body Scan', desc: '15 min guided session' },
    { id: 'affirmations', title: 'Sleep Affirmations', desc: 'Positive self-talk' },
  ];
  const FAQ_ITEMS = [
    { q: 'How does mood tracking work?', a: 'Check in daily with your mood and emotions. The app tracks patterns over time to help you understand your emotional well-being.' },
    { q: 'What are sleep sounds?', a: 'Sleep sounds are ambient audio tracks designed to help you fall asleep faster. Choose from rain, ocean, white noise, and more.' },
    { q: 'Is my data private?', a: 'Yes, all your data is encrypted and stored securely. We never share your personal information with third parties.' },
    { q: 'How does the AI assistant work?', a: 'The AI assistant uses advanced language models to provide wellness guidance and emotional support for better sleep.' },
    { q: 'Can I switch between modes?', a: 'Yes, you can switch between General and Islamic modes at any time from the Settings page.' },
  ];

  const toggleFav = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id];
    setFavorites(next);
    localStorage.setItem('sleepease_favs', JSON.stringify(next));
  };

  const getPanelTitle = () => {
    const titles: Record<string, string> = {
      notifications: t.notifications, theme: t.theme, sound: t.sound, account: t.manageAccount,
      achievements: translations[currentLanguage].generalHome.achievements, favorites: t.favorites,
      help: t.helpCenter, contact: t.contactSupport, privacy: t.privacyPolicy, terms: t.termsOfService,
    };
    return titles[activePanel || ''] || '';
  };

  const renderPanelContent = () => {
    switch (activePanel) {
      case 'notifications':
        return (
          <div className="space-y-3">
            {[{ key: 'bedtime', label: 'Bedtime Reminder', desc: 'Reminder to prepare for sleep' },
              { key: 'mood', label: 'Mood Check-in', desc: 'Daily mood tracking reminder' },
              { key: 'tips', label: 'Daily Tips', desc: 'Receive daily wellness tips' },
              { key: 'sounds', label: 'New Content', desc: 'Notify when new sounds are added' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-4 rounded-2xl bg-white/10 border border-white/10">
                <div>
                  <p className="text-white text-sm font-medium">{item.label}</p>
                  <p className="text-white/50 text-xs mt-0.5">{item.desc}</p>
                </div>
                <button onClick={() => { setNotifEnabled(!notifEnabled); localStorage.setItem('sleepease_notif_gen', String(!notifEnabled)); }}
                  className={`w-12 h-7 rounded-full transition-colors relative ${notifEnabled ? 'bg-blue-500' : 'bg-white/20'}`}>
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
              <button key={th.id} onClick={() => { setSelectedTheme(th.id); localStorage.setItem('sleepease_theme_gen', th.id); }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedTheme === th.id ? 'bg-blue-500/20 border-blue-400/40' : 'bg-white/10 border-white/10'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl border border-white/20 ${th.id === 'dark' ? 'bg-slate-800' : th.id === 'light' ? 'bg-slate-200' : 'bg-gradient-to-br from-slate-800 to-slate-200'}`} />
                  <span className="text-white font-medium">{th.label}</span>
                </div>
                {selectedTheme === th.id && <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">✓</div>}
              </button>
            ))}
          </div>
        );
      case 'sound':
        return (
          <div className="space-y-3">
            {SOUNDS.map(s => (
              <button key={s.id} onClick={() => { setSelectedSound(s.id); localStorage.setItem('sleepease_sound_gen', s.id); }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedSound === s.id ? 'bg-blue-500/20 border-blue-400/40' : 'bg-white/10 border-white/10'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-lg">🔊</div>
                  <span className="text-white font-medium">{s.label}</span>
                </div>
                {selectedSound === s.id && <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">✓</div>}
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
                <p className="text-blue-300 text-xs mb-1">{f.label}</p>
                <p className="text-white font-medium">{f.value}</p>
              </div>
            ))}
          </div>
        );
      case 'achievements':
        return (
          <div className="space-y-3">
            {ACHIEVEMENTS.map(m => (
              <div key={m.name} className={`flex items-center gap-3 p-4 rounded-2xl border ${m.earned ? 'bg-white/10 border-white/10' : 'bg-white/5 border-white/5 opacity-50'}`}>
                <span className="text-2xl">{m.icon}</span>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{m.name}</p>
                  <p className="text-white/50 text-xs">{m.earned ? 'Earned' : 'Locked'}</p>
                </div>
                {m.earned && <span className="text-blue-400 text-sm">✓</span>}
              </div>
            ))}
          </div>
        );
      case 'favorites':
        return (
          <div className="space-y-3">
            {FAVORITE_CONTENT.map(item => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/10 border border-white/10">
                <div>
                  <p className="text-white text-sm font-medium">{item.title}</p>
                  <p className="text-white/50 text-xs mt-0.5">{item.desc}</p>
                </div>
                <button onClick={() => toggleFav(item.id)} className="text-lg">
                  {favorites.includes(item.id) ? '\u2764\ufe0f' : '\ud83e\udd0d'}
                </button>
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
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-blue-300" />
              </div>
              <h3 className="text-white font-medium mb-2">Get in Touch</h3>
              <p className="text-white/60 text-sm mb-4">Send us a message and we'll respond as soon as possible.</p>
              <a href="mailto:support@sleepease.app" className="inline-block px-6 py-3 rounded-xl bg-blue-500/30 border border-blue-400/30 text-blue-200 text-sm font-medium">
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
                <h3 className="text-blue-300 text-sm font-medium mb-2">{s.t}</h3>
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
              { t: 'AI Disclaimer', d: 'AI-generated responses are for general guidance only and should not replace professional medical or psychological advice.' },
              { t: 'Updates', d: 'We may update these terms from time to time. Continued use constitutes acceptance of updated terms.' }].map(s => (
              <div key={s.t} className="p-4 rounded-2xl bg-white/10 border border-white/10">
                <h3 className="text-blue-300 text-sm font-medium mb-2">{s.t}</h3>
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
      <div className="absolute inset-0 bg-gradient-to-b from-slate-700 via-slate-800 to-blue-900" />

      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" />

      {/* Scrollable Content */}
      <div className="relative w-full h-full px-6 pt-14 pb-28 overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-white text-2xl font-light mb-1">{t.title}</h1>
          <p className="text-white/60 text-sm">{t.subtitle}</p>
        </div>

        {/* Profile Card */}
        <div className="mb-6 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-xl border border-blue-400/20 p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400/40 to-purple-400/40 flex items-center justify-center text-2xl">
              👤
            </div>
            <div className="flex-1">
              <h3 className="text-white text-lg font-medium">{userInfo.name || translations[currentLanguage].generalHome.guest}</h3>
              <p className="text-white/70 text-sm">{userInfo.email || 'No email'}</p>
              <div className="flex items-center gap-2 mt-1">
                <Star className="w-3 h-3 text-yellow-400" />
                <span className="text-white/60 text-xs">{t.premiumMember}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40" />
          </div>
        </div>

        {/* PREFERENCES */}
        <SectionLabel text={t.preferences} />
        <div className="space-y-2 mb-6">
          {/* App Mode */}
          <SettingRow
            icon={<Sun className="w-5 h-5" />}
            label={t.appMode}
            subtitle={currentMode === 'general' ? t.generalMode : t.islamicMode}
            iconBg="from-amber-500/30 to-orange-500/30"
            onClick={handleModeSwitch}
          />

          {/* Notifications */}
          <SettingRow
            icon={<Bell className="w-5 h-5" />}
            label={t.notifications}
            subtitle={notifLabel}
            iconBg="from-blue-500/30 to-cyan-500/30"
            badge={notifEnabled ? '3' : 'Off'}
            onClick={() => setActivePanel('notifications')}
          />

          {/* Theme */}
          <SettingRow
            icon={<Palette className="w-5 h-5" />}
            label={t.theme}
            subtitle={themeLabel}
            iconBg="from-purple-500/30 to-pink-500/30"
            onClick={() => setActivePanel('theme')}
          />

          {/* Sound */}
          <SettingRow
            icon={<Volume2 className="w-5 h-5" />}
            label={t.sound}
            subtitle={soundLabel}
            iconBg="from-green-500/30 to-emerald-500/30"
            onClick={() => setActivePanel('sound')}
          />

          {/* Language */}
          <SettingRow
            icon={<Globe className="w-5 h-5" />}
            label={t.language}
            subtitle={currentLanguage === 'en' ? 'English' : currentLanguage === 'zh' ? '中文' : currentLanguage === 'ar' ? 'العربية' : 'Bahasa Melayu'}
            iconBg="from-indigo-500/30 to-blue-500/30"
            onClick={() => navigate('language-selection')}
          />
        </div>

        {/* ACCOUNT */}
        <SectionLabel text={t.account} />
        <div className="space-y-2 mb-6">
          <SettingRow
            icon={<User className="w-5 h-5" />}
            label={t.manageAccount}
            subtitle={t.manageAccountDesc}
            iconBg="from-slate-500/30 to-gray-500/30"
            onClick={() => setActivePanel('account')}
          />

          <SettingRow
            icon={<Award className="w-5 h-5" />}
            label={translations[currentLanguage].generalHome.achievements}
            subtitle={`${ACHIEVEMENTS.filter(m => m.earned).length} badges earned`}
            iconBg="from-yellow-500/30 to-amber-500/30"
            onClick={() => setActivePanel('achievements')}
          />

          <SettingRow
            icon={<Heart className="w-5 h-5" />}
            label={t.favorites}
            subtitle={`${favsCount} saved`}
            iconBg="from-red-500/30 to-pink-500/30"
            onClick={() => setActivePanel('favorites')}
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
            iconBg="from-green-500/30 to-teal-500/30"
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
          <div className="flex-1 rounded-t-3xl bg-gradient-to-b from-slate-800 to-blue-950 border-t border-blue-400/20 flex flex-col overflow-hidden">
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
        <div className="w-full rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 px-4 py-3 flex justify-between items-center">
          <button className="flex flex-col items-center gap-1" onClick={() => navigate(currentMode === 'general' ? 'general-home' : 'islamic-home')}>
            <Home className="w-5 h-5 text-white/60" />
            <span className="text-[10px] text-white/60">{translations[currentLanguage].generalHome.home}</span>
          </button>
          <button className="flex flex-col items-center gap-1" onClick={() => navigate('mood-history-general')}>
            <Compass className="w-5 h-5 text-white/60" />
            <span className="text-[10px] text-white/60">{translations[currentLanguage].generalHome.explore}</span>
          </button>
          <button className="flex flex-col items-center gap-1" onClick={() => navigate('ai-chat')}>
            <MessageCircle className="w-5 h-5 text-white/60" />
            <span className="text-[10px] text-white/60">{translations[currentLanguage].generalHome.ai}</span>
          </button>
          <button className="flex flex-col items-center gap-1">
            <User className="w-5 h-5 text-white" />
            <span className="text-[10px] text-white">{translations[currentLanguage].generalHome.profile}</span>
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ---------- Components ---------- */

function SectionLabel({ text }: { text: string }) {
  return <p className="text-white/40 text-xs tracking-widest mb-3 mt-2">{text}</p>;
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
        {subtitle && <p className="text-white/60 text-xs mt-0.5">{subtitle}</p>}
      </div>

      {badge && (
        <div className="px-2 py-0.5 rounded-full bg-red-500/30 border border-red-400/30">
          <span className="text-red-300 text-xs font-medium">{badge}</span>
        </div>
      )}

      {!hideArrow && <ChevronRight className="w-5 h-5 text-white/40 flex-shrink-0" />}
    </button>
  );
}