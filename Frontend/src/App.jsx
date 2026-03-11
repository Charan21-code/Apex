import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  linkWithCredential,
  EmailAuthProvider,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  limit,
  writeBatch
} from 'firebase/firestore';
import {
  Menu,
  Home,
  Calendar as CalendarIcon,
  Bot,
  Wallet,
  Users,
  Settings,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  Moon,
  Sun,
  Edit3,
  Send,
  Sparkles,
  Zap,
  LogOut,
  Flame,
  Heart,
  Coins,
  Brain,
  TrendingUp,
  Activity,
  ArrowRight,
  Quote,
  DollarSign,
  Crown,
  PieChart,
  Target,
  Trophy,
  Shield,
  MessageSquare,
  Bell,
  Download,
  Power,
  BarChart2,
  ChevronsLeft,
  ChevronsRight,
  Lock,
  IndianRupee
} from 'lucide-react';

// --- Firebase Configuration ---
// Prefer Vite env vars (VITE_FIREBASE_*) for development, fall back to legacy __firebase_config if present
let firebaseConfig;
try {
  if (import.meta.env.VITE_FIREBASE_API_KEY) {
    firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    };
  } else if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
  } else {
    console.error('Firebase config not found. Provide env vars (VITE_FIREBASE_*) or set __firebase_config.');
    firebaseConfig = {};
  }
} catch (e) {
  console.error('Error reading Firebase config:', e);
  firebaseConfig = {};
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = import.meta.env.VITE_APP_ID || (typeof __app_id !== 'undefined' ? __app_id : 'default-app-id');

// --- Gemini API ---
const apiKey = import.meta.env.VITE_GEMINI_KEY || "";

const callGemini = async (prompt, systemInstruction = "") => {
  const useProxy = (import.meta.env.VITE_GEMINI_USE_PROXY || '').toLowerCase() === 'true';

  const payload = {
    prompt,
    systemInstruction
  };

  const callDirect = async () => {
    if (!apiKey) throw new Error("Gemini API key not configured (VITE_GEMINI_KEY).");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
    };

    let delay = 1000;
    for (let i = 0; i < 3; i++) {
      try {
        console.log(`Attempting Gemini API call (Attempt ${i + 1})...`);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          console.error(`Gemini API Error: ${response.status} ${response.statusText}`, text);
          throw new Error(`API Error ${response.status}: ${response.statusText} - ${text}`);
        }
        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!resultText) {
          console.warn("Gemini response is empty or malformed:", data);
          return "I'm having trouble thinking right now. Please try again.";
        }
        return resultText;
      } catch (error) {
        console.error('Direct Gemini call failed:', error);
        if (i === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  };

  const callProxy = async () => {
    const backendBase = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
    const url = backendBase ? `${backendBase}/gen` : '/gen';

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Proxy Error ${res.status}: ${res.statusText} - ${txt}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.text;
  };

  // Prefer proxy when configured to avoid exposing API key and avoid CORS
  try {
    if (useProxy) return await callProxy();
    return await callDirect();
  } catch (err) {
    console.error('callGemini error:', err);
    // Re-throw so callers can show a toast and handle fallback
    throw err;
  }
};

// --- Utilities ---
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const formatDateId = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const formatDuration = (mins) => !mins ? "0h 0m" : `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;

// --- UI Components ---

// Generic Modal 
const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-md" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className={`bg-slate-900 border border-slate-700 rounded-2xl w-full ${maxWidth} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]`}>
        <div className="bg-slate-900/50 p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-0 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

// 1. Navigation Sidebar
const Sidebar = ({ currentScreen, setScreen, isOpen, setIsOpen, user, profile, isCollapsed, toggleCollapse }) => {
  const navItems = [
    { id: 'home', label: 'Today', icon: Home, color: 'text-emerald-400' },
    { id: 'monthly', label: 'Progress', icon: CalendarIcon, color: 'text-emerald-400' },
    { id: 'coach', label: 'AI Coach', icon: Bot, color: 'text-indigo-400' },
    { id: 'finance', label: 'Finance', icon: Wallet, color: 'text-emerald-400' },
    { id: 'squad', label: 'Squad', icon: Users, color: 'text-amber-400' },
  ];

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      <div className={`fixed inset-y-0 left-0 z-50 bg-slate-950 border-r border-slate-800 transform transition-all duration-300 md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="flex flex-col h-full">
          <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center overflow-hidden shadow-lg shadow-emerald-900/20">
              <img src="/apex-logo.jpg" alt="Apex Logo" className="w-full h-full object-cover" />
            </div>
            {!isCollapsed && <span className="font-bold text-white tracking-tight text-lg whitespace-nowrap animate-in fade-in duration-300">Apex</span>}
          </div>

          <nav className="flex-1 px-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setScreen(item.id); setIsOpen(false); }}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl transition-all duration-200 group ${currentScreen === item.id
                  ? 'bg-slate-900 text-white shadow-inner shadow-black/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                  }`}
                title={isCollapsed ? item.label : ''}
              >
                <item.icon size={20} className={`${currentScreen === item.id ? item.color : 'text-slate-500 group-hover:text-slate-300'} transition-colors`} />
                {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>}
                {!isCollapsed && currentScreen === item.id && <div className={`ml-auto w-1.5 h-1.5 rounded-full ${item.color.replace('text-', 'bg-')}`} />}
              </button>
            ))}
          </nav>

          <div className="p-4 space-y-2 border-t border-slate-900">
            <button
              onClick={toggleCollapse}
              className="hidden md:flex w-full items-center justify-center p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-900/50 rounded-lg transition-colors"
            >
              {isCollapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
            </button>

            <button
              onClick={() => { setScreen('profile'); setIsOpen(false); }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl transition-colors cursor-pointer group text-left ${currentScreen === 'profile' ? 'bg-slate-900' : 'hover:bg-slate-900/50'}`}
              title="Profile"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                <UserCircle size={18} className="text-slate-400" />
              </div>
              {!isCollapsed && (
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium text-slate-200 truncate">{profile?.name || 'User'}</p>
                  <p className="text-xs text-slate-500 truncate">Level {profile?.level || 1}</p>
                </div>
              )}
              {!isCollapsed && <Settings size={16} className="text-slate-600 group-hover:text-slate-400" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// 2. Auth Screen
const AuthScreen = ({ onSubmit, addToast }) => {
  const [isLogin, setIsLogin] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', mainGoal: '' });
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleSubmit = async () => {
    setAuthError(''); // Clear previous errors
    if (isLogin) {
      if (!formData.email || !formData.password) {
        setAuthError('Please provide both email and password to sign in.');
        addToast && addToast('Please provide both email and password to sign in.', 'error');
        return;
      }
    } else {
      // Sign Up validation
      if (!formData.name || !formData.email || !formData.password) {
        setAuthError('Please provide name, email and password to create an account.');
        addToast && addToast('Please provide name, email and password to create an account.', 'error');
        return;
      } if (!formData.mainGoal) {
        setAuthError('Please provide your main focus / goal.');
        addToast && addToast('Please provide your main focus / goal.', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      if (onSubmit) {
        await onSubmit(formData, isLogin);
      }
    } catch (error) {
      const errorMessage = error?.message || 'Authentication failed. Please try again.';
      setAuthError(errorMessage);
      console.error('Auth error caught in handleSubmit:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-md w-full glass-card rounded-3xl relative overflow-hidden flex flex-col z-10">
        <div className="p-8 pb-6 text-center">
          <div className="w-24 h-24 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/30 group overflow-hidden">
            <img src="/apex-logo.jpg" alt="Apex Logo" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{isLogin ? 'Welcome Back' : 'Join Apex'}</h1>
          <p className="text-zinc-400 text-sm">Architect your life. One pixel at a time.</p>
        </div>

        <div className="flex border-b border-white/5 px-8">
          <button
            onClick={() => { setIsLogin(false); setAuthError(''); }}
            className={`flex-1 pb-4 text-sm font-bold transition-all border-b-2 ${!isLogin ? 'text-white border-violet-500' : 'text-zinc-600 border-transparent hover:text-zinc-400'}`}
          >
            Sign Up
          </button>
          <button
            onClick={() => { setIsLogin(true); setAuthError(''); }}
            className={`flex-1 pb-4 text-sm font-bold transition-all border-b-2 ${isLogin ? 'text-white border-indigo-500' : 'text-zinc-600 border-transparent hover:text-zinc-400'}`}
          >
            Sign In
          </button>
        </div>

        <div className="p-8 space-y-5">

          {!isLogin && (
            <div className="space-y-1.5 animate-in slide-in-from-top-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Name</label>
              <div className="relative group">
                <UserCircle className="absolute left-3 top-3.5 text-zinc-600 group-focus-within:text-violet-400 transition-colors" size={18} />
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 focus:outline-none transition-all placeholder-zinc-700 hover:border-white/20"
                  placeholder="e.g. Alex"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Email</label>
            <div className="relative group">
              <UserCircle className="absolute left-3 top-3.5 text-zinc-600 group-focus-within:text-violet-400 transition-colors" size={18} />
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                autoComplete="email"
                className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 focus:outline-none transition-all placeholder-zinc-700 hover:border-white/20"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Password</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-3.5 text-zinc-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
              <input
                type="password"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 focus:outline-none transition-all placeholder-zinc-700 hover:border-white/20"
                placeholder="••••••••"
              />
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-1.5 animate-in slide-in-from-top-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Main Focus</label>
              <div className="relative group">
                <Target className="absolute left-3 top-3.5 text-zinc-600 group-focus-within:text-amber-400 transition-colors" size={18} />
                <input
                  type="text"
                  value={formData.mainGoal}
                  onChange={e => setFormData({ ...formData, mainGoal: e.target.value })}
                  className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 focus:outline-none transition-all placeholder-zinc-700 hover:border-white/20"
                  placeholder="e.g. Build a Startup"
                />
              </div>
            </div>
          )}

          {authError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 animate-in slide-in-from-top-2">
              <div className="flex items-start gap-2">
                <div className="text-red-400 font-bold mt-0.5">⚠</div>
                <div className="flex-1">
                  <p className="text-sm text-red-300 font-medium">{authError}</p>
                  {isLogin && authError.includes('account') && (
                    <p className="text-xs text-red-200/50 mt-1">💡 Don't have an account yet? Switch to Sign Up tab to create one.</p>
                  )}
                  {isLogin && authError.includes('password') && (
                    <p className="text-xs text-red-200/50 mt-1">💡 Check your email and password. Remember, passwords are case-sensitive.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full mt-2 text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 active:scale-95 ${isLogin
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-indigo-900/40 hover:shadow-indigo-900/60'
              : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-900/40 hover:shadow-emerald-900/60'
              }`}
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 3. Immersive Sleep Mode
const SleepMode = ({ startTime, onWakeUp }) => {
  const [elapsed, setElapsed] = useState("0h 0m");

  useEffect(() => {
    const tick = () => {
      if (!startTime) return;
      const diff = Date.now() - startTime;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setElapsed(`${h}h ${m}m`);
    };
    tick();
    const int = setInterval(tick, 60000);
    return () => clearInterval(int);
  }, [startTime]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center animate-in fade-in duration-1000">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center space-y-12 text-center p-6">
        <div className="w-24 h-24 rounded-full bg-slate-900/50 border border-indigo-500/20 flex items-center justify-center animate-pulse">
          <Moon size={40} className="text-indigo-400" />
        </div>

        <div className="space-y-4">
          <h2 className="text-slate-400 uppercase tracking-[0.2em] text-sm font-medium">Sleep In Progress</h2>
          <div className="text-7xl font-light text-white font-mono tracking-tighter tabular-nums">
            {elapsed}
          </div>
        </div>

        <button
          onClick={onWakeUp}
          className="group relative px-8 py-4 bg-gradient-to-r from-orange-400 to-amber-500 rounded-2xl overflow-hidden transition-transform active:scale-95"
        >
          <div className="absolute inset-0 bg-white/20 group-hover:bg-white/30 transition-colors" />
          <div className="relative flex items-center gap-3 text-white font-bold text-lg">
            <Sun size={24} className="animate-[spin_8s_linear_infinite]" />
            Rise & Shine
          </div>
        </button>
      </div>
    </div>
  );
};

// 4. AI Planner Slide-Over
const AIPlanner = ({ isOpen, onClose, onAddHabit }) => {
  const [goal, setGoal] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!goal) return;
    setLoading(true);
    try {
      const prompt = `Goal: "${goal}". Generate 3 specific, actionable, and practical daily habits. They should be concrete actions, not vague ideas. Max 10 words each. Return ONLY a JSON array of strings. Example: ["Read 10 pages of biology", "Do 15 mins of deep work", "Drink 1L water before noon"]`;
      const res = await callGemini(prompt, "You are a habit architect. Return pure JSON.");
      const clean = res.replace(/```json/g, '').replace(/```/g, '').trim();
      const habits = JSON.parse(clean);
      setSuggestions(Array.isArray(habits) ? habits : ["Start small", "Review goal"]);
    } catch (e) {
      console.error('AI Planner error:', e);
      if (e.message && e.message.includes('Gemini API key')) addToast('AI not configured. Set VITE_GEMINI_KEY to enable planner.', 'error');
      setSuggestions([`Spend 5m on ${goal}`, `Plan next steps`, `Visualize success`]);
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed inset-y-0 right-0 z-50 w-full md:w-[400px] bg-slate-900 border-l border-slate-800 shadow-2xl transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Sparkles className="text-indigo-400" size={20} /> AI Planner</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><X size={20} /></button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto space-y-8">
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-400">What's your big goal?</label>
              <div className="flex gap-2">
                <input
                  value={goal} onChange={e => setGoal(e.target.value)}
                  placeholder="e.g. Learn Spanish, Run 5k..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none"
                  onKeyDown={e => e.key === 'Enter' && generate()}
                />
                <button onClick={generate} disabled={loading || !goal} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-3 rounded-xl">
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                </button>
              </div>
            </div>

            {suggestions.length > 0 && (
              <div className="space-y-4 animate-in slide-in-from-bottom-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Suggested Habits</p>
                {suggestions.map((s, i) => (
                  <div key={i} className="group bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center hover:border-emerald-500/50 transition-colors">
                    <span className="text-slate-200 font-medium">{s}</span>
                    <button onClick={() => { onAddHabit(s); setSuggestions(prev => prev.filter((_, idx) => idx !== i)); }} className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                      ADD
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// 5. Profile Screen Components
const ToggleRow = ({ icon: Icon, label, value, onChange }) => (
  <div
    onClick={() => onChange(!value)}
    className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border border-transparent ${value ? 'bg-indigo-500/10 border-indigo-500/30' : 'glass-card hover:bg-white/5'
      }`}
  >
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${value ? 'text-indigo-400' : 'text-zinc-500'}`}>
        <Icon size={18} />
      </div>
      <span className={`font-medium text-sm ${value ? 'text-white' : 'text-zinc-400'}`}>{label}</span>
    </div>
    <div className={`w-10 h-6 rounded-full relative transition-colors ${value ? 'bg-indigo-500' : 'bg-white/10'}`}>
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${value ? 'left-5' : 'left-1'}`} />
    </div>
  </div>
);

const SectionHeader = ({ title }) => (
  <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 mt-6 px-1 flex items-center gap-2">
    <span className="w-1 h-1 rounded-full bg-indigo-500" /> {title}
  </h3>
);

const ProfileScreen = ({ user, profile, stats, habits, dailyLogs, onUpdateProfile, onNavigateToCoach, onSignOut }) => {
  const [name, setName] = useState(profile?.name || '');
  const [goal, setGoal] = useState(profile?.mainGoal || '');
  const [loading, setLoading] = useState(false);

  // Preferences State
  const [preferences, setPreferences] = useState({
    aiTone: 'calm',
    showStreaks: true,
    showXP: true,
    enableNotifications: false,
    showAnalysis: true
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setGoal(profile.mainGoal || '');
      setPreferences(prev => ({ ...prev, ...(profile.preferences || {}) }));
    }
  }, [profile]);

  const handleSave = async (updatedName = name, updatedGoal = goal, updatedPrefs = preferences) => {
    setLoading(true);
    await onUpdateProfile({
      name: updatedName,
      mainGoal: updatedGoal,
      preferences: updatedPrefs
    });
    setLoading(false);
  }

  const togglePref = async (key) => {
    let value = !preferences[key];

    // Request Permission if enabling notifications
    if (key === 'enableNotifications' && value === true) {
      if (!("Notification" in window)) {
        alert("This browser does not support desktop notifications");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        value = false; // Revert if denied
      } else {
        new Notification("Apex Notifications Enabled", { body: "You will now be notified of major milestones.", icon: "/apex-logo.jpg" });
      }
    }

    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    handleSave(name, goal, newPrefs);
  }

  // Sign-out handled by parent via onSignOut prop

  const handleExport = () => {
    const exportData = {
      profile: { ...profile, preferences },
      stats,
      habits,
      dailyLogs
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ascent_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 pb-12">
      {/* 1. Header: Identity Snapshot */}
      <div className="flex items-center gap-6">
        <div className="relative group">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-4xl text-white font-bold shadow-xl shadow-indigo-900/20 group-hover:scale-105 transition-transform">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="absolute -bottom-1 -right-1">
            <div className="bg-black/80 backdrop-blur-md text-amber-400 border border-amber-500/30 text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">
              LVL {stats.level}
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => handleSave()}
            className="bg-transparent text-4xl font-bold text-white focus:outline-none border-b border-transparent focus:border-indigo-500/50 w-full placeholder-zinc-700 transition-colors"
            placeholder="Your Name"
          />
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex items-center gap-1.5 text-orange-400 bg-orange-500/10 px-3 py-1 rounded-lg border border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.1)]">
              <Flame size={16} className="fill-orange-500" />
              {stats.streak} Day Streak
            </div>
          </div>
        </div>
      </div>

      {/* 2. Primary Goal Card */}
      <div className="glass-card p-6 relative group transition-all hover:border-indigo-500/30">
        <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 block">My North Star</label>
        <div className="flex items-start gap-3">
          <Target className="text-emerald-400 mt-1 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" size={24} />
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onBlur={() => handleSave()}
            rows={1}
            className="bg-transparent text-xl font-medium text-white w-full resize-none focus:outline-none placeholder-zinc-700 leading-relaxed"
            placeholder="What is your main goal right now?"
          />
          <Edit3 size={16} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
        </div>
      </div>

      {/* 3. Lifetime Stats Grid */}
      <div>
        <SectionHeader title="Lifetime Progress" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <Check size={20} className="text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{Math.floor(stats.currentXP / 10)}</div>
            <div className="text-xs text-zinc-400 font-medium">Habits Crushed</div>
          </div>
          <div className="glass-card p-4 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
              <Trophy size={20} className="text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.bestStreak || stats.streak}</div>
            <div className="text-xs text-zinc-400 font-medium">Best Streak</div>
          </div>
          <div className="glass-card p-4 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
              <Crown size={20} className="text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.level}</div>
            <div className="text-xs text-zinc-400 font-medium">Current Level</div>
          </div>
          <div className="glass-card p-4 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center mb-3">
              <Zap size={20} className="text-yellow-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{(stats.totalXP || ((stats.level * 1000) + stats.currentXP)).toLocaleString()}</div>
            <div className="text-xs text-zinc-400 font-medium">Lifetime XP</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 4. AI & Personalization */}
        <div>
          <SectionHeader title="Intelligence & Tone" />
          <div className="space-y-3">
            <ToggleRow
              icon={Brain}
              label="Show Analysis in Progress"
              value={preferences.showAnalysis}
              onChange={() => togglePref('showAnalysis')}
            />
            <div className="glass-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg text-indigo-400"><MessageSquare size={18} /></div>
                <span className="text-zinc-200 font-medium text-sm">Coach Persona</span>
              </div>
              <select
                value={preferences.aiTone}
                onChange={(e) => {
                  const newPrefs = { ...preferences, aiTone: e.target.value };
                  setPreferences(newPrefs);
                  handleSave(name, goal, newPrefs);
                }}
                className="bg-black/30 border border-white/10 text-xs text-white rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500 cursor-pointer hover:bg-black/50 transition-colors"
              >
                <option value="calm">Zen Master (Calm)</option>
                <option value="tough">Drill Sergeant (Tough)</option>
                <option value="analytical">Data Scientist (Logic)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 5. Gamification Controls */}
        <div>
          <SectionHeader title="System Preferences" />
          <div className="space-y-3">
            <ToggleRow
              icon={Flame}
              label="Show Streaks"
              value={preferences.showStreaks}
              onChange={() => togglePref('showStreaks')}
            />
            <ToggleRow
              icon={Zap}
              label="XP Animations"
              value={preferences.showXP}
              onChange={() => togglePref('showXP')}
            />
            <ToggleRow
              icon={Bell}
              label="Notifications"
              value={preferences.enableNotifications}
              onChange={() => togglePref('enableNotifications')}
            />
          </div>
        </div>
      </div>

      {/* 6. Account Controls */}
      <div className="pt-8 flex flex-col md:flex-row gap-4 justify-between items-center">
        <button onClick={handleExport} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-medium transition-colors glass-card px-5 py-3 hover:bg-white/5 active:scale-95">
          <Download size={16} /> Export Data JSON
        </button>

        <button onClick={onSignOut} className="flex items-center gap-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-[0_4px_20px_-5px_rgba(239,68,68,0.3)] hover:shadow-[0_4px_25px_-5px_rgba(239,68,68,0.5)] active:scale-95">
          <Power size={16} /> Sign Out
        </button>
      </div>

    </div>
  )
}

// --- SCREENS ---

// 6. Home Screen
const HomeScreen = ({ user, profile, date, habits, setHabits, dailyLogs, saveDailyLog, stats, updateStats, sleepStatus, onToggleSleep, onOpenPlanner }) => {
  const [newHabit, setNewHabit] = useState("");
  const [editingIntention, setEditingIntention] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState(null);
  const [tempHabitName, setTempHabitName] = useState("");
  const [loadingQuote, setLoadingQuote] = useState(false);

  // Safe access to prefs
  const showStreaks = profile?.preferences?.showStreaks ?? true;
  const showXP = profile?.preferences?.showXP ?? true;
  const aiTone = profile?.preferences?.aiTone || 'calm';

  const todayKey = date.getDate();
  const currentLog = dailyLogs[todayKey] || {};
  const completedCount = habits.filter(h => h.completed.includes(todayKey)).length;
  const progress = habits.length ? Math.round((completedCount / habits.length) * 100) : 0;

  useEffect(() => {
    if (!currentLog.quote && !loadingQuote && user) {
      generateQuote();
    }
  }, [user, currentLog.quote]);

  const generateQuote = async () => {
    setLoadingQuote(true);
    try {
      let toneInstruction = "motivational and hard-hitting";
      if (aiTone === 'calm') toneInstruction = "peaceful, zen, and reassuring";
      if (aiTone === 'analytical') toneInstruction = "stoic, factual, and strategic";

      const q = await callGemini(`Generate a unique ${toneInstruction} quote (max 15 words). Format: 'Quote' - Author`);
      if (typeof q === 'string' && q.includes('Gemini API key')) {
        addToast('AI not configured. Set VITE_GEMINI_KEY to enable quotes.', 'error');
        await saveDailyLog(todayKey, { ...currentLog, quote: "Stay hard." });
      } else {
        await saveDailyLog(todayKey, { ...currentLog, quote: q });
      }
    } catch (e) { console.log(e); addToast('Quote generation failed.', 'error'); } finally { setLoadingQuote(false); }
  };

  const toggleHabit = (idx) => {
    const newHabits = [...habits];
    const isDone = newHabits[idx].completed.includes(todayKey);

    if (isDone) {
      newHabits[idx].completed = newHabits[idx].completed.filter(d => d !== todayKey);
      // Bug Fix: Subtract XP/Gold when undoing to prevent farming
      // We pass the raw subtraction to updateStats, which now handles Level Down if XP goes negative
      const currentTotal = stats.totalXP || ((stats.level * 1000) + stats.currentXP);
      updateStats({
        currentXP: (stats.currentXP || 0) - 10,
        gold: Math.max(0, (stats.gold || 0) - 2),
        totalXP: Math.max(0, currentTotal - 10)
      });
    } else {
      newHabits[idx].completed.push(todayKey);
      const currentTotal = stats.totalXP || ((stats.level * 1000) + stats.currentXP);
      updateStats({
        currentXP: (stats.currentXP || 0) + 10,
        gold: (stats.gold || 0) + 2,
        totalXP: currentTotal + 10
      });
    }
    setHabits(newHabits);
  };

  const addHabit = () => {
    if (!newHabit.trim()) return;
    setHabits([...habits, { id: Date.now().toString(), name: newHabit.trim(), completed: [] }]);
    setNewHabit("");
  };

  const deleteHabit = (idx) => {
    setHabits(habits.filter((_, i) => i !== idx));
  };

  const startEditing = (h) => {
    setEditingHabitId(h.id);
    setTempHabitName(h.name);
  }

  const saveHabitName = (idx) => {
    if (tempHabitName.trim()) {
      const h = [...habits];
      h[idx].name = tempHabitName;
      setHabits(h);
    }
    setEditingHabitId(null);
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Today</h1>
          <p className="text-slate-400 text-sm">{date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* Conditional HUD */}
        {(showXP || showStreaks) && (
          <div className="flex items-center gap-4 glass-panel rounded-full px-4 py-2">
            {showXP && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs font-bold ring-1 ring-amber-500/20">{stats.level}</div>
                <div className="h-1.5 w-16 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: `${Math.min((stats.currentXP / stats.nextLevelXP) * 100, 100)}%` }} />
                </div>
              </div>
            )}
            {showXP && showStreaks && <div className="w-px h-4 bg-white/10" />}
            {showStreaks && (
              <div className="flex items-center gap-1.5 text-orange-400">
                <Flame size={14} className="fill-orange-400/20 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]" />
                <span className="text-xs font-bold font-mono">{stats.streak || 0}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dynamic Quote & Intention */}
      <div className="space-y-4">
        <div className="flex items-start gap-3 glass-card p-4 rounded-3xl relative group">
          <Quote className="text-violet-500 shrink-0" size={18} />
          <div className="flex-1">
            {loadingQuote ? <div className="text-sm text-zinc-500 animate-pulse">Finding wisdom...</div> : (
              <p className="text-zinc-300 text-sm italic leading-relaxed">"{currentLog.quote || "Stay hard."}"</p>
            )}
          </div>
          <button onClick={generateQuote} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg absolute top-2 right-2">
            <Sparkles size={14} />
          </button>
        </div>

        <div className="group relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-indigo-500 rounded-full opacity-50 shadow-[0_0_15px_rgba(139,92,246,0.5)]" />
          {editingIntention ? (
            <input
              autoFocus
              className="w-full bg-transparent text-xl md:text-2xl font-medium text-white placeholder-zinc-700 outline-none border-b border-white/10 py-2"
              placeholder="What is your main focus today?"
              value={currentLog.intention || ""}
              onChange={e => saveDailyLog(todayKey, { ...currentLog, intention: e.target.value })}
              onBlur={() => setEditingIntention(false)}
              onKeyDown={e => e.key === 'Enter' && setEditingIntention(false)}
            />
          ) : (
            <h2
              onClick={() => setEditingIntention(true)}
              className={`text-xl md:text-2xl font-medium cursor-pointer transition-colors ${currentLog.intention ? 'text-white text-glow' : 'text-zinc-600 italic'}`}
            >
              "{currentLog.intention || "Set a daily intention..."}"
            </h2>
          )}
        </div>
      </div>

      {/* Focus Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity size={80} className="text-violet-500" />
          </div>
          <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Daily Progress</h3>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-4xl font-bold text-white tracking-tight text-glow">{progress}%</span>
            <span className="text-sm text-zinc-500 mb-1">completed</span>
          </div>
          <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 shadow-[0_0_15px_rgba(124,58,237,0.5)] transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div>
            <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Rest & Recovery</h3>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-white tracking-tight">{currentLog.sleepDuration ? formatDuration(currentLog.sleepDuration) : "--"}</span>
            </div>
          </div>
          <button
            onClick={onToggleSleep}
            className={`mt-4 w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${sleepStatus.isSleeping
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 animate-pulse shadow-[0_0_20px_rgba(99,102,241,0.2)]'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
          >
            {sleepStatus.isSleeping ? <><Moon size={16} /> Sleeping...</> : <><Moon size={16} /> Enter Sleep Mode</>}
          </button>
        </div>
      </div>

      {/* Habits */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Your Habits</h3>
          <button onClick={onOpenPlanner} className="text-indigo-400 hover:text-indigo-300 text-xs font-bold px-3 py-1.5 bg-indigo-500/10 rounded-lg transition-colors flex items-center gap-1">
            <Bot size={14} /> AI Planner
          </button>
        </div>

        <div className="space-y-2">
          {habits.map((habit, idx) => {
            const isDone = habit.completed.includes(todayKey);
            return (
              <div key={habit.id} className={`group relative flex items-center gap-4 p-4 rounded-3xl border transition-all cursor-pointer overflow-hidden ${isDone ? 'bg-gradient-to-r from-emerald-500/10 to-transparent border-emerald-500/20' : 'glass-card'}`} onClick={() => toggleHabit(idx)}>
                {/* Glow effect for checked items */}
                {isDone && <div className="absolute inset-0 bg-emerald-500/5 blur-xl" />}

                <div className={`w-6 h-6 rounded-xl flex items-center justify-center border-2 transition-all z-10 ${isDone ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'border-zinc-700 group-hover:border-zinc-500'}`}>
                  {isDone && <Check size={14} className="text-white" strokeWidth={4} />}
                </div>

                {editingHabitId === habit.id ? (
                  <input
                    autoFocus
                    value={tempHabitName}
                    onChange={e => setTempHabitName(e.target.value)}
                    onBlur={() => saveHabitName(idx)}
                    onKeyDown={e => e.key === 'Enter' && saveHabitName(idx)}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 bg-black/50 text-white px-2 py-1 rounded border border-violet-500 outline-none z-10"
                  />
                ) : (
                  <span className={`flex-1 font-medium text-lg transition-colors z-10 ${isDone ? 'text-zinc-500 line-through decoration-zinc-700' : 'text-zinc-200'}`}>
                    {habit.name}
                  </span>
                )}

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button onClick={(e) => { e.stopPropagation(); startEditing(habit); }} className="p-2 text-zinc-500 hover:text-violet-400"><Edit3 size={16} /></button>
                  <button onClick={(e) => { e.stopPropagation(); deleteHabit(idx); }} className="p-2 text-zinc-500 hover:text-red-400"><Trash2 size={16} /></button>
                </div>
              </div>
            )
          })}

          <div className="flex items-center gap-4 p-2 rounded-3xl border border-dashed border-white/10 hover:border-white/20 transition-colors group">
            <div className="w-6 h-6 flex items-center justify-center"><Plus size={16} className="text-zinc-600 group-hover:text-zinc-400" /></div>
            <input
              value={newHabit}
              onChange={e => setNewHabit(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addHabit()}
              placeholder="Add a new daily habit..."
              className="flex-1 bg-transparent text-zinc-500 placeholder-zinc-700 outline-none"
            />
            <button onClick={addHabit} disabled={!newHabit} className="text-xs font-bold text-violet-500 disabled:opacity-0 transition-opacity">ADD</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 7. Monthly Screen (Progress)
const MonthlyScreen = ({ date, habits, dailyLogs, profile, onNavigateToCoach }) => {
  const daysInMonth = getDaysInMonth(date.getFullYear(), date.getMonth());
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const [report, setReport] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [showTrend, setShowTrend] = useState(false);

  // Preference Check
  const showAnalysis = profile?.preferences?.showAnalysis ?? true;

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      // 1. Summarize Habits
      const habitSummary = habits.map(h => `${h.name}: ${Math.round((h.completed.length / daysInMonth) * 100)}%`).join(", ");

      // 2. Summarize Sleep
      const logs = Object.values(dailyLogs);
      const totalSleepMins = logs.reduce((acc, log) => acc + (log.sleepDuration || 0), 0);
      const avgSleepHours = logs.length ? Math.round((totalSleepMins / logs.length / 60) * 10) / 10 : 0;
      const sleepSummary = avgSleepHours > 0 ? `Avg Sleep: ${avgSleepHours}h/night` : "Sleep data: None";

      // 3. Construct Holistic Prompt
      const prompt = `Analyze my performance this month.
      Habits: ${habitSummary}.
      Recovery: ${sleepSummary}.
      
      Provide a combined report connecting my recovery (sleep) to my habit consistency. Identify behavioral blockers and pattern recognition.
      Output: Strictly 5 simple bullet points. No intro.`;

      const text = await callGemini(prompt);
      setReport(text);
    } catch (e) { console.error(e); if (e.message && e.message.includes('Gemini API key')) { addToast('AI not configured. Set VITE_GEMINI_KEY to enable pattern analysis.', 'error'); setReport('AI not configured. To enable analysis set VITE_GEMINI_KEY in your .env.'); } else { addToast('Pattern analysis failed. Try again later.', 'error'); } } finally { setAnalyzing(false); }
  }

  // Calculate daily completion for trend graph
  const trendPoints = days.map((d, i) => {
    const completedOnDay = habits.reduce((acc, h) => acc + (h.completed.includes(d) ? 1 : 0), 0);
    const total = habits.length || 1;
    const percentage = (completedOnDay / total) * 100;
    // Map x to 0-300 range, y to 100-0 range (SVG coordinates)
    const x = (i / (days.length - 1)) * 300;
    const y = 100 - percentage;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Monthly Progress</h1>
          <p className="text-slate-400">Review your momentum.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTrend(!showTrend)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium border ${showTrend ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/10 text-zinc-400 hover:text-white'}`}
          >
            <BarChart2 size={16} />
            {showTrend ? 'Hide Trend' : 'Show Trend'}
          </button>
          {showAnalysis && (
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:shadow-indigo-500/40 disabled:opacity-50 text-white px-4 py-2 rounded-xl transition-all font-medium shadow-lg"
            >
              {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
              Analyze Patterns
            </button>
          )}
        </div>
      </div>

      {showTrend && (
        <div className="glass-card p-6 rounded-3xl overflow-x-auto animate-in slide-in-from-top-4">
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-6">Completion Trend</h3>
          <div className="min-w-[600px] h-40 relative">
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="border-t border-slate-500 w-full" />
              <div className="border-t border-slate-500 w-full" />
              <div className="border-t border-slate-500 w-full" />
            </div>

            {/* SVG Graph */}
            <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline
                fill="none"
                stroke="#10B981"
                strokeWidth="2"
                points={trendPoints}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polygon
                fill="url(#trendGradient)"
                points={`0,100 ${trendPoints} 300,100`}
                opacity="0.5"
              />
            </svg>
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500 font-mono">
            <span>Day 1</span>
            <span>Day {days.length}</span>
          </div>
        </div>
      )}

      {report && (
        <div className="glass-card p-6 rounded-3xl animate-in fade-in slide-in-from-top-2 border-indigo-500/20">
          <h3 className="text-indigo-400 font-bold mb-3 flex items-center gap-2"><Bot size={18} /> Behavior & Pattern Report</h3>
          <div className="prose prose-invert prose-sm max-w-none text-slate-300 whitespace-pre-line leading-relaxed mb-4">
            {report}
          </div>
          <button
            onClick={() => onNavigateToCoach(`Here is my progress analysis:\n${report}\n\nCan you help me improve based on these insights?`)}
            className="text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
          >
            <MessageSquare size={14} /> Discuss with Coach
          </button>
        </div>
      )}

      {/* Heatmap */}
      <div className="glass-card rounded-3xl p-6 overflow-x-auto custom-scrollbar">
        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-6">Habit Consistency Heatmap</h3>
        <div className="min-w-max">
          <div className="flex mb-4 border-b border-slate-800 pb-2">
            <div className="w-48 shrink-0 font-bold text-slate-500 pl-2">Habit</div>
            {days.map(d => (
              <div key={d} className="w-9 text-center text-[10px] text-slate-600 font-mono flex flex-col items-center">
                <span className="opacity-50 mb-1">{new Date(date.getFullYear(), date.getMonth(), d).toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                <span>{d}</span>
              </div>
            ))}
          </div>
          {habits.map(habit => (
            <div key={habit.id} className="flex items-center mb-1 hover:bg-slate-800/30 rounded-lg p-1 transition-colors group">
              <div className="w-48 shrink-0 text-sm font-medium text-slate-300 truncate pr-4 pl-2">{habit.name}</div>
              {days.map(d => {
                const isDone = habit.completed.includes(d);
                const isFuture = new Date(date.getFullYear(), date.getMonth(), d) > new Date();
                return (
                  <div key={d} className="w-9 flex justify-center">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${isFuture ? 'bg-transparent border border-slate-800/50' :
                      isDone ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-800/50'
                      }`}>
                      {isDone && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 8. Finance Screen
const FinanceScreen = ({ user, date, onNavigateToCoach }) => {
  const [data, setData] = useState({ income: 0, budget: 0, goals: [], aiAdvice: '' });
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  // Adding New Goal State
  const [isAddGoalModalOpen, setIsAddGoalModalOpen] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");

  // Delete Confirmation State
  const [goalToDelete, setGoalToDelete] = useState(null);

  // Adding Funds State
  const [activeFundId, setActiveFundId] = useState(null);
  const [fundAmount, setFundAmount] = useState("");

  const docId = formatDateId(date);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'monthly_data', docId), s => {
      const d = s.data() || {};
      const financeData = d.finance || {};
      // Robust default merging to prevent blank screens
      setData({
        income: financeData.income || 0,
        budget: financeData.budget || 0,
        goals: Array.isArray(financeData.goals) ? financeData.goals : [],
        aiAdvice: financeData.aiAdvice || ''
      });
      setLoading(false);
    });
    return () => unsub();
  }, [user, date]);

  const saveFinance = async (newData) => {
    setData(newData); // optimistic
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'monthly_data', docId), { finance: newData }, { merge: true });
  }

  const analyzeFinances = async () => {
    setAnalyzing(true);
    try {
      const goalsList = (data.goals || []).map(g => `${g.name}: ${g.current}/${g.target}`).join(', ');
      const prompt = `Role: Financial Advisor. Analyze: Income ₹${data.income}, Budget ₹${data.budget}. Goals: ${goalsList}.
      Output: Strictly 5 bullet points. No intro.`;
      const advice = await callGemini(prompt);
      saveFinance({ ...data, aiAdvice: advice });
    } catch (e) { console.error('Finance advisor error:', e); if (e.message && e.message.includes('Gemini API key')) { addToast('AI not configured. Set VITE_GEMINI_KEY to enable finance advice.', 'error'); } else { addToast('Advisor busy. Try again later.', 'error'); } } finally { setAnalyzing(false); }
  };

  const addGoal = () => {
    if (!newGoalName || !newGoalTarget) return;
    const target = parseFloat(newGoalTarget);

    const currentGoals = Array.isArray(data.goals) ? data.goals : [];
    const newGoals = [...currentGoals, { id: Date.now(), name: newGoalName, target, current: 0 }];
    saveFinance({ ...data, goals: newGoals });
    setNewGoalName("");
    setNewGoalTarget("");
    setIsAddGoalModalOpen(false);
  };

  const promptDeleteGoal = (id) => {
    setGoalToDelete(id);
  }

  const confirmDeleteGoal = () => {
    if (!goalToDelete) return;
    const currentGoals = Array.isArray(data.goals) ? data.goals : [];
    const newGoals = currentGoals.filter(g => g.id !== goalToDelete);
    saveFinance({ ...data, goals: newGoals });
    setGoalToDelete(null);
  }

  const submitDeposit = (id) => {
    const amount = parseFloat(fundAmount);
    if (!amount) return;
    const currentGoals = Array.isArray(data.goals) ? data.goals : [];
    const newGoals = currentGoals.map(g => g.id === id ? { ...g, current: g.current + amount } : g);
    saveFinance({ ...data, goals: newGoals });
    setFundAmount("");
    setActiveFundId(null);
  }

  if (loading) return <div className="p-8 text-center text-slate-500"><Loader2 className="animate-spin mx-auto" /></div>;

  const totalSaved = (data.goals || []).reduce((acc, curr) => acc + curr.current, 0);
  const savingsRate = data.income > 0 ? Math.round((totalSaved / data.income) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4">
      {/* Add Goal Modal */}
      <Modal isOpen={isAddGoalModalOpen} onClose={() => setIsAddGoalModalOpen(false)} title="Add Financial Goal">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Goal Name</label>
            <input
              value={newGoalName} onChange={e => setNewGoalName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none placeholder-slate-600"
              placeholder="e.g. New Laptop"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Target Amount (₹)</label>
            <input
              type="number"
              value={newGoalTarget} onChange={e => setNewGoalTarget(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none placeholder-slate-600"
              placeholder="50000"
            />
          </div>
          <button
            onClick={addGoal}
            disabled={!newGoalName || !newGoalTarget}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all mt-2"
          >
            Create Goal
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!goalToDelete} onClose={() => setGoalToDelete(null)} title="Delete Goal">
        <div className="space-y-4">
          <p className="text-slate-300">Are you sure you want to delete this financial goal? This action cannot be undone and you will lose the progress tracked for this goal.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setGoalToDelete(null)}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteGoal}
              className="flex-1 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-500 font-medium transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><PieChart size={24} className="text-emerald-500" /> Financial Overview</h1>
          <p className="text-slate-400">Control your resources.</p>
        </div>
        <button onClick={analyzeFinances} disabled={analyzing} className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg hover:shadow-indigo-500/40 transition-all">
          {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />} Analyze
        </button>
      </div>

      {data.aiAdvice && (
        <div className="glass-card p-6 rounded-3xl animate-in fade-in border-indigo-500/20">
          <h3 className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">Advisor Insight</h3>
          <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-line mb-3">{data.aiAdvice}</p>
          <button
            onClick={() => onNavigateToCoach(`Here is my financial analysis:\n${data.aiAdvice}\n\nWhat specific steps should I take next?`)}
            className="text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 px-3 py-1.5 rounded-lg font-bold transition-colors"
          >
            Ask Coach
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl">
          <div className="text-slate-400 text-sm mb-1">Monthly Income</div>
          <div className="flex items-center text-emerald-400">
            <IndianRupee size={20} className="mr-2" />
            <input type="number" value={data.income || ''} onChange={(e) => saveFinance({ ...data, income: parseFloat(e.target.value) || 0 })} className="bg-transparent text-2xl font-bold text-white w-full border-none focus:ring-0 outline-none" placeholder="0" />
          </div>
        </div>
        <div className="glass-panel p-6 rounded-2xl">
          <div className="text-slate-400 text-sm mb-1">Budget Limit</div>
          <div className="flex items-center text-indigo-400">
            <IndianRupee size={20} className="mr-2" />
            <input type="number" value={data.budget || ''} onChange={(e) => saveFinance({ ...data, budget: parseFloat(e.target.value) || 0 })} className="bg-transparent text-2xl font-bold text-white w-full border-none focus:ring-0 outline-none" placeholder="0" />
          </div>
        </div>
        <div className="glass-panel p-6 rounded-2xl">
          <div className="text-slate-400 text-sm mb-1">Total Saved</div>
          <div className="flex items-center text-2xl font-bold text-white">
            <IndianRupee size={20} className="mr-2" />
            {totalSaved.toLocaleString()}
            <span className="text-sm font-normal text-slate-500 ml-2">({savingsRate}%)</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-8 border-t border-white/5">
        <h3 className="text-xl font-bold text-white flex items-center gap-2"><TrendingUp className="text-indigo-500" size={20} /> Goals & Allocations</h3>
        <button onClick={() => setIsAddGoalModalOpen(true)} className="text-sm bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus size={16} /> Add Goal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(data.goals || []).map(g => (
          <div key={g.id} className="glass-card p-6 rounded-3xl hover:border-emerald-500/30 transition-colors group">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-white flex items-center gap-2 truncate">
                {g.name}
              </h3>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => promptDeleteGoal(g.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={16} /></button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-end gap-1">
                <span className="text-lg font-bold text-emerald-400 flex items-center"><IndianRupee size={14} /> {g.current.toLocaleString()}</span>
                <span className="text-xs text-slate-500 mb-1 flex items-center">/ <IndianRupee size={10} /> {g.target.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${Math.min((g.current / g.target) * 100, 100)}%` }} />
              </div>

              {activeFundId === g.id ? (
                <div className="flex items-center gap-2 mt-4 animate-in fade-in">
                  <div className="flex-1 bg-slate-800 rounded-lg flex items-center px-3 border border-indigo-500/50">
                    <IndianRupee size={14} className="text-slate-400" />
                    <input
                      autoFocus
                      type="number"
                      value={fundAmount}
                      onChange={e => setFundAmount(e.target.value)}
                      className="bg-transparent w-full py-2 px-1 text-white text-sm outline-none"
                      placeholder="Amount"
                      onKeyDown={e => e.key === 'Enter' && submitDeposit(g.id)}
                    />
                  </div>
                  <button onClick={() => submitDeposit(g.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg"><Check size={16} /></button>
                  <button onClick={() => setActiveFundId(null)} className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg"><X size={16} /></button>
                </div>
              ) : (
                <button onClick={() => setActiveFundId(g.id)} className="w-full py-2 bg-slate-800 text-emerald-400 border border-emerald-500/20 rounded-lg text-sm font-bold hover:bg-emerald-500/10 flex items-center justify-center gap-2">
                  <IndianRupee size={14} /> Deposit Funds
                </button>
              )}
            </div>
          </div>
        ))}
        {(data.goals || []).length === 0 && !isAddGoalModalOpen && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
            <Coins size={32} className="mx-auto mb-3 opacity-50" />
            <p>No financial goals set. Add one to start tracking.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// 9. Squad Screen
const SquadScreen = ({ user, profile, addToast }) => {
  const [joinId, setJoinId] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [joinError, setJoinError] = useState('');

  const computeScore = (m) => (typeof m.score === 'number' ? m.score : ((m.level || 1) * 1000 + (m.currentXP || 0)));

  useEffect(() => {
    if (!profile?.groupId) return;
    setLoading(true);
    const profilesRef = collection(db, 'artifacts', appId, 'public', 'data', 'profiles');
    const unsubscribe = onSnapshot(profilesRef, (snap) => {
      const groupMembers = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (data.groupId === profile.groupId) {
          groupMembers.push({ id: doc.id, ...data });
        }
      });
      groupMembers.sort((a, b) => computeScore(b) - computeScore(a));
      setMembers(groupMembers);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profile?.groupId]);

  const createGroup = async () => {
    const newGroupId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const publicProfileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
    const privateProfileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');

    await setDoc(publicProfileRef, { groupId: newGroupId }, { merge: true });
    await setDoc(privateProfileRef, { groupId: newGroupId }, { merge: true });
  };

  const joinGroup = async () => {
    setJoinError(''); // Clear previous errors
    const normalized = joinId.trim().toUpperCase();

    if (!normalized) {
      setJoinError('Please enter a group code.');
      addToast && addToast('Please enter a group code.', 'error');
      return;
    }

    setJoiningGroup(true);
    try {
      // 1. Verify existence of the squad by checking if any public profiles have this groupId
      const profilesRef = collection(db, 'artifacts', appId, 'public', 'data', 'profiles');
      const q = query(profilesRef, where('groupId', '==', normalized), limit(1));
      const snap = await getDocs(q);

      if (snap.empty) {
        setJoinError(`❌ No squad found with code "${normalized}". Check the ID or create a new squad.`);
        addToast && addToast('Squad not found.', 'error');
        return;
      }

      // 2. Proceed to join
      const publicProfileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
      const privateProfileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');

      // Batch write for consistency
      const batch = writeBatch(db);
      batch.set(publicProfileRef, { groupId: normalized }, { merge: true });
      batch.set(privateProfileRef, { groupId: normalized }, { merge: true });
      await batch.commit();

      setJoinId('');
      setJoinError('');
      addToast && addToast('Successfully joined squad ' + normalized + '! 🎉', 'success');
    } catch (error) {
      console.error("Join error:", error);
      setJoinError('Failed to join. Please try again.');
      addToast && addToast('Error joining group.', 'error');
    } finally {
      setJoiningGroup(false);
    }
  };

  const leaveGroup = async () => {
    const publicProfileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
    const privateProfileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    await setDoc(publicProfileRef, { groupId: null }, { merge: true });
    await setDoc(privateProfileRef, { groupId: null }, { merge: true });
    setShowLeaveConfirm(false);
  };

  if (!profile?.groupId) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 py-12">
        <div className="text-center">
          <Users size={64} className="mx-auto text-indigo-500 mb-4" />
          <h2 className="text-2xl font-bold text-white">Join a Transformation Squad</h2>
          <p className="text-slate-400 mt-2">Everything is easier with friends. Create a group or join an existing one.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center hover:border-indigo-500/30 transition-colors">
            <h3 className="text-lg font-bold text-white mb-4">Start a New Group</h3>
            <button onClick={createGroup} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-medium w-full transition-all">
              Create Group
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center hover:border-indigo-500/30 transition-colors">
            <h3 className="text-lg font-bold text-white mb-4">Join Existing Group</h3>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Enter Code"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && joinGroup()}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-center uppercase tracking-widest outline-none focus:border-indigo-500"
              />
              <button
                onClick={joinGroup}
                disabled={joiningGroup || !joinId.trim()}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-6 py-2 rounded-xl font-medium w-full border border-slate-700 transition-all flex items-center justify-center gap-2"
              >
                {joiningGroup ? <><Loader2 size={16} className="animate-spin" /> Joining...</> : 'Join Group'}
              </button>
            </div>
            {joinError && (
              <div className="mt-4 p-3 bg-red-950/50 border border-red-500/50 rounded-lg animate-in slide-in-from-top-2">
                <p className="text-xs text-red-300">{joinError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-12">
      {/* Leave Confirmation Modal */}
      <Modal isOpen={showLeaveConfirm} onClose={() => setShowLeaveConfirm(false)} title="Leave Squad">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <LogOut size={32} className="text-red-500" />
          </div>
          <p className="text-slate-300">
            Are you sure you want to leave this squad? You won't be able to see the leaderboard anymore.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setShowLeaveConfirm(false)} className="flex-1 py-3 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-medium">Cancel</button>
            <button onClick={leaveGroup} className="flex-1 py-3 rounded-xl bg-red-600 text-white hover:bg-red-500 font-medium">Leave Squad</button>
          </div>
        </div>
      </Modal>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 glass-card border-indigo-500/30 p-6 rounded-3xl">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="text-indigo-400" /> Squad Leaderboard
          </h2>
          <p className="text-zinc-400 mt-1">Group Code: <span className="font-mono text-white font-bold bg-white/10 px-2 py-0.5 rounded ml-1 select-all border border-white/10">{profile.groupId}</span></p>
        </div>
        <button onClick={() => setShowLeaveConfirm(true)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20 transition-colors hover:bg-red-500/20">
          <LogOut size={12} /> Leave
        </button>
      </div>

      <div className="glass-card rounded-3xl overflow-hidden text-left">
        {members.map((member, i) => (
          <div key={member.id} className={`flex items-center p-4 border-b border-white/5 last:border-0 transition-colors ${member.id === user.uid ? 'bg-indigo-500/10' : ''}`}>
            <div className="w-8 font-bold text-slate-500 flex justify-center">
              {i === 0 ? <Crown size={20} className="text-amber-400" /> : `#${i + 1}`}
            </div>
            <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mr-4 ml-4">
              <UserCircle size={20} className="text-slate-400" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white flex items-center gap-2">{member.displayName} {member.id === user.uid && <span className="text-[10px] bg-indigo-500 text-white px-1.5 rounded">YOU</span>}</div>
              <div className="text-xs text-slate-500">{member.mainGoal || 'No goal set'} • Lvl {member.level || 1}</div>
            </div>
            <div className="font-mono text-amber-400 font-bold">{computeScore(member)} XP</div>
          </div>
        ))}
        {members.length === 0 && <div className="p-8 text-center text-slate-500">Summoning squad details...</div>}
      </div>
    </div>
  );
};

// 10. AI Coach (Now respects Tone & Context)
// 10. AI Coach (Now respects Tone & Context + Smart Persistence)
const AICoachScreen = ({ user, profile, initialContext }) => {
  const aiTone = profile?.preferences?.aiTone || 'calm';
  const initialMsg = { role: 'assistant', text: "I'm here to help you think clearly. What's on your mind? No judgement, just strategy." };

  const [messages, setMessages] = useState([initialMsg]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef(null);
  const hasProcessedContext = useRef(false);

  // Firestore Ref
  const historyRef = useMemo(() => doc(db, 'artifacts', appId, 'users', user.uid, 'ai_coach', 'history'), [user.uid]);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  // Load History
  useEffect(() => {
    const unsub = onSnapshot(historyRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages);
        }
      }
    });
    return () => unsub();
  }, [historyRef]);

  // Auto-send context if it exists
  useEffect(() => {
    if (initialContext && !hasProcessedContext.current) {
      hasProcessedContext.current = true;
      setInput(""); // Clear input immediately
      handleAutoSend(initialContext);
    }
  }, [initialContext]);

  const handleAutoSend = async (text) => {
    const newMsg = { role: 'user', text };
    // Optimistic update handled by Firestore listener, but we need local state for immediate API call
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setTyping(true);
    await fetchResponse(text, updatedMessages);
  };

  const send = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput("");
    const newMsg = { role: 'user', text };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setTyping(true);
    await fetchResponse(text, updatedMessages);
  };

  const saveToHistory = async (newMessages) => {
    await setDoc(historyRef, { messages: newMessages }, { merge: true });
  }

  const checkAndSummarize = async (currentMessages) => {
    // Limit: Keep last 20 messages active
    if (currentMessages.length > 20) {
      const msgsToSummarize = currentMessages.slice(0, 10);
      const msgsToKeep = currentMessages.slice(10);

      const historyText = msgsToSummarize.map(m => `${m.role}: ${m.text}`).join('\n');
      const prompt = `Summarize the key points, user goals, and advice from this conversation history into a concise paragraph. \n\nHistory:\n${historyText}`;

      try {
        const summary = await callGemini(prompt, "You are a helpful assistant summarizing conversation history.");
        const systemMsg = { role: 'system', text: `📝 **Previous Context Summary:**\n${summary}` };
        return [systemMsg, ...msgsToKeep];
      } catch (e) {
        console.error("Summarization failed", e);
        return currentMessages; // Fallback
      }
    }
    return currentMessages;
  };

  const fetchResponse = async (userText, currentHistory) => {
    try {
      const history = currentHistory.slice(-10).map(m => `${m.role}: ${m.text}`).join('\n');
      const prompt = `${history}\nuser: ${userText}\nassistant:`;

      let system = "You are a world-class growth coach.";
      if (aiTone === 'calm') system += " Tone: Calm, encouraging, peaceful, reassuring. Like a wise monk.";
      if (aiTone === 'tough') system += " Tone: Tough-love, drill instructor, demanding, punchy. No excuses.";
      if (aiTone === 'analytical') system += " Tone: Analytical, logical, data-driven, strategic. Like a scientist.";
      else system += " Tone: Friendly, helpful, concise.";

      const res = await callGemini(prompt, system);
      const assistantMsg = { role: 'assistant', text: res };

      let finalMessages = [...currentHistory, assistantMsg];

      // Check for summarization
      finalMessages = await checkAndSummarize(finalMessages);

      // Save to Firestore
      await saveToHistory(finalMessages);
      setMessages(finalMessages); // Optimistic update


    } catch (e) {
      console.error('Coach error:', e);
      if (e.message && e.message.includes('Gemini API key')) {
        addToast('AI not configured. Set VITE_GEMINI_KEY to enable the coach.', 'error');
      }

      let errorMessage = "My connection is weak. Let's try that again.";
      if (e.message && e.message.includes('API Error')) {
        errorMessage = "I'm having trouble thinking clearly (API Error). Please try again.";
      } else if (e.message && e.message.includes('Auth')) {
        errorMessage = "Please sign in to save our conversation.";
      }

      setMessages(prev => [...prev, { role: 'assistant', text: errorMessage + `\n(Debug: ${e.message})\n(Key: ${apiKey ? 'Yes' : 'No'}, Proxy: ${import.meta.env.VITE_GEMINI_USE_PROXY || 'false'})` }]);
    } finally { setTyping(false); }
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col max-w-3xl mx-auto px-4">
      <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : m.role === 'system' ? 'justify-center' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-500`}>
            {m.role === 'system' ? (
              <div className="max-w-[85%] text-xs text-zinc-500 italic text-center bg-zinc-900/50 border border-zinc-800 px-4 py-2 rounded-xl">
                {m.text}
              </div>
            ) : (
              <div className={`max-w-[85%] p-5 rounded-3xl text-base leading-relaxed whitespace-pre-line shadow-lg ${m.role === 'user'
                ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-sm shadow-indigo-900/20'
                : 'glass-card rounded-bl-sm text-zinc-100'
                }`}>
                {m.text}
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div className="flex items-center gap-2 text-zinc-500 text-sm pl-4 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span className="w-2 h-2 rounded-full bg-indigo-500 delay-75"></span>
            <span className="w-2 h-2 rounded-full bg-indigo-500 delay-150"></span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-4 relative group pb-4">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 rounded-3xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Ask your coach anything..."
          rows={1}
          className="relative w-full glass-card bg-black/40 hover:bg-black/60 focus:bg-black/80 rounded-3xl pl-6 pr-14 py-5 text-white focus:outline-none transition-all resize-none shadow-xl placeholder-zinc-600 border-white/5 focus:border-indigo-500/50"
        />
        <button onClick={send} disabled={!input.trim() || typing} className="absolute right-4 top-[22px] -translate-y-1/2 p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-0 disabled:scale-75 transition-all shadow-lg shadow-indigo-900/30">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

// 11. Data Migration Component
const DataMigration = ({ user, currentAppId, onMigrationComplete }) => {
  const [legacyFound, setLegacyFound] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrated, setMigrated] = useState(false);
  const [debugLog, setDebugLog] = useState(["Init Migration check..."]);
  // const [debugLog, setDebugLog] = useState(["Init Migration check..."]); // Removed debugLog

  // The ID where data was previously stored
  const LEGACY_APP_ID = 'default-app-id';

  useEffect(() => {
    if (!user || migrated || currentAppId === LEGACY_APP_ID) return;

    const checkLegacy = async () => {
      try {
        // Check if data exists in NEW location
        const newProfileRef = doc(db, 'artifacts', currentAppId, 'users', user.uid, 'profile', 'info');
        const newProfileDoc = await getDoc(newProfileRef);

        // If user is already migrated, stop.
        if (newProfileDoc.exists() && newProfileDoc.data().migrated === true) {
          return;
        }

        // Check if LEGACY data exists
        const oldProfileRef = doc(db, 'artifacts', LEGACY_APP_ID, 'users', user.uid, 'profile', 'info');
        const oldProfileSnap = await getDoc(oldProfileRef);

        if (oldProfileSnap.exists()) {
          console.log("Legacy data found!");
          setLegacyFound(true);
        }
      } catch (e) {
        console.error("Error checking legacy data:", e);
      }
    };

    checkLegacy();
  }, [user, currentAppId, migrated]);

  const performMigration = async () => {
    setMigrating(true);
    try {
      const batch = writeBatch(db);
      const uid = user.uid;

      // Helper to copy a doc
      const copyDoc = async (cat, name) => {
        const fromRef = doc(db, 'artifacts', LEGACY_APP_ID, 'users', uid, cat, name);
        const toRef = doc(db, 'artifacts', currentAppId, 'users', uid, cat, name);
        const snap = await getDoc(fromRef);
        if (snap.exists()) {
          // If copying profile info, mark as migrated
          const data = snap.data();
          if (cat === 'profile' && name === 'info') {
            data.migrated = true;
          }
          batch.set(toRef, data);
          return true;
        }
        return false;
      };

      // 1. Profile (will be marked migrated=true)
      await copyDoc('profile', 'info');

      // 2. Stats
      await copyDoc('gamification', 'stats');

      // 3. Sleep Status
      await copyDoc('globals', 'sleep_status');

      // 4. Monthly Data (Last 6 months just in case)
      const now = new Date();
      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const dateId = formatDateId(d);
        await copyDoc('monthly_data', dateId);
      }

      await batch.commit();

      setLegacyFound(false);
      setMigrated(true);
      if (onMigrationComplete) onMigrationComplete();

      // Force reload to pick up new data cleanly or just let listeners handle it
      window.location.reload();

    } catch (e) {
      console.error("Migration failed:", e);
      alert("Migration failed: " + e.message);
    } finally {
      setMigrating(false);
    }
  };

  // DEBUG OVERLAY
  if (!legacyFound) return null;

  // Actual UI if found...

  return (
    <Modal isOpen={true} onClose={() => { }} title="Restore Account Data">
      <div className="space-y-4">
        <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/30 flex items-start gap-3">
          <div className="bg-indigo-500 rounded-full p-1 mt-1 shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h4 className="font-bold text-white">Previous Account Detected</h4>
            <p className="text-sm text-slate-300 mt-1">
              We found your progress (XP, Streak, Habits) from the previous version. Would you like to restore it?
            </p>
          </div>
        </div>

        <button
          onClick={performMigration}
          disabled={migrating}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/40"
        >
          {migrating ? <><Loader2 className="animate-spin" /> Restoring...</> : 'Restore My Data'}
        </button>
      </div>
    </Modal>
  );
};

// --- MAIN APP SHELL ---

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Navigation State
  const [currentScreen, setCurrentScreen] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Coach Handoff State
  const [coachContext, setCoachContext] = useState("");

  // Global Data
  const [habits, setHabits] = useState([]);
  const [dailyLogs, setDailyLogs] = useState({});
  const [stats, setStats] = useState({ level: 1, currentXP: 0, nextLevelXP: 100, streak: 0, bestStreak: 0, gold: 0 });
  const [sleepStatus, setSleepStatus] = useState({ isSleeping: false, startTime: null });

  // Init
  // Init: Listen for Auth State Changes (Remember Me)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      // If no user is found, we are done checking auth -> Show Login
      // If user IS found, the data fetching effect will handle turning off loading
      if (!u) setLoading(false);
    });
    return () => unsub();
  }, []);

  // Data Fetching
  useEffect(() => {
    if (!user) return;
    const docId = formatDateId(currentDate);

    // 1. Profile
    const unsubProfile = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), s => {
      setProfile(s.data());
    });

    // 2. Monthly Data (Habits & Logs)
    const unsubMonth = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'monthly_data', docId), s => {
      const data = s.data() || {};
      setHabits(data.habits || []);
      setDailyLogs(data.daily_logs || {});
    });

    // 3. Stats
    const unsubStats = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'gamification', 'stats'), s => {
      setStats(s.data() || { level: 1, currentXP: 0, nextLevelXP: 100, streak: 0, bestStreak: 0, gold: 0 });
    });

    // 4. Sleep Global
    const unsubSleep = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'globals', 'sleep_status'), s => {
      setSleepStatus(s.data() || { isSleeping: false, startTime: null });
    });

    setLoading(false);
    return () => { unsubProfile(); unsubMonth(); unsubStats(); unsubSleep(); };
  }, [user, currentDate]);

  const formatAuthError = (e) => {
    const code = e?.code || '';
    // Bug 3: Friendly error mapping
    const mapping = {
      'auth/user-not-found': 'No user found. Create an account.',
      'auth/wrong-password': 'Please check the password.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/email-already-in-use': 'Account already exists. Try signing in.',
      'auth/weak-password': 'Password is too weak. Use at least 6 chars.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/network-request-failed': 'Network error. Check your connection.',
      'auth/too-many-requests': 'Too many attempts. Reset password or try later.'
    };

    return mapping[code] || e?.message || 'Authentication error. Please try again.';
  };

  // Persistance Handlers
  const handleAuthLogin = async (formData, isLogin) => {
    try {
      // 1. Ensure an auth user: prefer email/password flows, but fall back to anonymous when no email provided
      if (isLogin) {
        // Sign in with email/password
        try {
          await signInWithEmailAndPassword(auth, formData.email, formData.password);
        } catch (e) {
          const errorMsg = formatAuthError(e);
          addToast(errorMsg, 'error');
          throw new Error(errorMsg);
        }
      } else {
        // Sign up path: if currently anonymous, link the anonymous account to an email credential so data persists
        if (auth.currentUser && auth.currentUser.isAnonymous) {
          try {
            const credential = EmailAuthProvider.credential(formData.email, formData.password);
            await linkWithCredential(auth.currentUser, credential);
            // ensure profile exists for new linked account
            const userId = auth.currentUser.uid;
            const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'info');
            const profileData = { name: formData.name, mainGoal: formData.mainGoal || 'Personal Growth' };
            await setDoc(profileRef, profileData, { merge: true });
          } catch (e) {
            const errorMsg = formatAuthError(e);
            addToast(errorMsg, 'error');
            throw new Error(errorMsg);
          }
        } else {
          // Create new account
          try {
            await createUserWithEmailAndPassword(auth, formData.email, formData.password);
          } catch (e) {
            const errorMsg = formatAuthError(e);
            addToast(errorMsg, 'error');
            throw new Error(errorMsg);
          }
        }
      }

      // Fallback: if no auth user (e.g., when env provides an initial token), sign in via provided token or anonymously
      if (!auth.currentUser) {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      }

      if (!auth.currentUser) {
        throw new Error("Auth failed");
      }

      const userId = auth.currentUser.uid;
      const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'info');
      const publicProfileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', userId);

      // Bug 4 Fix: Don't overwrite profile on Sign In
      if (!isLogin) {
        const profileData = {
          name: formData.name,
          mainGoal: formData.mainGoal || "Personal Growth"
        };
        await setDoc(profileRef, profileData, { merge: true });

        // Init public profile too for leaderboards
        try {
          await setDoc(publicProfileRef, {
            displayName: formData.name,
            mainGoal: formData.mainGoal || "Personal Growth",
            level: 1,
            currentXP: 0,
            score: 1000
          }, { merge: true });
        } catch (e) {
          console.warn("Public profile write restricted", e);
        }
      }
      // For Login, we trust the existing profile data fetched via onSnapshot

    } catch (error) {
      console.error("Auth error:", error);
      // Re-throw so AuthScreen can show the error inline
      throw error;
    }
  };

  const handleProfileUpdate = async (data) => {
    if (!user) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    const publicProfileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
    await setDoc(profileRef, data, { merge: true });
    try {
      // Always sync name and goal to public profile
      const publicData = {
        displayName: data.name,
        mainGoal: data.mainGoal,
        // Preserve existing stats if present
        ...data
      };
      await setDoc(publicProfileRef, publicData, { merge: true });
    } catch (e) { console.warn("Public update restricted", e); }
    addToast('Profile updated', 'success');
  }

  const saveHabits = async (newHabits) => {
    setHabits(newHabits); // Optimistic
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'monthly_data', formatDateId(currentDate));
    await setDoc(docRef, { habits: newHabits }, { merge: true });
  }

  const saveDailyLog = async (day, log) => {
    const newLogs = { ...dailyLogs, [day]: log };
    setDailyLogs(newLogs);
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'monthly_data', formatDateId(currentDate));
    await setDoc(docRef, { daily_logs: newLogs }, { merge: true });
  }

  const updateStats = async (newStats) => {
    let s = { ...stats, ...newStats };

    // Update Best Streak Logic
    if (s.streak > (s.bestStreak || 0)) {
      s.bestStreak = s.streak;
    }
    // Level Up Logic
    let leveledUp = false;
    if (s.currentXP >= s.nextLevelXP) {
      s.currentXP -= s.nextLevelXP;
      s.level += 1;
      s.nextLevelXP = Math.floor(s.nextLevelXP * 1.5);
      leveledUp = true;
    }

    // Level Down Logic (Undo Level Up)
    if (s.currentXP < 0 && s.level > 1) {
      s.level -= 1;
      // Reverse the nextLevelXP calculation: previous was current / 1.5
      // But simpler: just set currentXP to (previousMax - 10) roughly, 
      // or better: exact reverse. 
      // Since nextLevelXP scales by 1.5, previous max was nextLevelXP / 1.5.
      // Let's approximate for safety or store previous max? 
      // Simplest: currentXP becomes previousLevelXP + currentXP (which is negative).

      s.nextLevelXP = Math.ceil(s.nextLevelXP / 1.5);
      s.currentXP = s.nextLevelXP + s.currentXP; // currentXP is negative, so this subtracts it from max
    } else if (s.currentXP < 0) {
      s.currentXP = 0; // Cap at 0 if level 1
    }

    setStats(s); // Optimistic Update

    // Notifications
    const prefs = profile?.preferences || {};
    if (prefs.enableNotifications) {
      if (leveledUp) {
        sendGamifiedNotification("Apex Level Up! 🚀", `You've reached Level ${s.level}. Keep climbing.`);
      }
      // Streak Notification: Check if streak INCREASED from previous state
      if (s.streak > stats.streak) {
        sendGamifiedNotification("Streak Ignited 🔥", `You're on a ${s.streak} day streak. Unstoppable.`);
      }
    }

    // Bug 1 Fix: Atomic updates to prevent drift
    const batch = writeBatch(db);

    // 1. Private Stats
    const statsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'gamification', 'stats');
    batch.set(statsRef, s, { merge: true });

    // 2. Public Leaderboard Score
    // Single source of truth is now totalXP if available, else legacy formula
    // We already passed totalXP in newStats if it was provided
    const score = s.totalXP !== undefined ? s.totalXP : ((s.level * 1000) + s.currentXP);

    const publicRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
    const publicData = {
      level: s.level,
      currentXP: s.currentXP,
      nextLevelXP: s.nextLevelXP,
      score: score,
      // Ensure display name is synced if available
      displayName: profile?.name || 'Player',
      mainGoal: profile?.mainGoal || 'Personal Growth'
    };
    batch.set(publicRef, publicData, { merge: true });

    try {
      await batch.commit();
    } catch (e) {
      // Revert optimistic update? Or just warn.
      addToast("Sync failed. Check connection.", "error");
    }
  }

  // Helper: Notification System
  const sendGamifiedNotification = (title, body) => {
    // 1. In-App Toast
    addToast(`${title} - ${body}`, 'success', 6000);

    // 2. Browser Notification
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: "/apex-logo.jpg" });
      } catch (e) {
        console.error("Notification failed:", e);
      }
    }
  };

  // Helper: Calculate Streak (Current Month Only for now)
  const calculateCurrentStreak = (currentHabits) => {
    const today = new Date();
    const todayDay = today.getDate();

    // Debug log to trace streak logic
    // console.log("Calculating Streak. Today:", todayDay);

    // Check if any habit completed Today
    const workedToday = currentHabits.some(h => h.completed.includes(todayDay));

    // Check Yesterday
    const yesterday = todayDay - 1;
    let streak = 0;

    // Strict Reset Logic:
    // If we didn't work today AND didn't work yesterday, streak is broken -> 0.
    // (Unless today is the 1st, handled by startDay < 1 check for now)
    const workedYesterday = yesterday > 0 && currentHabits.some(h => h.completed.includes(yesterday));

    if (!workedToday && !workedYesterday) {
      // console.log("Streak Reset: No activity for 48h.");
      return 0;
    }

    let startDay = workedToday ? todayDay : yesterday;

    // If yesterday (when startDay is yesterday) is 0 or less, we can't check previous month in this version
    if (startDay < 1) return 0;

    // Check consistency from startDay backwards
    for (let d = startDay; d >= 1; d--) {
      const anyDone = currentHabits.some(h => h.completed.includes(d));
      if (!anyDone) break;
      streak++;
    }
    return streak;
  };

  const handleSleepToggle = async () => {
    const now = Date.now();
    if (sleepStatus.isSleeping) {
      // Wake up logic
      const mins = (now - sleepStatus.startTime) / 60000;
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'globals', 'sleep_status'), { isSleeping: false, startTime: null });

      // Log sleep to today
      const day = new Date().getDate();
      const existing = dailyLogs[day] || {};
      await saveDailyLog(day, { ...existing, sleepDuration: mins });
    } else {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'globals', 'sleep_status'), { isSleeping: true, startTime: now });
    }
  }

  // Recalculate streak on habits load (Self-healing)
  useEffect(() => {
    if (habits.length > 0 && user) {
      const correctStreak = calculateCurrentStreak(habits);
      if (correctStreak !== stats.streak) {
        console.log("Healing streak:", correctStreak);
        updateStats({ streak: correctStreak });
      }
    }
  }, [habits, user]); // Run when habits or user changes

  const handleCoachHandoff = (context) => {
    setCoachContext(context);
    setCurrentScreen('coach');
  }

  // Toasts and confirmation modal state
  const [toasts, setToasts] = useState([]);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeForm, setUpgradeForm] = useState({ email: '', password: '' });

  const addToast = (msg, type = 'info', duration = 4000) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  };

  const handleSignOut = () => {
    // Open confirmation modal; actual sign-out performed in performSignOut
    setConfirmSignOut(true);
  }

  const performSignOut = async () => {
    setConfirmSignOut(false);
    setLoading(true);
    try {
      await signOut(auth);
      // Clear local state to avoid stale data while auth updates
      setUser(null);
      setProfile(null);
      setHabits([]);
      setDailyLogs({});
      setStats({ level: 1, currentXP: 0, nextLevelXP: 100, streak: 0, bestStreak: 0, gold: 0 });
      setCurrentScreen('home');
      addToast('Signed out', 'success');
    } catch (err) {
      console.error('Sign out failed:', err);
      addToast('Sign out failed: ' + (err.message || err), 'error', 6000);
    } finally {
      setLoading(false);
    }
  }

  const performUpgradeLink = async () => {
    if (!auth.currentUser || !auth.currentUser.isAnonymous) {
      addToast('No anonymous session to upgrade.', 'error');
      return;
    }
    if (!upgradeForm.email || !upgradeForm.password) {
      addToast('Provide email and password to upgrade.', 'error');
      return;
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(upgradeForm.email, upgradeForm.password);
      await linkWithCredential(auth.currentUser, credential);
      // Ensure profile is present for the linked account
      const userId = auth.currentUser.uid;
      const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'info');
      const publicProfileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', userId);
      const profileData = { name: profile?.name || upgradeForm.email.split('@')[0], mainGoal: profile?.mainGoal || 'Personal Growth' };
      await setDoc(profileRef, profileData, { merge: true });
      try { await setDoc(publicProfileRef, { displayName: profileData.name, mainGoal: profileData.mainGoal }, { merge: true }); } catch (e) { }

      setShowUpgradeModal(false);
      addToast('Account upgraded. Your data is preserved.', 'success');
    } catch (err) {
      console.error('Upgrade failed:', err);
      addToast('Upgrade failed: ' + (err.message || err), 'error', 6000);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center font-bold text-emerald-500 animate-pulse">Loading Apex...</div>;

  // Show Auth Screen if no user OR if user exists but no profile (setup mode)
  if (!user || (user && !profile)) {
    return (
      <>
        {user && (
          <DataMigration
            user={user}
            currentAppId={appId}
            onMigrationComplete={() => addToast('Account restored successfully!', 'success')}
          />
        )}
        <AuthScreen onSubmit={handleAuthLogin} addToast={addToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 font-sans selection:bg-indigo-500/30 relative overflow-x-hidden">
      {/* Ambient Backgrounds */}
      <div className="ambient-blob bg-violet-600/20 w-96 h-96 top-0 left-0 blur-[120px]"></div>
      <div className="ambient-blob bg-indigo-500/20 w-[500px] h-[500px] bottom-0 right-0 blur-[120px]" style={{ animationDelay: '-5s' }}></div>

      {auth?.currentUser?.isAnonymous && (
        <div className="bg-amber-600/10 border-b border-amber-700 text-amber-300 p-3 text-sm flex items-center justify-between">
          <span>You are using an anonymous account. <strong className="ml-2">Upgrade</strong> to an email account to keep your data across devices.</span>
          <div className="flex gap-2">
            <button onClick={() => setShowUpgradeModal(true)} className="text-sm px-3 py-1 rounded bg-amber-500 text-black font-medium">Upgrade</button>
            <button onClick={() => addToast('Anonymous accounts are temporary. Upgrade to keep data.', 'info')} className="text-sm px-3 py-1 rounded bg-slate-800 text-amber-300">Dismiss</button>
          </div>
        </div>
      )}

      {/* Confirmation modal for sign-out */}
      {confirmSignOut && (
        <Modal isOpen={confirmSignOut} onClose={() => setConfirmSignOut(false)} title="Confirm Sign Out">
          <div className="p-4">
            <p className="text-sm text-slate-300">Are you sure you want to sign out?</p>
            {auth?.currentUser?.isAnonymous && (
              <p className="mt-2 text-xs text-amber-300">Note: you're using an anonymous session. Signing out without upgrading will create a new anonymous user on next login and your current data may not be linked.</p>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setConfirmSignOut(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700">Cancel</button>
              {auth?.currentUser?.isAnonymous && (
                <button onClick={() => { setShowUpgradeModal(true); setConfirmSignOut(false); }} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500">Upgrade Account</button>
              )}
              <button onClick={performSignOut} className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-500">Sign Out</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Upgrade modal */}
      {showUpgradeModal && (
        <Modal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} title="Upgrade Account">
          <div className="p-4">
            <p className="text-sm text-slate-300">Provide an email and password to convert your anonymous session into a permanent account and keep your data.</p>
            <div className="mt-4 space-y-3">
              <input type="email" placeholder="you@example.com" value={upgradeForm.email} onChange={e => setUpgradeForm(prev => ({ ...prev, email: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white" />
              <input type="password" placeholder="Password" value={upgradeForm.password} onChange={e => setUpgradeForm(prev => ({ ...prev, password: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white" />
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setShowUpgradeModal(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700">Cancel</button>
              <button onClick={performUpgradeLink} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500">Upgrade Account</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[200] space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`max-w-sm px-4 py-2 rounded shadow ${t.type === 'success' ? 'bg-emerald-400 text-black' : t.type === 'error' ? 'bg-rose-500 text-black' : 'bg-slate-800 text-white'}`}>
            {t.msg}
          </div>
        ))}
      </div>

      {sleepStatus.isSleeping && <SleepMode startTime={sleepStatus.startTime} onWakeUp={handleSleepToggle} />}

      <Sidebar
        currentScreen={currentScreen}
        setScreen={setCurrentScreen}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        user={user}
        profile={profile}
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <AIPlanner
        isOpen={plannerOpen}
        onClose={() => setPlannerOpen(false)}
        onAddHabit={(name) => {
          saveHabits([...habits, { id: Date.now().toString(), name, completed: [] }]);
        }}
      />

      <DataMigration
        user={user}
        currentAppId={appId}
        onMigrationComplete={() => addToast('Account restored successfully!', 'success')}
      />

      {/* Main Content Area */}
      <div className={`transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} min-h-screen flex flex-col`}>
        {/* Mobile Header Trigger */}
        <div className="md:hidden p-4 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-400 hover:text-white"><Menu /></button>
          <span className="font-bold text-white">Apex</span>
          <div className="w-8" />
        </div>

        <div className="flex-1 p-4 md:p-8 lg:p-12 overflow-x-hidden">
          {currentScreen === 'home' && (
            <HomeScreen
              user={user}
              profile={profile}
              date={currentDate}
              habits={habits}
              setHabits={saveHabits}
              dailyLogs={dailyLogs}
              saveDailyLog={saveDailyLog}
              stats={stats}
              updateStats={updateStats}
              sleepStatus={sleepStatus}
              onToggleSleep={handleSleepToggle}
              onOpenPlanner={() => setPlannerOpen(true)}
            />
          )}
          {currentScreen === 'monthly' && <MonthlyScreen date={currentDate} habits={habits} dailyLogs={dailyLogs} profile={profile} onNavigateToCoach={handleCoachHandoff} />}
          {currentScreen === 'coach' && <AICoachScreen user={user} profile={profile} initialContext={coachContext} />}
          {currentScreen === 'finance' && <FinanceScreen user={user} date={currentDate} onNavigateToCoach={handleCoachHandoff} />}
          {currentScreen === 'squad' && <SquadScreen user={user} profile={profile} />}
          {currentScreen === 'profile' && <ProfileScreen user={user} profile={profile} stats={stats} habits={habits} dailyLogs={dailyLogs} onUpdateProfile={handleProfileUpdate} onNavigateToCoach={handleCoachHandoff} onSignOut={handleSignOut} />}
        </div>
      </div>
    </div>
  );
}

const sendGamifiedNotification = (title, body) => {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: '/apex-logo.jpg',
      badge: '/apex-logo.jpg',
      silent: false
    });
  }
};

export default App;