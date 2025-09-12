// App.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import SettingsPanel from './settings';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

/**
 * Complete Fitness Dashboard MVP
 * Features: Dashboard, Clients, Workouts, Progress, Stats, Settings, Meals, Chat
 * Fully functional with data persistence and responsive design
 */

/* -------------------- Types -------------------- */
type WorkoutExercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  duration?: number; // in minutes
  notes?: string;
};

type Workout = {
  id: string;
  name: string;
  date: string;
  exercises: WorkoutExercise[];
  completed: boolean;
  duration?: number;
  calories?: number;
  notes?: string;
  clientId?: string;
};

type Meal = {
  id: string;
  name: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string;
  notes?: string;
};

type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
};

type ProgressEntry = {
  id: string;
  date: string;
  weight?: number;
  bodyFat?: number;
  muscle?: number;
  measurements?: {
    chest?: number;
    waist?: number;
    hips?: number;
    arms?: number;
    thighs?: number;
  };
  photos?: string[];
  notes?: string;
};

/* -------------------- Utilities -------------------- */
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const save = (k: string, v: any) =>
  typeof window !== "undefined" && localStorage.setItem(k, JSON.stringify(v));

const load = <T,>(k: string, fallback: T): T => {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

function lightenHex(hex: string, percent: number): string {
  hex = hex.replace('#', '');
  const num = parseInt(hex, 16);
  let r = (num >> 16) + Math.round(2.55 * percent);
  let g = ((num >> 8) & 0x00FF) + Math.round(2.55 * percent);
  let b = (num & 0x0000FF) + Math.round(2.55 * percent);
  r = r > 255 ? 255 : r < 0 ? 0 : r;
  g = g > 255 ? 255 : g < 0 ? 0 : g;
  b = b > 255 ? 255 : b < 0 ? 0 : b;
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

function darkenHex(hex: string, percent: number): string {
  return lightenHex(hex, -percent);
}

/* -------------------- Toast -------------------- */
type Toast = { id: string; msg: React.ReactNode; type?: "info" | "error" | "success"; ttl?: number };
const ToastContext = createContext<{ push: (m: React.ReactNode, opts?: Partial<Toast>) => string; remove: (id: string) => void } | null>(null);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: React.ReactNode, opts: Partial<Toast> = {}) => {
    const id = uid();
    const toast: Toast = {
      id,
      msg,
      type: opts.type || "info",
      ttl: typeof opts.ttl === "number" ? opts.ttl : 4000,
    };
    setToasts((t) => [toast, ...t]);
    if (toast.ttl && toast.ttl > 0) {
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), toast.ttl);
    }
    return id;
  }, []);
  const remove = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  return (
    <ToastContext.Provider value={{ push, remove }}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm w-full px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-toast-in ${
              t.type === "error" ? "bg-red-600 text-white" : t.type === "success" ? "bg-green-600 text-white" : "bg-white text-gray-900 border dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
            }`}
          >
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 text-sm">{t.msg}</div>
              <button onClick={() => remove(t.id)} className="text-xs opacity-70 hover:opacity-100">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

/* -------------------- Settings -------------------- */
type AppSettings = {
  theme: 'auto' | 'light' | 'dark'
  primary: string // hex color
  compact: boolean
  animations: boolean
  timezone: string
  telemetry: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  primary: '#2563eb', // blue-600 hex
  compact: false,
  animations: true,
  timezone: typeof Intl !== 'undefined' ? (Intl as any).DateTimeFormat?.()?.resolvedOptions?.().timeZone || 'UTC' : 'UTC',
  telemetry: true,
};

const SettingsContext = createContext<{ settings: AppSettings; update: (patch: Partial<AppSettings>) => void } | null>(null);

function SettingsProvider({ children }: { children: React.ReactNode }) {
  const saved = load("settings", DEFAULT_SETTINGS);
  const [settings, setSettings] = useState<AppSettings>(saved);
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => { save("settings", settings); }, [settings]);

  useEffect(() => {
    if (settings.theme !== 'auto') {
      setEffectiveTheme(settings.theme);
      return;
    }

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    setEffectiveTheme(mql.matches ? 'dark' : 'light');

    const listener = (e: MediaQueryListEvent) => setEffectiveTheme(e.matches ? 'dark' : 'light');
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, [settings.theme]);

  const update = (patch: Partial<AppSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const primaryLight = useMemo(() => lightenHex(settings.primary, 40), [settings.primary]);
  const primaryDark = useMemo(() => darkenHex(settings.primary, 20), [settings.primary]);

  const cssVars = {
    '--primary': settings.primary,
    '--primary-light': primaryLight,
    '--primary-dark': primaryDark,
    '--background': effectiveTheme === 'dark' ? '#0f172a' : '#ffffff',
    '--foreground': effectiveTheme === 'dark' ? '#f1f5f9' : '#0f172a',
    '--card': effectiveTheme === 'dark' ? '#1e293b' : '#ffffff',
    '--card-foreground': effectiveTheme === 'dark' ? '#f1f5f9' : '#0f172a',
    '--border': effectiveTheme === 'dark' ? '#334155' : '#e2e8f0',
    '--input': effectiveTheme === 'dark' ? '#334155' : '#e2e8f0',
    '--secondary': effectiveTheme === 'dark' ? '#334155' : '#f1f5f9',
    '--secondary-foreground': effectiveTheme === 'dark' ? '#f1f5f9' : '#0f172a',
    '--muted': effectiveTheme === 'dark' ? '#475569' : '#f8fafc',
    '--muted-foreground': effectiveTheme === 'dark' ? '#94a3b8' : '#64748b',
    '--accent': effectiveTheme === 'dark' ? '#475569' : '#f1f5f9',
    '--accent-foreground': effectiveTheme === 'dark' ? '#f1f5f9' : '#0f172a',
  };

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      <div
        style={cssVars as React.CSSProperties}
        className={`${effectiveTheme === 'dark' ? 'dark' : ''} ${settings.compact ? 'compact' : ''} ${settings.animations ? 'animations' : ''}`}
      >
        {children}
      </div>
    </SettingsContext.Provider>
  );
}
function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

/* -------------------- Auth -------------------- */
type User = { 
  id: string; 
  role: "trainer" | "client"; 
  name: string; 
  email: string; 
  password?: string; 
  clients?: User[]; 
  trainerId?: string; 
  activityLog?: { msg: string; time: string }[];
  avatar?: string;
  phone?: string;
  dateJoined?: string;
};

const AuthContext = createContext<any>(null);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const savedUsers = load<User[]>("users", null as any);
  const initialUsers = savedUsers || [
    { 
      id: "trainer-1", 
      role: "trainer", 
      name: "Alex Johnson", 
      email: "trainer@fit.app", 
      password: "trainer", 
      clients: [], 
      activityLog: [{ msg: "Welcome to FitnessPro!", time: new Date().toLocaleString() }],
      dateJoined: "2024-01-15",
      phone: "+1 (555) 123-4567"
    },
    {
      id: "client-1",
      role: "client",
      name: "Sarah Wilson",
      email: "client@fit.app",
      password: "client",
      trainerId: "trainer-1",
      activityLog: [{ msg: "Account created", time: new Date().toLocaleString() }],
      dateJoined: "2024-02-01",
      phone: "+1 (555) 987-6543"
    }
  ];
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [session, setSession] = useState<{ userId: string; token: string } | null>(load("session", null));

  useEffect(() => save("users", users), [users]);
  useEffect(() => save("session", session), [session]);

  const register = (payload: { name: string; email: string; password: string; role: "client" | "trainer"; phone?: string }) => {
    if (users.find((u) => u.email === payload.email)) throw new Error("Email already exists");
    const user: User = {
      id: uid(),
      ...payload,
      clients: payload.role === "trainer" ? [] : undefined,
      trainerId: payload.role === "client" ? users.find((u) => u.role === "trainer")?.id : undefined,
      activityLog: [{ msg: "Account created", time: new Date().toLocaleString() }],
      dateJoined: new Date().toISOString().split('T')[0],
    } as User;
    setUsers((u) => [user, ...u]);
    return user;
  };

  const login = ({ email, password }: { email: string; password: string }) => {
    const user = users.find((u) => u.email === email && u.password === password);
    if (!user) throw new Error("Invalid credentials");
    setSession({ userId: user.id, token: uid() });
    return user;
  };

  const logout = () => setSession(null);
  const getUser = (id?: string) => users.find((u) => u.id === id);
  const updateUser = (id: string, patch: Partial<User>) => setUsers((u) => u.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addClientToTrainer = (trainerId: string, client: User) =>
    setUsers((u) => u.map((x) => (x.id === trainerId ? { ...x, clients: [...(x.clients || []), client] } : x)));

  return <AuthContext.Provider value={{ users, session, register, login, logout, getUser, updateUser, addClientToTrainer }}>{children}</AuthContext.Provider>;
}
function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/* -------------------- Data -------------------- */
const DataContext = createContext<any>(null);
function DataProvider({ children }: { children: React.ReactNode }) {
  const savedData = load("data", { workouts: [], meals: [], messages: [], progress: [] });
  const [appData, setAppData] = useState<any>(savedData);

  useEffect(() => save("data", appData), [appData]);

  const addWorkout = (w: Partial<Workout>) => {
    const workout = { id: uid(), date: new Date().toISOString().split('T')[0], completed: false, exercises: [], ...w };
    setAppData((d: any) => ({ ...d, workouts: [workout, ...(d.workouts || [])] }));
    return workout;
  };

  const updateWorkout = (id: string, updates: Partial<Workout>) => 
    setAppData((d: any) => ({ ...d, workouts: d.workouts.map((w: any) => (w.id === id ? { ...w, ...updates } : w)) }));

  const deleteWorkout = (id: string) =>
    setAppData((d: any) => ({ ...d, workouts: d.workouts.filter((w: any) => w.id !== id) }));

  const logMeal = (meal: Partial<Meal>) => {
    const newMeal = { id: uid(), date: new Date().toISOString().split('T')[0], ...meal };
    setAppData((d: any) => ({ ...d, meals: [newMeal, ...(d.meals || [])] }));
    return newMeal;
  };

  const updateMeal = (id: string, updates: Partial<Meal>) =>
    setAppData((d: any) => ({ ...d, meals: d.meals.map((m: any) => (m.id === id ? { ...m, ...updates } : m)) }));

  const deleteMeal = (id: string) =>
    setAppData((d: any) => ({ ...d, meals: d.meals.filter((m: any) => m.id !== id) }));

  const sendMessage = (message: Partial<Message>) => {
    const newMessage = { id: uid(), timestamp: new Date().toISOString(), read: false, ...message };
    setAppData((d: any) => ({ ...d, messages: [newMessage, ...(d.messages || [])] }));
    return newMessage;
  };

  const markMessageRead = (id: string) =>
    setAppData((d: any) => ({ ...d, messages: d.messages.map((m: any) => (m.id === id ? { ...m, read: true } : m)) }));

  const addProgressEntry = (entry: Partial<ProgressEntry>) => {
    const newEntry = { id: uid(), date: new Date().toISOString().split('T')[0], ...entry };
    setAppData((d: any) => ({ ...d, progress: [newEntry, ...(d.progress || [])] }));
    return newEntry;
  };

  const updateProgressEntry = (id: string, updates: Partial<ProgressEntry>) =>
    setAppData((d: any) => ({ ...d, progress: d.progress.map((p: any) => (p.id === id ? { ...p, ...updates } : p)) }));

  const deleteProgressEntry = (id: string) =>
    setAppData((d: any) => ({ ...d, progress: d.progress.filter((p: any) => p.id !== id) }));

  return (
    <DataContext.Provider value={{ 
      appData, 
      addWorkout, 
      updateWorkout, 
      deleteWorkout,
      logMeal, 
      updateMeal,
      deleteMeal,
      sendMessage, 
      markMessageRead,
      addProgressEntry,
      updateProgressEntry,
      deleteProgressEntry
    }}>
      {children}
    </DataContext.Provider>
  );
}
function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}

/* -------------------- UI Primitives -------------------- */
function LogoPlaceholder({ size = 72 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold transition-all duration-300 ease-in-out hover:scale-105 shadow-lg"
      style={{ width: size, height: size }}
    >
      <div className="text-white text-sm">FP</div>
    </div>
  );
}

function LoadingScreen({ onDone }: { onDone?: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDone && onDone(), 600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-white to-gray-100 transition-colors z-50 dark:from-[var(--background)] dark:to-[var(--muted)]">
      <div className="flex flex-col items-center gap-6 p-6 animate-fade-in">
        <LogoPlaceholder size={96} />
        <div className="text-lg text-gray-600 font-semibold dark:text-[var(--foreground)]">FitnessPro</div>
        <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden dark:bg-[var(--muted)]">
          <div className="h-full bg-gradient-to-r from-[var(--primary-light)] to-[var(--primary)] animate-loading-bar" style={{ width: "60%" }} />
        </div>
      </div>
    </div>
  );
}

function TopBar({ title, onLogout, onToggleSidebar }: { title: string; onLogout: () => void; onToggleSidebar: () => void }) {
  const { session, getUser } = useAuth();
  const user = session ? getUser(session.userId) : null;
  const { push } = useToast();
  const { settings } = useSettings();
  return (
    <header className={`flex items-center justify-between mb-6 p-4 border-b bg-[var(--card)] transition-all duration-300 ease-in-out ${settings.animations ? 'animate-slide-down' : ''} border-[var(--border)]`}>
      <div className="flex items-center gap-4">
        <button onClick={onToggleSidebar} className="md:hidden p-2 rounded hover:bg-[var(--secondary)] transition-colors duration-200">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm text-[var(--muted-foreground)]">{user ? `${user.name} (${user.role})` : "Not signed in"}</div>
        {session && (
          <button
            onClick={() => {
              onLogout();
              push("Logged out successfully", { type: "success" });
            }}
            className="px-3 py-1 rounded bg-[var(--secondary)] hover:bg-[var(--accent)] hover:scale-105 transition-all duration-200 text-[var(--secondary-foreground)]"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}

function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  const { settings } = useSettings();
  return (
    <div className={`bg-[var(--card)] rounded-lg shadow-lg border border-[var(--border)] transition-all duration-300 ease-in-out ${settings.compact ? 'p-3' : 'p-6'} ${settings.animations ? 'animate-fade-in hover:shadow-xl' : ''} ${className}`}>
      {title && <h3 className="text-lg font-semibold mb-4 text-[var(--card-foreground)]">{title}</h3>}
      {children}
    </div>
  );
}

function Button({ 
  children, 
  onClick, 
  variant = "primary", 
  size = "md", 
  disabled = false,
  className = ""
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}) {
  const baseClasses = "font-medium rounded-lg transition-all duration-200 ease-in-out hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100";
  
  const variants = {
    primary: "bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)]",
    secondary: "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--accent)]",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-[var(--foreground)] hover:bg-[var(--secondary)]"
  };

  const sizes = {
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

function Input({ 
  label, 
  type = "text", 
  value, 
  onChange, 
  placeholder,
  required = false,
  className = ""
}: {
  label?: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-[var(--foreground)] mb-1">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full p-2 border border-[var(--input)] rounded-lg bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200"
      />
    </div>
  );
}

function Select({ 
  label, 
  value, 
  onChange, 
  options,
  className = ""
}: {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-[var(--foreground)] mb-1">{label}</label>}
      <select
        value={value}
        onChange={onChange}
        className="w-full p-2 border border-[var(--input)] rounded-lg bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" onClick={onClose}>
      <div className="bg-[var(--card)] p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-[var(--card-foreground)]">{title}</h2>
          <button onClick={onClose} className="text-2xl text-[var(--muted-foreground)] hover:text-[var(--foreground)]">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* -------------------- Dashboard Page -------------------- */
function DashboardPage() {
  const { session, getUser } = useAuth();
  const { appData } = useData();
  const user = session ? getUser(session.userId) : null;

  const today = new Date().toISOString().split('T')[0];
  const todayWorkouts = appData.workouts?.filter((w: Workout) => w.date === today) || [];
  const todayMeals = appData.meals?.filter((m: Meal) => m.date === today) || [];
  const recentProgress = appData.progress?.slice(0, 1)[0] || null;

  const weeklyStats = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const workouts = appData.workouts?.filter((w: Workout) => w.date === date && w.completed) || [];
      const meals = appData.meals?.filter((m: Meal) => m.date === date) || [];
      const totalCalories = meals.reduce((sum: number, meal: Meal) => sum + meal.calories, 0);
      
      return {
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        workouts: workouts.length,
        calories: totalCalories
      };
    });
  }, [appData]);

  const totalStats = useMemo(() => {
    const completedWorkouts = appData.workouts?.filter((w: Workout) => w.completed).length || 0;
    const totalMeals = appData.meals?.length || 0;
    const avgCalories = totalMeals > 0 ? Math.round(appData.meals.reduce((sum: number, meal: Meal) => sum + meal.calories, 0) / totalMeals) : 0;
    const progressEntries = appData.progress?.length || 0;

    return { completedWorkouts, totalMeals, avgCalories, progressEntries };
  }, [appData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[var(--foreground)]">Welcome back, {user?.name}!</h2>
          <p className="text-[var(--muted-foreground)] mt-1">Here's your fitness overview for today</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-[var(--muted-foreground)]">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="text-center">
          <div className="text-3xl font-bold text-[var(--primary)] mb-2">{totalStats.completedWorkouts}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Workouts Completed</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">{totalStats.totalMeals}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Meals Logged</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-bold text-orange-600 mb-2">{totalStats.avgCalories}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Avg Daily Calories</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-bold text-purple-600 mb-2">{totalStats.progressEntries}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Progress Entries</div>
        </Card>
      </div>

      {/* Weekly Activity Chart */}
      <Card title="Weekly Activity">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={weeklyStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" stroke="var(--muted-foreground)" />
            <YAxis stroke="var(--muted-foreground)" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--card)', 
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--foreground)'
              }} 
            />
            <Bar dataKey="workouts" fill="var(--primary)" name="Workouts" />
            <Bar dataKey="calories" fill="#10b981" name="Calories (÷100)" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Workouts */}
        <Card title="Today's Workouts">
          {todayWorkouts.length > 0 ? (
            <div className="space-y-3">
              {todayWorkouts.map((workout: Workout) => (
                <div key={workout.id} className="flex items-center justify-between p-3 bg-[var(--secondary)] rounded-lg">
                  <div>
                    <div className="font-medium text-[var(--foreground)]">{workout.name}</div>
                    <div className="text-sm text-[var(--muted-foreground)]">{workout.exercises.length} exercises</div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs ${workout.completed ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                    {workout.completed ? 'Completed' : 'Pending'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              <div className="text-4xl mb-2">💪</div>
              <div>No workouts scheduled for today</div>
            </div>
          )}
        </Card>

        {/* Today's Nutrition */}
        <Card title="Today's Nutrition">
          {todayMeals.length > 0 ? (
            <div className="space-y-3">
              {todayMeals.slice(0, 3).map((meal: Meal) => (
                <div key={meal.id} className="flex items-center justify-between p-3 bg-[var(--secondary)] rounded-lg">
                  <div>
                    <div className="font-medium text-[var(--foreground)]">{meal.name}</div>
                    <div className="text-sm text-[var(--muted-foreground)] capitalize">{meal.type}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-[var(--foreground)]">{meal.calories} cal</div>
                    <div className="text-xs text-[var(--muted-foreground)]">P: {meal.protein}g C: {meal.carbs}g F: {meal.fat}g</div>
                  </div>
                </div>
              ))}
              {todayMeals.length > 3 && (
                <div className="text-center text-sm text-[var(--muted-foreground)]">
                  +{todayMeals.length - 3} more meals
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              <div className="text-4xl mb-2">🍽️</div>
              <div>No meals logged today</div>
            </div>
          )}
        </Card>
      </div>

      {/* Recent Progress */}
      {recentProgress && (
        <Card title="Latest Progress">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {recentProgress.weight && (
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--primary)]">{recentProgress.weight} kg</div>
                <div className="text-sm text-[var(--muted-foreground)]">Weight</div>
              </div>
            )}
            {recentProgress.bodyFat && (
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{recentProgress.bodyFat}%</div>
                <div className="text-sm text-[var(--muted-foreground)]">Body Fat</div>
              </div>
            )}
            {recentProgress.muscle && (
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{recentProgress.muscle} kg</div>
                <div className="text-sm text-[var(--muted-foreground)]">Muscle Mass</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{new Date(recentProgress.date).toLocaleDateString()}</div>
              <div className="text-sm text-[var(--muted-foreground)]">Last Update</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* -------------------- Clients Page -------------------- */
function ClientsPage() {
  const { users, session, getUser } = useAuth();
  const { push } = useToast();
  const user = session ? getUser(session.userId) : null;
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '' });

  const clients = users.filter(u => u.role === 'client' && u.trainerId === user?.id);

  const handleAddClient = () => {
    if (!newClient.name || !newClient.email) {
      push("Please fill in all required fields", { type: "error" });
      return;
    }
    
    // In a real app, you'd send an invitation
    push(`Invitation sent to ${newClient.email}`, { type: "success" });
    setNewClient({ name: '', email: '', phone: '' });
    setShowAddClient(false);
  };

  if (user?.role !== 'trainer') {
    return (
      <Card title="Access Restricted">
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🚫</div>
          <div className="text-[var(--muted-foreground)]">This page is only available to trainers</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">My Clients</h2>
        <Button onClick={() => setShowAddClient(true)}>Add New Client</Button>
      </div>

      {clients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map(client => (
            <Card key={client.id}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                  {client.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="font-semibold text-[var(--foreground)]">{client.name}</div>
                  <div className="text-sm text-[var(--muted-foreground)]">{client.email}</div>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Joined:</span>
                  <span className="text-[var(--foreground)]">{client.dateJoined ? new Date(client.dateJoined).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Phone:</span>
                  <span className="text-[var(--foreground)]">{client.phone || 'Not provided'}</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1">View Progress</Button>
                <Button size="sm" variant="ghost" className="flex-1">Message</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">No clients yet</h3>
            <p className="text-[var(--muted-foreground)] mb-6">Start building your client base by adding your first client</p>
            <Button onClick={() => setShowAddClient(true)}>Add Your First Client</Button>
          </div>
        </Card>
      )}

      <Modal isOpen={showAddClient} onClose={() => setShowAddClient(false)} title="Add New Client">
        <div className="space-y-4">
          <Input
            label="Client Name *"
            value={newClient.name}
            onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
            placeholder="Enter client's full name"
            