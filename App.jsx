import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot
} from 'firebase/firestore';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Check, 
  Target, 
  Wallet, 
  TrendingUp, 
  Activity,
  Layout,
  List,
  MessageSquare,
  Smile,
  Calendar,
  Sparkles,
  Bot,
  Zap,
  X,
  Loader2,
  Quote,
  Moon,
  Sun,
  PieChart,
  FileText,
  AlertTriangle,
  Send,
  User,
  Trophy,
  Heart,
  Coins,
  Brain,
  Lightbulb,
  TestTube,
  Edit3,
  Users,
  Crown,
  LogOut,
  Clock
} from 'lucide-react';

// --- Firebase Configuration ---
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCTUqx_aFAuJ0i0E-fEZXDcB6gtXDMepmU",
  authDomain: "goal-tracker-40a6c.firebaseapp.com",
  projectId: "goal-tracker-40a6c",
  storageBucket: "goal-tracker-40a6c.firebasestorage.app",
  messagingSenderId: "600408134380",
  appId: "1:600408134380:web:f6d14984eb0df890dc4bc9",
  measurementId: "G-VX5KBJ12NR"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Gemini API Configuration ---
const apiKey = "AIzaSyBhZ3d371JTYCMbNGhWWYCk4sUe264HS3c"; 

const callGemini = async (prompt, systemInstruction = "") => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
  };

  let delay = 1000;
  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 429) throw new Error('Too Many Requests');
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    } catch (error) {
      if (i === 4) throw error; 
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
};

// --- Utility Functions ---
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

const formatDateId = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const getMonthName = (date) => {
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

const formatDuration = (minutes) => {
  if (!minutes) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
};

// --- Client-Side Pattern Analysis Engine (Fallback) ---
class ClientPatternAnalyzer {
  constructor(minDataPoints = 3) {
    this.minDataPoints = minDataPoints;
  }
  // (Simplified fallback logic remains here for offline use cases if needed)
  calculateCorrelation(x, y) {
    if (x.length !== y.length || x.length < 2) return 0;
    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }
    const denom = Math.sqrt(denomX * denomY);
    return denom === 0 ? 0 : numerator / denom;
  }

  analyze(dailyLogs, habits, currentYear, currentMonth, daysInMonth) {
    // Basic client-side logic
    const dataPoints = [];
    const moodMap = { '🔥': 5, '😊': 4, '😐': 3, '😤': 2, '😴': 2, '💩': 1 };
    
    for (let day = 1; day <= daysInMonth; day++) {
        const log = dailyLogs[day] || {};
        const completedCount = habits.filter(h => h.completed.includes(day)).length;
        const completionRate = habits.length > 0 ? completedCount / habits.length : 0;
        const date = new Date(currentYear, currentMonth, day);
        if (date > new Date()) continue;

        dataPoints.push({
            day,
            date,
            completionRate,
            sleep: log.sleepDuration || null,
            moodScore: moodMap[log.mood] || null
        });
    }

    const sleepData = dataPoints.filter(d => d.sleep !== null);
    let sleepInsight = null;
    if (sleepData.length >= this.minDataPoints) {
        const corr = this.calculateCorrelation(
            sleepData.map(d => d.sleep),
            sleepData.map(d => d.completionRate)
        );
        if (Math.abs(corr) > 0.3) {
            sleepInsight = {
                title: "Sleep Impact",
                finding: corr > 0 ? "Better sleep boosts your output" : "Sleep variability affects you",
                detail: corr > 0 ? "You complete +20% more habits when well rested." : "Low correlation, you grind regardless of sleep.",
                confidence: Math.round(Math.min(Math.abs(corr) * 1.5, 0.95) * 100),
            };
        }
    }
    return {
        insights: [sleepInsight].filter(Boolean),
        summary: `Analyzed ${dataPoints.length} days of data locally.`
    };
  }
}

// --- UI Components ---

function InsightsPanel({ report, onClose, loading }) {
  if (loading) {
    return (
      <div className="bg-slate-900 border border-violet-500/30 rounded-2xl p-8 mb-6 text-center animate-pulse">
         <Loader2 size={32} className="mx-auto text-violet-500 animate-spin mb-3" />
         <p className="text-slate-400">Consulting AI Engine...</p>
      </div>
    );
  }
  
  if (!report) return null;

  return (
    <div className="bg-slate-900 border border-violet-500/30 rounded-2xl p-6 mb-6 animate-in slide-in-from-top-4 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <Brain size={120} className="text-violet-500" />
      </div>
      
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="text-violet-400" size={20} />
                Behavioral Patterns
            </h3>
            <p className="text-slate-400 text-sm mt-1">AI-detected trends from your activity</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors">
            <X size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
        {report.insights.length === 0 ? (
            <div className="col-span-full py-8 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-dashed border-slate-800">
                <Lightbulb size={32} className="mx-auto mb-3 opacity-50" />
                <p>Not enough data yet. Keep tracking sleep and mood for 3+ days!</p>
                <p className="text-xs mt-2">{report.summary}</p>
            </div>
        ) : (
            report.insights.map((insight, idx) => (
                <div key={idx} className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl hover:border-violet-500/40 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-violet-400">{insight.title}</span>
                        <div className="bg-slate-900 px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 group-hover:text-violet-300 transition-colors">
                            {insight.confidence}% CONF
                        </div>
                    </div>
                    <h4 className="text-white font-medium mb-1">{insight.finding}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">{insight.detail}</p>
                </div>
            ))
        )}
      </div>
      
      <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 relative z-10">
         <span>{report.summary}</span>
         <span className="flex items-center gap-1">Powered by Python Pattern Engine <Bot size={12}/></span>
      </div>
    </div>
  );
}

