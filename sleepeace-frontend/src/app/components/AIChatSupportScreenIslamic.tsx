import { useState, useRef, useEffect } from 'react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { 
  Send, 
  Home, 
  Compass, 
  User, 
  MessageCircle,
  Moon,
  ArrowLeft,
  Sparkles,
  BookOpen,
  Heart
} from 'lucide-react';
import PhoneFrame from './PhoneFrame';
import { auth } from '../../lib/firebaseClient';

type Message = {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp?: string;
};

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

interface AIChatSupportScreenIslamicProps {
  navigate: (screen: Screen, mode?: Mode) => void;
}

const CHAT_API_URLS = import.meta.env.DEV
  ? ['/api/chat', '/api/ai/chat']
  : ['https://sleepease-backend.onrender.com/chat', 'https://sleepease-backend.onrender.com/ai/chat'];

const CHAT_REQUEST_TIMEOUT_MS = 15000;

const quickPrompts = [
  { text: "Help me find peace", icon: "🤲" },
  { text: "Feeling anxious", icon: "😰" },
  { text: "Need du'a guidance", icon: "📿" },
  { text: "Spiritual support", icon: "🕌" },
];

export default function AIChatSupportScreenIslamic({ navigate }: AIChatSupportScreenIslamicProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: 1, 
      text: "As-salamu alaykum, Sarah! I'm your Islamic wellness companion. How are you feeling tonight? May Allah ease your worries. 💚", 
      sender: 'bot',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const requestChat = async (payload: { message: string; mode: string }, headers: Record<string, string>) => {
    const errors: string[] = [];

    for (const url of CHAT_API_URLS) {
      if (Capacitor.isNativePlatform()) {
        try {
          const nativeResp = await CapacitorHttp.post({
            url,
            headers,
            data: payload,
            connectTimeout: CHAT_REQUEST_TIMEOUT_MS,
            readTimeout: CHAT_REQUEST_TIMEOUT_MS,
          });

          if (nativeResp.status === 404 || nativeResp.status === 401 || nativeResp.status === 403) {
            errors.push(`${url}: ${nativeResp.status}`);
            continue;
          }

          if (nativeResp.status < 200 || nativeResp.status >= 300) {
            errors.push(`${url}: ${nativeResp.status}`);
            continue;
          }

          const data = typeof nativeResp.data === 'string'
            ? JSON.parse(nativeResp.data)
            : nativeResp.data;
          return data as { reply?: string; response?: string; message?: string };
        } catch (error) {
          errors.push(`${url}: native request failed`);
          continue;
        }
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS);
      let response: Response;

      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (error) {
        window.clearTimeout(timeoutId);
        if (error instanceof DOMException && error.name === 'AbortError') {
          errors.push(`${url}: timeout`);
          continue;
        }
        errors.push(`${url}: network error`);
        throw error;
      } finally {
        window.clearTimeout(timeoutId);
      }

      if (response.status === 404 || response.status === 401 || response.status === 403) {
        errors.push(`${url}: ${response.status}`);
        continue;
      }

      if (!response.ok) {
        errors.push(`${url}: ${response.status}`);
        continue;
      }

      return response.json() as Promise<{ reply?: string; response?: string; message?: string }>;
    }

    throw new Error(`No compatible chat endpoint found (${errors.join(', ')})`);
  };

  // Send message to AI backend
  const sendToAI = async (userText: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    const userMsg: Message = { 
      id: messages.length + 1, 
      text: userText, 
      sender: 'user',
      timestamp
    };
    
    setMessages(prev => [...prev, userMsg]);
    setMessage('');
    setIsTyping(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const data = await requestChat({ message: userText, mode: 'islamic' }, headers);
      const botTimestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      setMessages(prev => [...prev, {
        id: Date.now(),
        text: data.reply || data.response || data.message || 'May Allah bring peace to your heart.',
        sender: 'bot',
        timestamp: botTimestamp
      }]);
    } catch (error) {
      console.error("Connection error:", error);
      const botTimestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: "SubhanAllah, I'm having trouble connecting right now. Please try again. May Allah ease your way.",
        sender: 'bot',
        timestamp: botTimestamp
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      sendToAI(message);
    }
  };

  const handleQuickPrompt = (promptText: string) => {
    setMessage(promptText);
    setTimeout(() => {
      if (promptText.trim()) {
        sendToAI(promptText);
      }
    }, 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const showQuickPrompts = messages.length === 1;

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
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400/30 to-teal-400/30 flex items-center justify-center">
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
              </div>
              <div>
                <h2 className="text-white text-sm font-medium">Islamic Wellness Guide</h2>
                <p className="text-emerald-100/70 text-xs flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Here to help
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${msg.sender === 'user' ? '' : 'flex items-start gap-2'}`}>
                  {msg.sender === 'bot' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400/30 to-teal-400/30 flex items-center justify-center flex-shrink-0 mt-1">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
                  )}
                  
                  <div>
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-br from-emerald-500/40 to-teal-500/40 border border-emerald-400/30'
                          : 'bg-white/10 border border-white/20'
                      } backdrop-blur-md`}
                    >
                      <p className="text-white/90 text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>
                    </div>
                    {msg.timestamp && (
                      <p className={`text-emerald-100/50 text-xs mt-1 ${msg.sender === 'user' ? 'text-right' : 'text-left ml-1'}`}>
                        {msg.timestamp}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="max-w-[80%] flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400/30 to-teal-400/30 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
                  
                  <div className="rounded-2xl px-4 py-3 bg-white/10 border border-white/20 backdrop-blur-md">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-emerald-400/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-emerald-400/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-emerald-400/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts - Only show initially */}
          {showQuickPrompts && (
            <div className="mt-6">
              <p className="text-emerald-100/70 text-xs mb-3 text-center">Quick suggestions:</p>
              <div className="grid grid-cols-2 gap-2">
                {quickPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickPrompt(prompt.text)}
                    className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-md px-3 py-3 text-left transition-all hover:bg-white/15 active:scale-95"
                  >
                    <span className="text-lg mb-1 block">{prompt.icon}</span>
                    <span className="text-white/80 text-xs">{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Message Input - Fixed at bottom */}
        <div className="px-6 pb-28">
          <div className="rounded-2xl bg-white/15 border border-white/20 backdrop-blur-xl p-3 flex items-center gap-3">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-transparent outline-none text-white placeholder:text-emerald-100/50 text-sm"
              onKeyPress={handleKeyPress}
            />
            <button 
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                message.trim()
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-500 hover:scale-105 active:scale-95'
                  : 'bg-white/10 border border-white/20'
              }`}
              onClick={handleSendMessage}
              disabled={!message.trim()}
            >
              <Send className={`w-4 h-4 ${message.trim() ? 'text-white' : 'text-white/40'}`} />
            </button>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="absolute left-0 right-0 bottom-5 px-10">
          <div className="w-full rounded-2xl bg-white/12 backdrop-blur-md border border-white/15 px-4 py-3 flex justify-between items-center">
            <button className="flex flex-col items-center gap-1" onClick={() => navigate('islamic-home')}>
              <Home className="w-5 h-5 text-white/60" />
              <span className="text-[10px] text-white/55">Home</span>
            </button>
            <button className="flex flex-col items-center gap-1" onClick={() => navigate('mood-history-islamic')}>
              <Compass className="w-5 h-5 text-white/60" />
              <span className="text-[10px] text-white/55">Qibla</span>
            </button>
            <button className="flex flex-col items-center gap-1">
              <MessageCircle className="w-5 h-5 text-white" />
              <span className="text-[10px] text-white/85">AI</span>
            </button>
            <button className="flex flex-col items-center gap-1" onClick={() => navigate('settings-islamic')}>
              <User className="w-5 h-5 text-white/60" />
              <span className="text-[10px] text-white/55">Profile</span>
            </button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
