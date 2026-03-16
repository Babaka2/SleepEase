import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Sparkles } from 'lucide-react';
import PhoneFrame from './PhoneFrame';
import { Language } from '../translations';
import { auth } from '../../lib/firebaseClient';

type Screen =
  | 'mode-selection'
  | 'general-home'
  | 'islamic-home'
  | 'general-login'
  | 'islamic-login'
  | 'general-signup'
  | 'islamic-signup'
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

interface AIChatSupportScreenProps {
  navigate: (screen: Screen, mode?: Mode) => void;
  currentLanguage: Language;
  userName: string;
}

const CHAT_API_URLS = import.meta.env.DEV
  ? ['/api/chat', '/api/ai/chat']
  : ['https://sleepease-backend.onrender.com/chat', 'https://sleepease-backend.onrender.com/ai/chat'];

const CHAT_REQUEST_TIMEOUT_MS = 15000;

const AIChatSupportScreen = ({ navigate, currentLanguage, userName }: AIChatSupportScreenProps) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    { id: 1, text: `Welcome${userName ? `, ${userName}` : ''}! I'm your SleepEase companion. How are you feeling tonight? I'm here to help you relax and find peace.`, sender: 'bot' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const requestChat = async (payload: { message: string; mode: string }, headers: Record<string, string>) => {
    const errors: string[] = [];

    for (const url of CHAT_API_URLS) {
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

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMsg = { id: Date.now(), text: message, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = message;
    setMessage("");

    setIsTyping(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const data = await requestChat({ message: currentInput, mode: 'general' }, headers);

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: data.reply || data.response || data.message || 'I am here with you.',
        sender: 'bot'
      }]);
    } catch (error) {
      console.error("Connection error:", error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: "I couldn't get a response just now. Please try again in a few seconds.",
        sender: 'bot'
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <PhoneFrame>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-700 via-slate-800 to-blue-900" />

      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-40 left-10 w-40 h-40 bg-purple-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-5 w-24 h-24 bg-indigo-400/10 rounded-full blur-2xl" />
      </div>

      {/* Content */}
      <div className="relative w-full h-full flex flex-col">
        {/* Header */}
        <div className="px-5 pt-14 pb-4 flex items-center gap-3">
          <button
            onClick={() => navigate('general-home', 'general')}
            className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all hover:bg-white/15 active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 text-white/80" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-white text-lg font-medium">AI Sleep Coach</h1>
                <p className="text-white/50 text-xs">Here to help you rest</p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                m.sender === 'user' 
                  ? 'bg-blue-500 text-white rounded-br-md' 
                  : 'bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-bl-md'
              }`}>
                <p className="text-sm leading-relaxed">{m.text}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-4 pb-8 pt-3">
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Share your feelings..."
                className="w-full px-4 py-3 pr-12 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-400/50 focus:bg-white/15 transition-all text-sm"
              />
            </div>
            <button 
              onClick={handleSendMessage}
              disabled={!message.trim()}
              className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
};

export default AIChatSupportScreen;