function EditableText({ value, onSave, className }) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(value);

  const handleSave = () => {
    setIsEditing(false);
    if (text.trim() !== value) {
      onSave(text.trim());
    }
  };

  if (isEditing) {
    return (
      <div onClick={(e) => e.stopPropagation()} className="flex-1">
        <input
            autoFocus
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="bg-slate-950 border border-emerald-500 rounded px-2 py-1 text-white focus:outline-none w-full"
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 flex-1 min-w-0 ${className}`}>
      <span className="truncate">{value}</span>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
        className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
      >
        <Edit3 size={12} />
      </button>
    </div>
  );
}

function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-slate-800/50 p-4 border-b border-slate-700 flex justify-between items-center">
           <h3 className="text-lg font-bold text-white">{title}</h3>
           <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20}/></button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, itemName }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Deletion">
      <div className="space-y-4">
        <div className="flex items-center justify-center p-4 bg-red-500/10 rounded-full w-16 h-16 mx-auto">
            <AlertTriangle size={32} className="text-red-500" />
        </div>
        <p className="text-center text-slate-300">
           Are you sure you want to delete <span className="font-bold text-white">"{itemName}"</span>?<br/>
           This action cannot be undone.
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 font-medium">Delete</button>
        </div>
      </div>
    </Modal>
  );
}

function AIPlannerModal({ onClose, onAddHabit }) {
  const [goal, setGoal] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const generateHabits = async () => {
    if (!goal) return;
    setLoading(true);
    setSuggestions([]);

    try {
      const prompt = `Break down the goal "${goal}" into 3 specific, trackable daily habits (max 5 words each). Return ONLY a valid JSON array of strings. Example: ["Read 10 pages", "Run 1km"]. Do not include markdown code blocks.`;
      
      const response = await callGemini(prompt, "You are a helpful habit formation coach. Return strictly JSON.");
      
      const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const habits = JSON.parse(cleanJson);
      
      if (Array.isArray(habits)) {
        setSuggestions(habits);
      } else {
        alert("AI got confused. Try a simpler goal.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate habits. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 p-6 border-b border-slate-700 flex justify-between items-center">
           <h3 className="text-xl font-bold text-white flex items-center gap-2">
             <Sparkles className="text-yellow-400" /> AI Goal Planner
           </h3>
           <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24}/></button>
        </div>
        
        <div className="p-6 space-y-6">
          {!suggestions.length && !loading && (
             <div>
               <label className="block text-sm text-slate-300 mb-2">What is your big goal for 2026?</label>
               <div className="flex gap-2">
                 <input 
                   type="text" 
                   value={goal}
                   onChange={(e) => setGoal(e.target.value)}
                   placeholder="e.g. Become a Pro Coder, Run a Marathon..."
                   className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
                   onKeyDown={(e) => e.key === 'Enter' && generateHabits()}
                 />
                 <button 
                   onClick={generateHabits}
                   disabled={!goal}
                   className="bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-lg transition-colors disabled:opacity-50"
                 >
                   <Zap size={20} />
                 </button>
               </div>
               <p className="text-xs text-slate-500 mt-3">
                 We'll use Gemini AI to break this down into actionable daily habits.
               </p>
             </div>
          )}

          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-purple-400">
              <Loader2 size={40} className="animate-spin mb-4" />
              <p className="text-sm animate-pulse">Consulting the oracle...</p>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Here are 3 daily habits to reach your goal:</p>
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <span className="font-medium text-slate-200">{s}</span>
                  <button 
                    onClick={() => {
                        onAddHabit(s);
                        setSuggestions(suggestions.filter((_, idx) => idx !== i));
                    }}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              ))}
              <button 
                onClick={() => setSuggestions([])}
                className="w-full text-center text-slate-500 text-sm hover:text-white mt-4"
              >
                Try a different goal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthScreen({ onComplete }) {
  const [formData, setFormData] = useState({ name: '', age: '', mainGoal: '' });
  
  const handleSubmit = async () => {
    if (!formData.name) return alert("Name is required");
    await onComplete(formData);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="bg-gradient-to-tr from-emerald-500 to-teal-500 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-emerald-900/20">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to 2026</h1>
          <p className="text-slate-400">Let's set up your transformation profile.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">What should we call you?</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none transition-colors"
              placeholder="e.g. Charan"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Age</label>
            <input 
              type="number" 
              value={formData.age}
              onChange={e => setFormData({...formData, age: e.target.value})}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none transition-colors"
              placeholder="e.g. 20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Main Goal for 2026</label>
            <input 
              type="text" 
              value={formData.mainGoal}
              onChange={e => setFormData({...formData, mainGoal: e.target.value})}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none transition-colors"
              placeholder="e.g. Become a Full Stack Developer"
            />
          </div>
          <button 
            onClick={handleSubmit}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-900/20 mt-4"
          >
            Start My Journey
          </button>
        </div>
      </div>
    </div>
  );
}

function SocialDashboard({ user, profile }) {
  const [joinId, setJoinId] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

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
        groupMembers.sort((a, b) => (b.score || 0) - (a.score || 0));
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
    if (!joinId) return;
    const publicProfileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
    const privateProfileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    
    await setDoc(publicProfileRef, { groupId: joinId.toUpperCase() }, { merge: true });
    await setDoc(privateProfileRef, { groupId: joinId.toUpperCase() }, { merge: true });
  };

  const leaveGroup = async () => {
     const publicProfileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
     const privateProfileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
     await setDoc(publicProfileRef, { groupId: null }, { merge: true });
     await setDoc(privateProfileRef, { groupId: null }, { merge: true });
     setShowLeaveModal(false);
  };

  if (!profile.groupId) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
        <div className="text-center">
            <Users size={64} className="mx-auto text-indigo-500 mb-4" />
            <h2 className="text-2xl font-bold text-white">Join a Transformation Squad</h2>
            <p className="text-slate-400 mt-2">Everything is easier with friends. Create a group or join an existing one to compete on the leaderboard.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center">
                <h3 className="text-lg font-bold text-white mb-4">Start a New Group</h3>
                <button onClick={createGroup} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-medium w-full">
                    Create Group
                </button>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center">
                <h3 className="text-lg font-bold text-white mb-4">Join Existing Group</h3>
                <input 
                    type="text" 
                    placeholder="Enter Group Code"
                    value={joinId}
                    onChange={(e) => setJoinId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white mb-4 text-center uppercase tracking-widest"
                />
                <button onClick={joinGroup} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-xl font-medium w-full border border-slate-700">
                    Join Group
                </button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <Modal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} title="Leave Squad">
            <div className="space-y-4">
                <p className="text-center text-slate-300">Are you sure you want to leave your squad?</p>
                <div className="flex gap-3">
                    <button onClick={() => setShowLeaveModal(false)} className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-300">Cancel</button>
                    <button onClick={leaveGroup} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white">Leave</button>
                </div>
            </div>
        </Modal>

        <div className="flex justify-between items-center bg-indigo-900/20 border border-indigo-500/30 p-6 rounded-2xl">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Users className="text-indigo-400"/> Squad Leaderboard
                </h2>
                <p className="text-slate-400 mt-1">Group Code: <span className="font-mono text-white font-bold bg-slate-800 px-2 py-0.5 rounded ml-1 select-all">{profile.groupId}</span></p>
            </div>
            <div className="text-right">
                <button onClick={() => setShowLeaveModal(true)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><LogOut size={12}/> Leave Group</button>
            </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {members.map((member, idx) => (
                <div key={member.id} className={`flex items-center justify-between p-4 border-b border-slate-800 last:border-0 ${member.id === user.uid ? 'bg-indigo-500/10' : ''}`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${idx === 0 ? 'bg-yellow-500 text-black' : idx === 1 ? 'bg-slate-400 text-black' : idx === 2 ? 'bg-orange-700 text-white' : 'bg-slate-800 text-slate-500'}`}>
                            {idx + 1}
                        </div>
                        <div>
                            <div className="font-bold text-white flex items-center gap-2">
                                {member.displayName} {idx === 0 && <Crown size={14} className="text-yellow-500" />}
                            </div>
                            <div className="text-xs text-slate-500">Lvl {member.level || 1} • {member.mainGoal}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-indigo-400 font-bold">{member.currentXP || 0} XP</div>
                    </div>
                </div>
            ))}
            {members.length === 0 && <div className="p-8 text-center text-slate-500">Loading squad data...</div>}
        </div>
    </div>
  );
}

function PlayerHUD({ stats, profile }) {
  const { level = 1, currentXP = 0, nextLevelXP = 100, hp = 100, maxHP = 100, gold = 0 } = stats || {};
  const xpPercentage = Math.min((currentXP / nextLevelXP) * 100, 100);
  const hpPercentage = Math.min((hp / maxHP) * 100, 100);

  return (
    <div className="bg-slate-900 border-b border-slate-800 sticky top-[73px] z-40 shadow-xl backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
            <div className="relative group">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg border border-indigo-400/30">
                <span className="font-bold text-white text-lg">{level}</span>
              </div>
              <div className="absolute -bottom-2 -right-2 bg-slate-900 rounded-full p-0.5">
                 <div className="bg-yellow-500 text-[10px] font-bold text-black px-1.5 py-0.5 rounded-full border border-slate-900">
                   LVL
                 </div>
              </div>
            </div>
            
            <div className="flex-grow min-w-[120px]">
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-indigo-400 flex items-center gap-1">{profile?.name || 'Player'}</span>
                <span className="text-slate-400">{currentXP} / {nextLevelXP} XP</span>
              </div>
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 relative"
                  style={{ width: `${xpPercentage}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-3 flex-1 sm:flex-initial min-w-[120px]">
               <Heart size={20} className="text-red-500 fill-red-500/20" />
               <div className="flex-grow">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-red-400">HP</span>
                    <span className="text-slate-400">{hp}/{maxHP}</span>
                  </div>
                  <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div 
                      className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500"
                      style={{ width: `${hpPercentage}%` }}
                    />
                  </div>
               </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-yellow-500/20">
               <Coins size={18} className="text-yellow-400" />
               <span className="font-bold text-yellow-400 font-mono">{gold}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReflectionChat({ user, date, selectedDay, dailyLogs, onSaveLogs, habits }) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  const chatHistory = dailyLogs[selectedDay]?.chatHistory || [
    { role: 'assistant', text: `Hey! I'm your accountability coach. How is your day going so far?` }
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', text: input };
    const newHistory = [...chatHistory, userMessage];
    
    onSaveLogs(selectedDay, { ...dailyLogs[selectedDay], chatHistory: newHistory });
    setInput('');
    setIsTyping(true);

    try {
      const habitProgress = habits.map(h => `${h.name}: ${h.completed.includes(selectedDay) ? 'Done' : 'Not Done'}`).join(', ');
      const systemPrompt = `
        You are a motivational, tough-love productivity coach named 'Transformation Bot'.
        User's Habit Status for Today: ${habitProgress}.
        Goal: Help the user overcome procrastination and stay disciplined.
        Style: Short, punchy, emoji-friendly, conversational. Not too formal.
      `;

      const recentContext = newHistory.slice(-5).map(m => `${m.role}: ${m.text}`).join('\n');
      const fullPrompt = `${recentContext}\nassistant:`;

      const aiResponseText = await callGemini(fullPrompt, systemPrompt);
      
      const aiMessage = { role: 'assistant', text: aiResponseText };
      onSaveLogs(selectedDay, { ...dailyLogs[selectedDay], chatHistory: [...newHistory, aiMessage] });
    } catch (e) {
      console.error("Chat error", e);
      const errorMessage = { role: 'assistant', text: "I'm having trouble connecting. Try again?" };
      onSaveLogs(selectedDay, { ...dailyLogs[selectedDay], chatHistory: [...newHistory, errorMessage] });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/50 rounded-xl overflow-hidden border border-slate-800">
      <div className="bg-slate-900/80 p-3 border-b border-slate-800 flex items-center gap-2 backdrop-blur-sm">
        <div className="bg-indigo-600 p-1.5 rounded-lg">
          <Bot size={16} className="text-white" />
        </div>
        <span className="font-bold text-sm text-slate-200">Coach Chat</span>
      </div>

      <div ref={scrollRef} className="flex-grow p-4 overflow-y-auto space-y-4 h-[300px]">
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl p-3 border border-slate-700 flex gap-1">
              <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-75"></span>
              <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-150"></span>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-grow bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none placeholder-slate-600"
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button 
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

// --- MAIN APP COMPONENT ---
function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1));
  const [activeTab, setActiveTab] = useState('habits');
  const [greeting, setGreeting] = useState('');
  
  const [playerStats, setPlayerStats] = useState({
    level: 1, currentXP: 0, nextLevelXP: 100, hp: 100, maxHP: 100, gold: 0
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.tailwind) {
      const script = document.createElement('script');
      script.src = "https://cdn.tailwindcss.com";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Profile & Stats
  useEffect(() => {
    if (!user) return;
    
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    const unsubProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        setProfile(snap.data());
      } else {
        setProfile(null); 
      }
      setLoading(false);
    });

    const statsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'gamification', 'stats');
    const unsubStats = onSnapshot(statsRef, (snap) => {
      if (snap.exists()) {
        setPlayerStats(snap.data());
      } else {
        const initStats = { level: 1, currentXP: 0, nextLevelXP: 100, hp: 100, maxHP: 100, gold: 0 };
        setDoc(statsRef, initStats);
      }
    });

    return () => { unsubProfile(); unsubStats(); };
  }, [user]);

  const handleProfileCreate = async (data) => {
    if (!user) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    const publicProfileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
    
    await setDoc(profileRef, data);
    await setDoc(publicProfileRef, { 
        displayName: data.name, 
        mainGoal: data.mainGoal,
        level: 1,
        currentXP: 0,
        score: 1000 // Base score
    });
  };

  const updateStats = async (updates) => {
    if (!user) return;
    const statsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'gamification', 'stats');
    let newStats = { ...playerStats, ...updates };
    
    while (newStats.currentXP >= newStats.nextLevelXP) {
        newStats.currentXP -= newStats.nextLevelXP;
        newStats.level += 1;
        newStats.nextLevelXP = Math.round(newStats.nextLevelXP * 1.5);
        newStats.hp = newStats.maxHP;
        alert(`🎉 LEVEL UP! You are now level ${newStats.level}!`);
    }

    if (newStats.hp > newStats.maxHP) newStats.hp = newStats.maxHP;
    if (newStats.hp < 0) newStats.hp = 0;

    // Save Private Stats
    await setDoc(statsRef, newStats, { merge: true });

    // Sync Public Stats with Calculated Score
    const publicProfileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
    const totalScore = (newStats.level * 1000) + newStats.currentXP;
    await setDoc(publicProfileRef, { 
        level: newStats.level,
        currentXP: newStats.currentXP,
        score: totalScore
    }, { merge: true });
  };

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  const handleMonthChange = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (user && !profile) {
    return <AuthScreen onComplete={handleProfileCreate} />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center">
          <p className="mb-4">Connecting to Neural Link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 pb-20">
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-tr from-emerald-500 to-teal-500 p-2.5 rounded-xl shadow-lg shadow-emerald-900/20">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                 <h1 className="text-xl font-bold tracking-tight text-white">
                   Hey {profile.name}! <span className="text-emerald-400">👋</span>
                 </h1>
                 <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">
                   {greeting} • Let's crush 2026
                 </p>
              </div>
            </div>

            <div className="flex items-center bg-slate-800/50 rounded-xl p-1 border border-slate-700/50 self-start md:self-center">
              <button 
                onClick={() => handleMonthChange(-1)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="px-6 py-1 min-w-[140px] text-center font-bold text-slate-200">
                {getMonthName(currentDate)}
              </span>
              <button 
                onClick={() => handleMonthChange(1)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            
             <div className="hidden md:block text-xs text-slate-600 font-mono">
              ID: {user.uid.slice(0, 4)}..
            </div>
          </div>
        </div>
      </header>

      <PlayerHUD stats={playerStats} profile={profile} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex space-x-2 mb-8 bg-slate-900/50 p-1.5 rounded-2xl w-fit border border-slate-800/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('habits')}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
              activeTab === 'habits' 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Target size={16} />
            <span>Habits</span>
          </button>
          <button
            onClick={() => setActiveTab('finance')}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
              activeTab === 'finance' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Wallet size={16} />
            <span>Finance</span>
          </button>
          <button
            onClick={() => setActiveTab('social')}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
              activeTab === 'social' 
                ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/30' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Users size={16} />
            <span>Social</span>
          </button>
        </div>

        {activeTab === 'habits' ? (
          <HabitTracker 
            user={user} 
            date={currentDate} 
            playerStats={playerStats}
            updateStats={updateStats}
            profile={profile}
          />
        ) : activeTab === 'finance' ? (
          <FinanceTracker user={user} date={currentDate} />
        ) : (
          <SocialDashboard user={user} profile={profile} />
        )}

      </main>
    </div>
  );
}

// 2. Habit Tracker Component
function HabitTracker({ user, date, playerStats, updateStats, profile }) {
  const [habits, setHabits] = useState([]);
  const [dailyLogs, setDailyLogs] = useState({}); 
  const [viewMode, setViewMode] = useState('daily'); 
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showAIPlanner, setShowAIPlanner] = useState(false);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [sleepStatus, setSleepStatus] = useState({ isSleeping: false, startTime: null });
  
  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [itemToDelete, setItemToDelete] = useState(null); 
  const [editingHabitId, setEditingHabitId] = useState(null);
  const [tempHabitName, setTempHabitName] = useState("");
  
  const [generatingReport, setGeneratingReport] = useState(false);
  const [monthlyReport, setMonthlyReport] = useState("");
  const [patternReport, setPatternReport] = useState(null);

  const docId = formatDateId(date);
  const daysInMonth = getDaysInMonth(date.getFullYear(), date.getMonth());
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  useEffect(() => {
    const today = new Date();
    if (today.getMonth() === date.getMonth() && today.getFullYear() === date.getFullYear()) {
      setSelectedDay(today.getDate());
    } else {
      setSelectedDay(1);
    }
  }, [date]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'monthly_data', docId);
    
    const unsubscribe = onSnapshot(docRef, async (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            setHabits(data.habits || []);
            setDailyLogs(data.daily_logs || {});
            setMonthlyReport(data.monthly_report || "");
        } else {
             const prevDate = new Date(date);
             prevDate.setMonth(date.getMonth() - 1);
             const prevDocId = formatDateId(prevDate);
             const prevDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'monthly_data', prevDocId);
             
             try {
                const prevSnapshot = await getDoc(prevDocRef);
                if (prevSnapshot.exists()) {
                    const prevData = prevSnapshot.data();
                    const migratedHabits = (prevData.habits || []).map(h => ({
                        ...h,
                        completed: [] 
                    }));
                    setHabits(migratedHabits);
                    await setDoc(docRef, { habits: migratedHabits, daily_logs: {} }, { merge: true });
                } else {
                    setHabits([]);
                }
             } catch(e) {
                 setHabits([]);
             }
             setDailyLogs({});
             setMonthlyReport("");
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, docId]); 

  // Backend Pattern Analysis
  // const runPatternAnalysis = async () => {
  //     setLoading(true);
  //     try {
  //       const response = await fetch('https://goal-tracker-nnco.onrender.com/analyze-patterns', {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({ userId: user.uid, monthId: docId })
  //       });
  //       const report = await response.json();
  //       setPatternReport(report);
  //     } catch (error) {
  //       console.error("Analysis failed:", error);
  //       alert("Using offline pattern engine due to connection issue.");
  //       const analyzer = new PatternAnalyzer();
  //       const report = analyzer.analyze(dailyLogs, habits, date.getFullYear(), date.getMonth(), daysInMonth);
  //       setPatternReport(report);
  //     } finally {
  //       setLoading(false);
  //     }
  // };
// Backend Pattern Analysis
  const runPatternAnalysis = async () => {
      setLoading(true);
      try {
        // FIXED: Point to your local Python backend
        const response = await fetch('http://localhost:8080/analyze-patterns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // FIXED: Include appId so the backend can find the file
          body: JSON.stringify({ 
              userId: user.uid, 
              monthId: docId,
              appId: appId 
          })
        });
        
        const report = await response.json();
        
        if (report.error) {
            throw new Error(report.error);
        }

        setPatternReport(report);
      } catch (error) {
        console.error("Analysis failed:", error);
        // Fallback to offline engine if backend fails
        const analyzer = new ClientPatternAnalyzer(); 
        const report = analyzer.analyze(dailyLogs, habits, date.getFullYear(), date.getMonth(), daysInMonth);
        setPatternReport(report);
      } finally {
        setLoading(false);
      }
  };
  useEffect(() => {
      if(!user) return;
      const sleepDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'globals', 'sleep_status');
      const unsubscribe = onSnapshot(sleepDocRef, (snap) => {
          if (snap.exists()) {
              setSleepStatus(snap.data());
          } else {
              setSleepStatus({ isSleeping: false, startTime: null });
          }
      });
      return () => unsubscribe();
  }, [user]);

  const generateMonthlyReport = async () => {
     setGeneratingReport(true);
     try {
         const habitSummary = habits.map(h => `${h.name}: ${Math.round((h.completed.length / daysInMonth) * 100)}%`).join(", ");
         const moods = Object.values(dailyLogs).map(l => l.mood).filter(Boolean).join(" ");
         
         const prompt = `
            Analyze this month's habit data for the user.
            Habit Completion: ${habitSummary}.
            Moods recorded: ${moods}.
            
            Provide a monthly report:
            1. Key Pattern Observed.
            2. Biggest Win.
            3. Specific focus for next month to reduce procrastination.
            
            Keep it inspiring but analytical. Use markdown.
         `;
         const report = await callGemini(prompt);
         setMonthlyReport(report);
         
         const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'monthly_data', docId);
         await setDoc(docRef, { monthly_report: report }, { merge: true });
     } catch (e) {
         alert("Failed to generate report.");
     } finally {
         setGeneratingReport(false);
     }
  };

  const saveHabits = async (newHabits) => {
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'monthly_data', docId);
    await setDoc(docRef, { habits: newHabits }, { merge: true });
  };

  const saveDailyLog = async (day, logData) => {
    const newLogs = { ...dailyLogs, [day]: logData };
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'monthly_data', docId);
    await setDoc(docRef, { daily_logs: newLogs }, { merge: true });
  };

  const toggleDay = (habitIndex, day) => {
    const newHabits = [...habits];
    const habit = newHabits[habitIndex];
    const isCompleted = habit.completed.includes(day);
    
    if (isCompleted) {
      habit.completed = habit.completed.filter(d => d !== day);
    } else {
      habit.completed = [...habit.completed, day];
      updateStats({ 
          currentXP: (playerStats.currentXP || 0) + 15,
          gold: (playerStats.gold || 0) + 5
      });
    }
    saveHabits(newHabits);
  };

  const startEditingHabit = (habit) => {
    setEditingHabitId(habit.id);
    setTempHabitName(habit.name);
  }

  const saveHabitName = (idx) => {
    if(tempHabitName.trim()) {
        const newHabits = [...habits];
        newHabits[idx].name = tempHabitName;
        saveHabits(newHabits);
    }
    setEditingHabitId(null);
  }

  const handleAddHabit = () => {
    if (newHabitName.trim()) {
      const newHabits = [...habits, { id: Date.now().toString(), name: newHabitName.trim(), completed: [] }];
      saveHabits(newHabits);
      setNewHabitName("");
      setShowAddHabitModal(false);
    }
  };

  const addHabitDirect = (name) => {
     const newHabits = [...habits, { id: Date.now().toString(), name: name.trim(), completed: [] }];
     saveHabits(newHabits);
  }

  const handleDeleteHabit = () => {
    if (itemToDelete) {
      const newHabits = habits.filter((_, i) => i !== itemToDelete.index);
      saveHabits(newHabits);
      setItemToDelete(null);
    }
  };

  const handleSleepToggle = async () => {
    const sleepDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'globals', 'sleep_status');
    const now = Date.now();

    if (!sleepStatus.isSleeping) {
        // Start Sleep
        await setDoc(sleepDocRef, { isSleeping: true, startTime: now });
    } else {
        // Wake Up
        if (sleepStatus.startTime) {
            const durationMs = now - sleepStatus.startTime;
            const durationMins = Math.round(durationMs / (1000 * 60));
            
            // Explicitly use Date object for TODAY to find correct month
            const today = new Date();
            const todayYear = today.getFullYear();
            const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
            const todayDocId = `${todayYear}-${todayMonth}`;
            const todayDayNum = today.getDate();

            if (durationMins > 360) {
               updateStats({ hp: Math.min((playerStats.maxHP || 100), (playerStats.hp || 0) + 20) });
            } else {
               updateStats({ hp: Math.min((playerStats.maxHP || 100), (playerStats.hp || 0) + 5) });
            }

            const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'monthly_data', todayDocId);
            
            try {
                // We need to read the today doc to merge correctly
                const snap = await getDoc(docRef);
                let currentLogs = {};
                if (snap.exists()) {
                   currentLogs = snap.data().daily_logs || {};
                }
                
                const dayLog = currentLogs[todayDayNum] || {};
                currentLogs[todayDayNum] = { ...dayLog, sleepDuration: durationMins };
                
                await setDoc(docRef, { daily_logs: currentLogs }, { merge: true });
                
                // If we are currently viewing this month, update local state
                if (todayDocId === docId) {
                   setDailyLogs(prev => ({...prev, [todayDayNum]: currentLogs[todayDayNum]}));
                }
            } catch (e) { console.error("Error saving sleep:", e); }
        }
        await setDoc(sleepDocRef, { isSleeping: false, startTime: null });
    }
  };

  const manualQuoteRefresh = async () => {
     setFetchingQuote(true);
     try {
         const q = await callGemini("Generate a unique, hard-hitting motivational quote (max 15 words). Format: 'Quote' - Author");
         const log = dailyLogs[selectedDay] || {};
         await saveDailyLog(selectedDay, { ...log, quote: q });
     } catch(e) { console.error(e) } finally { setFetchingQuote(false); }
  }

  useEffect(() => {
    const today = new Date();
    const isToday = today.getDate() === selectedDay && 
                    today.getMonth() === date.getMonth() &&
                    today.getFullYear() === date.getFullYear();

    const log = dailyLogs[selectedDay];

    if (isToday && !log?.quote && !fetchingQuote && !loading && habits.length > 0) {
        setFetchingQuote(true);
        callGemini("Generate a short, powerful motivational quote (max 15 words). Format: 'Quote' - Author")
            .then(q => saveDailyLog(selectedDay, { ...log, quote: q }))
            .catch(e => console.error(e))
            .finally(() => setFetchingQuote(false));
    }
  }, [selectedDay, date, loading, habits.length]); 


  const dailyProgress = useMemo(() => {
    if (habits.length === 0) return 0;
    const completedCount = habits.filter(h => h.completed.includes(selectedDay)).length;
    return Math.round((completedCount / habits.length) * 100);
  }, [habits, selectedDay]);

  const currentLog = dailyLogs[selectedDay] || { mood: '', note: '', chatHistory: [], quote: '', sleepDuration: null };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {showAIPlanner && <AIPlannerModal onClose={() => setShowAIPlanner(false)} onAddHabit={addHabitDirect} />}
      <Modal isOpen={showAddHabitModal} onClose={() => setShowAddHabitModal(false)} title="New Habit">
        <div className="space-y-4">
            <input type="text" value={newHabitName} onChange={(e) => setNewHabitName(e.target.value)} placeholder="e.g. Read 10 pages" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none" />
            <button onClick={handleAddHabit} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-medium">Create Habit</button>
        </div>
      </Modal>
      <DeleteConfirmModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={handleDeleteHabit} itemName={itemToDelete?.name} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Calendar size={20} className="text-emerald-500"/> {viewMode === 'daily' ? 'Daily Focus' : 'Monthly Grid'}</h2>
        <div className="flex gap-3 self-start md:self-auto">
          <button onClick={() => setShowAIPlanner(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-purple-400 border border-purple-500/30 px-4 py-2 rounded-lg font-medium"><Sparkles size={16} /> AI Planner</button>
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button onClick={() => setViewMode('daily')} className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${viewMode === 'daily' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}><List size={16} className="mr-2" /> Daily</button>
            <button onClick={() => setViewMode('monthly')} className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${viewMode === 'monthly' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}><Layout size={16} className="mr-2" /> Monthly</button>
          </div>
        </div>
      </div>

      {viewMode === 'daily' ? (
        <div className="space-y-6">
          <div className="flex items-center bg-slate-900/50 p-2 rounded-2xl border border-slate-800/50 overflow-x-auto no-scrollbar">
            {daysArray.map(day => {
               const dayLog = dailyLogs[day];
               const hasContent = dayLog && (dayLog.mood || dayLog.sleepDuration);
               const isSelected = selectedDay === day;
               const weekDayLetter = new Date(date.getFullYear(), date.getMonth(), day).toLocaleDateString('en-US', { weekday: 'narrow' });
               return (
                <button key={day} onClick={() => setSelectedDay(day)} className={`relative min-w-[3.5rem] h-14 flex flex-col items-center justify-center rounded-xl mr-2 ${isSelected ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <span className="text-[10px] font-bold opacity-60 mb-0.5">{weekDayLetter}</span>
                  <span className="text-sm font-bold">{day}</span>
                  {hasContent && <span className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}></span>}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
             <div className="md:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2"><Activity size={14} /> Progress</h3>
                <div className="flex items-end gap-3 mb-4"><span className="text-5xl font-bold text-white tracking-tight">{dailyProgress}%</span></div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000" style={{ width: `${dailyProgress}%` }} /></div>
             </div>
             <div className="md:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                 <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2"><Moon size={14} /> Sleep Tracker</h3>
                 {sleepStatus.isSleeping ? (
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 text-indigo-400 mb-4 animate-pulse"><Clock size={16} /> Recording sleep...</div>
                        <button onClick={handleSleepToggle} className="w-full bg-gradient-to-r from-orange-400 to-amber-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Sun size={20} /> Rise & Shine</button>
                    </div>
                 ) : (
                    <div className="flex flex-col h-full justify-between">
                        <div className="flex items-end gap-2 mb-2"><span className="text-3xl font-bold text-white">{currentLog.sleepDuration ? formatDuration(currentLog.sleepDuration) : "--"}</span></div>
                        <button onClick={handleSleepToggle} className="w-full mt-auto bg-slate-800 text-slate-300 py-2 rounded-xl font-medium flex items-center justify-center gap-2"><Moon size={16} /> Good Night</button>
                    </div>
                 )}
             </div>
             <div className="md:col-span-4 bg-gradient-to-br from-indigo-900/20 to-slate-900 border border-slate-800 rounded-2xl p-6 relative">
                 <div className="flex justify-between items-start mb-2">
                    <h3 className="text-indigo-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Sparkles size={14} /> Daily Fuel</h3>
                    <button onClick={manualQuoteRefresh} className="text-slate-500 hover:text-white p-1"><Edit3 size={12} /></button>
                 </div>
                 {fetchingQuote ? <div className="text-slate-500 text-sm animate-pulse">Finding wisdom...</div> : 
                 <p className="text-slate-200 font-medium italic leading-relaxed text-sm mt-4">"{currentLog.quote || `${profile?.name || 'Friend'}, your only limit is your mind.`}"</p>}
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Check className="text-emerald-500" size={20} /> Your Tasks</h3>
                <button onClick={() => { setNewHabitName(""); setShowAddHabitModal(true); }} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700"><Plus size={14}/> Add Habit</button>
              </div>
              <div className="space-y-3">
                {habits.map((habit, idx) => {
                  const isCompleted = habit.completed.includes(selectedDay);
                  return (
                    <div 
                      key={habit.id} 
                      className={`p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group cursor-pointer ${isCompleted ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/30 border-slate-700'}`}
                      onClick={() => toggleDay(idx, selectedDay)}
                    >
                      <div className="flex-1 flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isCompleted ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                            {isCompleted && <Check size={14} className="text-white" strokeWidth={3} />}
                          </div>
                          
                          {editingHabitId === habit.id ? (
                            <div onClick={e => e.stopPropagation()} className="flex-1">
                                <input 
                                    autoFocus
                                    type="text" 
                                    value={tempHabitName}
                                    onChange={(e) => setTempHabitName(e.target.value)}
                                    onBlur={() => saveHabitName(idx)}
                                    onKeyDown={(e) => e.key === 'Enter' && saveHabitName(idx)}
                                    className="bg-slate-950 border border-emerald-500 rounded px-2 py-1 text-white focus:outline-none w-full"
                                />
                            </div>
                          ) : (
                             <span className={`font-medium transition-colors ${isCompleted ? 'text-emerald-400' : 'text-slate-300'}`}>{habit.name}</span>
                          )}
                      </div>
                      
                      {editingHabitId !== habit.id && (
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); startEditingHabit(habit); }} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><Edit3 size={14}/></button>
                            <button onClick={(e) => { e.stopPropagation(); setItemToDelete({ type: 'habit', index: idx, name: habit.name }); }} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"><Trash2 size={14}/></button>
                          </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="lg:h-[500px]">
                <ReflectionChat user={user} date={date} selectedDay={selectedDay} dailyLogs={dailyLogs} onSaveLogs={saveDailyLog} habits={habits} />
            </div>
          </div>
        </div>
      ) : (
        /* Monthly Grid View */
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Calendar size={18} /> Monthly Overview
                 </h2>
                 <div className="flex gap-2">
                    <button 
                        onClick={runPatternAnalysis}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-violet-900/30 text-violet-400 hover:text-violet-300 border border-violet-500/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                    >
                        <Brain size={14} /> Analyze Patterns
                    </button>
                    
                    <button 
                        onClick={generateMonthlyReport}
                        disabled={generatingReport}
                        className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50"
                    >
                        {generatingReport ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                        Report
                    </button>
                 </div>
            </div>

            <InsightsPanel report={patternReport} onClose={() => setPatternReport(null)} loading={loading} />

            {monthlyReport && !patternReport && (
                <div className="bg-slate-900 border border-violet-500/30 rounded-2xl p-6 animate-in slide-in-from-top-2">
                    <h3 className="text-violet-400 font-bold mb-4 flex items-center gap-2">
                        <Bot size={18} /> Monthly Insights
                    </h3>
                    <div className="prose prose-invert prose-sm max-w-none text-slate-300 whitespace-pre-line">
                        {monthlyReport}
                    </div>
                </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden overflow-x-auto">
              <div className="min-w-max">
                <div className="flex border-b border-slate-800 bg-slate-800/50">
                  <div className="sticky left-0 w-64 p-4 flex-shrink-0 bg-slate-800/95 border-r border-slate-700 font-semibold text-slate-300 z-10">Habit</div>
                  {daysArray.map(day => (
                      <div key={day} className="w-10 flex-shrink-0 flex flex-col items-center justify-center border-r border-slate-800 text-xs font-mono py-2">
                        <span className="text-[10px] text-slate-500 mb-0.5">{new Date(date.getFullYear(), date.getMonth(), day).toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                        <span className="font-bold text-slate-300">{day}</span>
                      </div>
                  ))}
                </div>
                {habits.map((habit, idx) => (
                  <div key={habit.id} className="flex border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group">
                    <div className="sticky left-0 w-64 p-3 flex-shrink-0 bg-slate-900 border-r border-slate-700 flex items-center z-10">
                      <div className="flex items-center justify-between w-full">
                        <span className="truncate font-medium text-slate-200">{habit.name}</span>
                        <EditableText value={habit.name} onSave={(val) => updateHabitName(idx, val)} className="flex-none" />
                      </div>
                    </div>
                    {daysArray.map(day => (
                        <div key={day} className="w-10 flex-shrink-0 flex items-center justify-center border-r border-slate-800/50">
                          <button onClick={() => toggleDay(idx, day)} className={`w-6 h-6 rounded flex items-center justify-center transition-all ${habit.completed.includes(day) ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-transparent hover:bg-slate-700'}`}>
                            <Check size={14} strokeWidth={3} />
                          </button>
                        </div>
                    ))}
                    <div className="w-16 flex-shrink-0 flex items-center justify-center">
                       <button onClick={() => setItemToDelete({ type: 'habit', index: idx, name: habit.name })} className="text-slate-600 hover:text-red-400 p-2"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
        </div>
      )}
    </div>
  );
}

// 4. Finance Tracker Component
function FinanceTracker({ user, date }) {
  const [data, setData] = useState({ income: 0, budget: 0, goals: [], aiAdvice: '' });
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalToDelete, setGoalToDelete] = useState(null);

  const docId = formatDateId(date);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'monthly_data', docId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const docData = docSnap.data();
        setData(docData.finance || { income: 0, budget: 0, goals: [], aiAdvice: '' });
      } else {
        setData({ income: 0, budget: 0, goals: [], aiAdvice: '' });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, docId]);

  const updateFinance = async (newData) => {
    setData(newData);
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'monthly_data', docId);
    await setDoc(docRef, { finance: newData }, { merge: true });
  };

  const handleAddGoal = () => {
    if (!goalName.trim()) return;
    const newGoals = [...(data.goals || []), { id: Date.now(), name: goalName.trim(), target: parseFloat(goalTarget) || 0, current: 0 }];
    updateFinance({ ...data, goals: newGoals });
    setGoalName(""); setGoalTarget(""); setShowAddGoalModal(false);
  };

  const updateGoalName = (id, newName) => {
    const newGoals = (data.goals || []).map(g => g.id === id ? { ...g, name: newName } : g);
    updateFinance({ ...data, goals: newGoals });
  };

  const updateGoalProgress = (id, newVal) => {
    const newGoals = (data.goals || []).map(g => g.id === id ? { ...g, current: parseFloat(newVal) || 0 } : g);
    updateFinance({ ...data, goals: newGoals });
  };
  
  const handleDeleteGoal = () => {
     if(goalToDelete) {
        const newGoals = (data.goals || []).filter(g => g.id !== goalToDelete.id);
        updateFinance({ ...data, goals: newGoals });
        setGoalToDelete(null);
     }
  }

  const analyzeFinances = async () => {
      setAnalyzing(true);
      try {
          const prompt = `Role: Financial Advisor. Analyze: Income $${data.income}, Budget $${data.budget}. Give 2 concise tips.`;
          const advice = await callGemini(prompt);
          updateFinance({ ...data, aiAdvice: advice });
      } catch (e) { alert("Advisor busy."); } finally { setAnalyzing(false); }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading financials...</div>;

  // Restore Total Saved Calculation
  const totalSaved = (data.goals || []).reduce((acc, curr) => acc + curr.current, 0);
  const savingsRate = data.income > 0 ? Math.round((totalSaved / data.income) * 100) : 0;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <Modal isOpen={showAddGoalModal} onClose={() => setShowAddGoalModal(false)} title="New Financial Goal">
        <div className="space-y-4">
            <input type="text" value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="Goal Name" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white" />
            <input type="number" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="Target Amount" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white" />
            <button onClick={handleAddGoal} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg">Create Goal</button>
        </div>
      </Modal>
      <DeleteConfirmModal isOpen={!!goalToDelete} onClose={() => setGoalToDelete(null)} onConfirm={handleDeleteGoal} itemName={goalToDelete?.name} />

      <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><PieChart size={20} className="text-indigo-500"/> Financial Overview</h2>
          <button onClick={analyzeFinances} disabled={analyzing} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl">{analyzing ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />} Analyze</button>
      </div>
      
      {data.aiAdvice && <div className="bg-slate-900 border border-indigo-500/30 p-6 rounded-2xl"><p className="text-slate-200 text-sm">{data.aiAdvice}</p></div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <div className="text-slate-400 text-sm mb-1">Monthly Income</div>
          <div className="flex items-center text-emerald-400"><span className="text-2xl font-bold mr-2">$</span><input type="number" value={data.income || ''} onChange={(e) => updateFinance({ ...data, income: parseFloat(e.target.value) || 0 })} className="bg-transparent text-2xl font-bold text-white w-full border-none focus:ring-0" placeholder="0" /></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <div className="text-slate-400 text-sm mb-1">Budget Limit</div>
          <div className="flex items-center text-indigo-400"><span className="text-2xl font-bold mr-2">$</span><input type="number" value={data.budget || ''} onChange={(e) => updateFinance({ ...data, budget: parseFloat(e.target.value) || 0 })} className="bg-transparent text-2xl font-bold text-white w-full border-none focus:ring-0" placeholder="0" /></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <div className="text-slate-400 text-sm mb-1">Total Saved</div>
          <div className="text-2xl font-bold text-white">${totalSaved.toLocaleString()} <span className="text-sm font-normal text-slate-500 ml-2">({savingsRate}% of income)</span></div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-8">
        <h3 className="text-xl font-bold text-white flex items-center gap-2"><TrendingUp className="text-indigo-500" size={20} /> Goals & Allocations</h3>
        <button onClick={() => setShowAddGoalModal(true)} className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg">+ Add Goal</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data.goals || []).map((goal) => (
            <div key={goal.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <div className="flex justify-between items-start mb-4">
                <EditableText value={goal.name} onSave={(val) => updateGoalName(goal.id, val)} className="font-semibold text-slate-200" />
                <button onClick={() => setGoalToDelete(goal)} className="text-slate-600 hover:text-red-400"><Trash2 size={16}/></button>
              </div>
              <div className="space-y-4">
                <div>
                    <label className="text-xs text-slate-500 font-bold">Current</label>
                    <div className="flex items-center"><span className="text-slate-400 mr-1">$</span><input type="number" value={goal.current || ''} onChange={(e) => updateGoalProgress(goal.id, e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-sm" /></div>
                </div>
                <div className="flex justify-between text-xs text-slate-400"><span>Target: ${goal.target}</span><span>{Math.round(goal.target ? (goal.current / goal.target) * 100 : 0)}%</span></div>
                <div className="h-2 bg-slate-950 rounded-full overflow-hidden"><div className="h-full bg-indigo-600" style={{ width: `${Math.min(goal.target ? (goal.current / goal.target) * 100 : 0, 100)}%` }} /></div>
              </div>
            </div>
        ))}
      </div>
    </div>
  );
}

export default App;