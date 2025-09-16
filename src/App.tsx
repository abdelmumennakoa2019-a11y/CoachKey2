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
            required
          />
          <Input
            label="Email Address *"
            type="email"
            value={newClient.email}
            onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
            placeholder="client@example.com"
            required
          />
          <Input
            label="Phone Number"
            type="tel"
            value={newClient.phone}
            onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
            placeholder="+1 (555) 123-4567"
          />
          <div className="flex gap-3 pt-4">
            <Button onClick={handleAddClient} className="flex-1">Send Invitation</Button>
            <Button variant="secondary" onClick={() => setShowAddClient(false)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* -------------------- Workouts Page -------------------- */
function WorkoutsPage() {
  const { appData, addWorkout, updateWorkout, deleteWorkout } = useData();
  const { push } = useToast();
  const [showCreateWorkout, setShowCreateWorkout] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [newWorkout, setNewWorkout] = useState({
    name: '',
    exercises: [] as WorkoutExercise[]
  });
  const [newExercise, setNewExercise] = useState({
    name: '',
    sets: 3,
    reps: 10,
    weight: 0
  });

  const workouts = appData.workouts || [];

  const handleCreateWorkout = () => {
    if (!newWorkout.name) {
      push("Please enter a workout name", { type: "error" });
      return;
    }
    if (newWorkout.exercises.length === 0) {
      push("Please add at least one exercise", { type: "error" });
      return;
    }

    addWorkout(newWorkout);
    push("Workout created successfully", { type: "success" });
    setNewWorkout({ name: '', exercises: [] });
    setShowCreateWorkout(false);
  };

  const handleAddExercise = () => {
    if (!newExercise.name) {
      push("Please enter exercise name", { type: "error" });
      return;
    }

    const exercise: WorkoutExercise = {
      id: uid(),
      ...newExercise
    };

    setNewWorkout(prev => ({
      ...prev,
      exercises: [...prev.exercises, exercise]
    }));

    setNewExercise({ name: '', sets: 3, reps: 10, weight: 0 });
  };

  const handleCompleteWorkout = (workoutId: string) => {
    updateWorkout(workoutId, { completed: true });
    push("Workout completed! Great job! 💪", { type: "success" });
  };

  const handleDeleteWorkout = (workoutId: string) => {
    deleteWorkout(workoutId);
    push("Workout deleted", { type: "success" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Workouts</h2>
        <Button onClick={() => setShowCreateWorkout(true)}>Create Workout</Button>
      </div>

      {workouts.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {workouts.map((workout: Workout) => (
            <Card key={workout.id}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">{workout.name}</h3>
                  <div className="text-sm text-[var(--muted-foreground)]">
                    {new Date(workout.date).toLocaleDateString()} • {workout.exercises.length} exercises
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  workout.completed 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                }`}>
                  {workout.completed ? 'Completed' : 'Pending'}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {workout.exercises.slice(0, 3).map((exercise: WorkoutExercise) => (
                  <div key={exercise.id} className="flex items-center justify-between p-2 bg-[var(--secondary)] rounded">
                    <span className="text-[var(--foreground)]">{exercise.name}</span>
                    <span className="text-sm text-[var(--muted-foreground)]">
                      {exercise.sets} × {exercise.reps} {exercise.weight ? `@ ${exercise.weight}kg` : ''}
                    </span>
                  </div>
                ))}
                {workout.exercises.length > 3 && (
                  <div className="text-center text-sm text-[var(--muted-foreground)]">
                    +{workout.exercises.length - 3} more exercises
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {!workout.completed && (
                  <Button size="sm" onClick={() => handleCompleteWorkout(workout.id)} className="flex-1">
                    Complete Workout
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setEditingWorkout(workout)} className="flex-1">
                  View Details
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDeleteWorkout(workout.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">💪</div>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">No workouts yet</h3>
            <p className="text-[var(--muted-foreground)] mb-6">Create your first workout to get started</p>
            <Button onClick={() => setShowCreateWorkout(true)}>Create Your First Workout</Button>
          </div>
        </Card>
      )}

      {/* Create Workout Modal */}
      <Modal isOpen={showCreateWorkout} onClose={() => setShowCreateWorkout(false)} title="Create New Workout">
        <div className="space-y-6">
          <Input
            label="Workout Name *"
            value={newWorkout.name}
            onChange={(e) => setNewWorkout({ ...newWorkout, name: e.target.value })}
            placeholder="e.g., Upper Body Strength"
            required
          />

          <div>
            <h4 className="font-medium text-[var(--foreground)] mb-3">Add Exercises</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <Input
                label="Exercise Name"
                value={newExercise.name}
                onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
                placeholder="e.g., Push-ups"
              />
              <Input
                label="Sets"
                type="number"
                value={newExercise.sets}
                onChange={(e) => setNewExercise({ ...newExercise, sets: parseInt(e.target.value) || 0 })}
              />
              <Input
                label="Reps"
                type="number"
                value={newExercise.reps}
                onChange={(e) => setNewExercise({ ...newExercise, reps: parseInt(e.target.value) || 0 })}
              />
              <Input
                label="Weight (kg)"
                type="number"
                value={newExercise.weight}
                onChange={(e) => setNewExercise({ ...newExercise, weight: parseInt(e.target.value) || 0 })}
              />
            </div>
            <Button size="sm" variant="secondary" onClick={handleAddExercise} className="w-full">
              Add Exercise
            </Button>
          </div>

          {newWorkout.exercises.length > 0 && (
            <div>
              <h4 className="font-medium text-[var(--foreground)] mb-3">Exercises ({newWorkout.exercises.length})</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {newWorkout.exercises.map((exercise, index) => (
                  <div key={exercise.id} className="flex items-center justify-between p-2 bg-[var(--secondary)] rounded">
                    <span className="text-[var(--foreground)]">{exercise.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--muted-foreground)]">
                        {exercise.sets} × {exercise.reps} {exercise.weight ? `@ ${exercise.weight}kg` : ''}
                      </span>
                      <button
                        onClick={() => setNewWorkout(prev => ({
                          ...prev,
                          exercises: prev.exercises.filter((_, i) => i !== index)
                        }))}
                        className="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button onClick={handleCreateWorkout} className="flex-1">Create Workout</Button>
            <Button variant="secondary" onClick={() => setShowCreateWorkout(false)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Workout Details Modal */}
      <Modal 
        isOpen={!!editingWorkout} 
        onClose={() => setEditingWorkout(null)} 
        title={editingWorkout?.name || "Workout Details"}
      >
        {editingWorkout && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[var(--muted-foreground)]">Date:</span>
                <div className="font-medium text-[var(--foreground)]">{new Date(editingWorkout.date).toLocaleDateString()}</div>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Status:</span>
                <div className={`font-medium ${editingWorkout.completed ? 'text-green-600' : 'text-yellow-600'}`}>
                  {editingWorkout.completed ? 'Completed' : 'Pending'}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-[var(--foreground)] mb-3">Exercises</h4>
              <div className="space-y-2">
                {editingWorkout.exercises.map((exercise: WorkoutExercise) => (
                  <div key={exercise.id} className="p-3 bg-[var(--secondary)] rounded-lg">
                    <div className="font-medium text-[var(--foreground)]">{exercise.name}</div>
                    <div className="text-sm text-[var(--muted-foreground)]">
                      {exercise.sets} sets × {exercise.reps} reps
                      {exercise.weight && ` @ ${exercise.weight}kg`}
                    </div>
                    {exercise.notes && (
                      <div className="text-sm text-[var(--muted-foreground)] mt-1">Notes: {exercise.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {!editingWorkout.completed && (
              <Button 
                onClick={() => {
                  handleCompleteWorkout(editingWorkout.id);
                  setEditingWorkout(null);
                }} 
                className="w-full"
              >
                Mark as Completed
              </Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* -------------------- Progress Page -------------------- */
function ProgressPage() {
  const { appData, addProgressEntry, updateProgressEntry, deleteProgressEntry } = useData();
  const { push } = useToast();
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({
    weight: '',
    bodyFat: '',
    muscle: '',
    measurements: {
      chest: '',
      waist: '',
      hips: '',
      arms: '',
      thighs: ''
    },
    notes: ''
  });

  const progressEntries = appData.progress || [];

  const handleAddEntry = () => {
    const entry: Partial<ProgressEntry> = {
      weight: newEntry.weight ? parseFloat(newEntry.weight) : undefined,
      bodyFat: newEntry.bodyFat ? parseFloat(newEntry.bodyFat) : undefined,
      muscle: newEntry.muscle ? parseFloat(newEntry.muscle) : undefined,
      measurements: {
        chest: newEntry.measurements.chest ? parseFloat(newEntry.measurements.chest) : undefined,
        waist: newEntry.measurements.waist ? parseFloat(newEntry.measurements.waist) : undefined,
        hips: newEntry.measurements.hips ? parseFloat(newEntry.measurements.hips) : undefined,
        arms: newEntry.measurements.arms ? parseFloat(newEntry.measurements.arms) : undefined,
        thighs: newEntry.measurements.thighs ? parseFloat(newEntry.measurements.thighs) : undefined,
      },
      notes: newEntry.notes || undefined
    };

    // Remove undefined values
    Object.keys(entry.measurements!).forEach(key => {
      if (entry.measurements![key as keyof typeof entry.measurements] === undefined) {
        delete entry.measurements![key as keyof typeof entry.measurements];
      }
    });

    if (Object.keys(entry.measurements!).length === 0) {
      delete entry.measurements;
    }

    addProgressEntry(entry);
    push("Progress entry added successfully", { type: "success" });
    setNewEntry({
      weight: '',
      bodyFat: '',
      muscle: '',
      measurements: { chest: '', waist: '', hips: '', arms: '', thighs: '' },
      notes: ''
    });
    setShowAddEntry(false);
  };

  const chartData = useMemo(() => {
    return progressEntries
      .slice()
      .reverse()
      .map((entry: ProgressEntry) => ({
        date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        weight: entry.weight || null,
        bodyFat: entry.bodyFat || null,
        muscle: entry.muscle || null
      }));
  }, [progressEntries]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Progress Tracking</h2>
        <Button onClick={() => setShowAddEntry(true)}>Add Entry</Button>
      </div>

      {progressEntries.length > 0 ? (
        <>
          {/* Progress Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Weight & Body Composition">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
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
                  <Line type="monotone" dataKey="weight" stroke="var(--primary)" name="Weight (kg)" strokeWidth={2} />
                  <Line type="monotone" dataKey="bodyFat" stroke="#f59e0b" name="Body Fat (%)" strokeWidth={2} />
                  <Line type="monotone" dataKey="muscle" stroke="#10b981" name="Muscle (kg)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Latest Measurements">
              {progressEntries[0]?.measurements ? (
                <div className="space-y-3">
                  {Object.entries(progressEntries[0].measurements).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center">
                      <span className="text-[var(--muted-foreground)] capitalize">{key}:</span>
                      <span className="font-medium text-[var(--foreground)]">{value} cm</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-[var(--muted-foreground)]">
                  <div className="text-4xl mb-2">📏</div>
                  <div>No measurements recorded yet</div>
                </div>
              )}
            </Card>
          </div>

          {/* Progress Entries List */}
          <Card title="Progress History">
            <div className="space-y-4">
              {progressEntries.slice(0, 5).map((entry: ProgressEntry) => (
                <div key={entry.id} className="p-4 bg-[var(--secondary)] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-[var(--foreground)]">
                      {new Date(entry.date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </div>
                    <Button size="sm" variant="danger" onClick={() => deleteProgressEntry(entry.id)}>
                      Delete
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {entry.weight && (
                      <div>
                        <span className="text-[var(--muted-foreground)]">Weight:</span>
                        <div className="font-medium text-[var(--foreground)]">{entry.weight} kg</div>
                      </div>
                    )}
                    {entry.bodyFat && (
                      <div>
                        <span className="text-[var(--muted-foreground)]">Body Fat:</span>
                        <div className="font-medium text-[var(--foreground)]">{entry.bodyFat}%</div>
                      </div>
                    )}
                    {entry.muscle && (
                      <div>
                        <span className="text-[var(--muted-foreground)]">Muscle:</span>
                        <div className="font-medium text-[var(--foreground)]">{entry.muscle} kg</div>
                      </div>
                    )}
                  </div>

                  {entry.notes && (
                    <div className="mt-2 text-sm text-[var(--muted-foreground)]">
                      <strong>Notes:</strong> {entry.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">Start tracking your progress</h3>
            <p className="text-[var(--muted-foreground)] mb-6">Record your measurements, weight, and body composition to see your fitness journey</p>
            <Button onClick={() => setShowAddEntry(true)}>Add Your First Entry</Button>
          </div>
        </Card>
      )}

      {/* Add Progress Entry Modal */}
      <Modal isOpen={showAddEntry} onClose={() => setShowAddEntry(false)} title="Add Progress Entry">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Weight (kg)"
              type="number"
              value={newEntry.weight}
              onChange={(e) => setNewEntry({ ...newEntry, weight: e.target.value })}
              placeholder="70.5"
            />
            <Input
              label="Body Fat (%)"
              type="number"
              value={newEntry.bodyFat}
              onChange={(e) => setNewEntry({ ...newEntry, bodyFat: e.target.value })}
              placeholder="15.2"
            />
            <Input
              label="Muscle Mass (kg)"
              type="number"
              value={newEntry.muscle}
              onChange={(e) => setNewEntry({ ...newEntry, muscle: e.target.value })}
              placeholder="45.8"
            />
          </div>

          <div>
            <h4 className="font-medium text-[var(--foreground)] mb-3">Body Measurements (cm)</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Input
                label="Chest"
                type="number"
                value={newEntry.measurements.chest}
                onChange={(e) => setNewEntry({ 
                  ...newEntry, 
                  measurements: { ...newEntry.measurements, chest: e.target.value }
                })}
                placeholder="100"
              />
              <Input
                label="Waist"
                type="number"
                value={newEntry.measurements.waist}
                onChange={(e) => setNewEntry({ 
                  ...newEntry, 
                  measurements: { ...newEntry.measurements, waist: e.target.value }
                })}
                placeholder="80"
              />
              <Input
                label="Hips"
                type="number"
                value={newEntry.measurements.hips}
                onChange={(e) => setNewEntry({ 
                  ...newEntry, 
                  measurements: { ...newEntry.measurements, hips: e.target.value }
                })}
                placeholder="95"
              />
              <Input
                label="Arms"
                type="number"
                value={newEntry.measurements.arms}
                onChange={(e) => setNewEntry({ 
                  ...newEntry, 
                  measurements: { ...newEntry.measurements, arms: e.target.value }
                })}
                placeholder="35"
              />
              <Input
                label="Thighs"
                type="number"
                value={newEntry.measurements.thighs}
                onChange={(e) => setNewEntry({ 
                  ...newEntry, 
                  measurements: { ...newEntry.measurements, thighs: e.target.value }
                })}
                placeholder="55"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Notes</label>
            <textarea
              value={newEntry.notes}
              onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
              placeholder="Any additional notes about your progress..."
              className="w-full p-2 border border-[var(--input)] rounded-lg bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200 resize-none"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleAddEntry} className="flex-1">Add Entry</Button>
            <Button variant="secondary" onClick={() => setShowAddEntry(false)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* -------------------- Stats Page -------------------- */
function StatsPage() {
  const { appData } = useData();
  const { session, getUser } = useAuth();
  const user = session ? getUser(session.userId) : null;

  const stats = useMemo(() => {
    const workouts = appData.workouts || [];
    const meals = appData.meals || [];
    const progress = appData.progress || [];

    const completedWorkouts = workouts.filter((w: Workout) => w.completed);
    const totalWorkouts = workouts.length;
    const completionRate = totalWorkouts > 0 ? Math.round((completedWorkouts.length / totalWorkouts) * 100) : 0;

    const totalCalories = meals.reduce((sum: number, meal: Meal) => sum + meal.calories, 0);
    const avgDailyCalories = meals.length > 0 ? Math.round(totalCalories / meals.length) : 0;

    const currentWeight = progress.length > 0 ? progress[0].weight : null;
    const oldestWeight = progress.length > 1 ? progress[progress.length - 1].weight : null;
    const weightChange = currentWeight && oldestWeight ? currentWeight - oldestWeight : null;

    // Weekly activity
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    const weeklyActivity = last7Days.map(date => {
      const dayWorkouts = workouts.filter((w: Workout) => w.date === date && w.completed);
      const dayMeals = meals.filter((m: Meal) => m.date === date);
      const dayCalories = dayMeals.reduce((sum: number, meal: Meal) => sum + meal.calories, 0);
      
      return {
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        workouts: dayWorkouts.length,
        calories: Math.round(dayCalories / 100), // Scale for chart
        meals: dayMeals.length
      };
    });

    // Exercise frequency
    const exerciseFrequency: { [key: string]: number } = {};
    completedWorkouts.forEach((workout: Workout) => {
      workout.exercises.forEach((exercise: WorkoutExercise) => {
        exerciseFrequency[exercise.name] = (exerciseFrequency[exercise.name] || 0) + 1;
      });
    });

    const topExercises = Object.entries(exerciseFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Meal type distribution
    const mealTypes = meals.reduce((acc: any, meal: Meal) => {
      acc[meal.type] = (acc[meal.type] || 0) + 1;
      return acc;
    }, {});

    const mealDistribution = Object.entries(mealTypes).map(([type, count]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: count as number
    }));

    return {
      completedWorkouts: completedWorkouts.length,
      totalWorkouts,
      completionRate,
      totalCalories,
      avgDailyCalories,
      currentWeight,
      weightChange,
      weeklyActivity,
      topExercises,
      mealDistribution,
      progressEntries: progress.length
    };
  }, [appData]);

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Fitness Statistics</h2>
        <div className="text-sm text-[var(--muted-foreground)]">
          Your complete fitness overview
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="text-center">
          <div className="text-3xl font-bold text-[var(--primary)] mb-2">{stats.completedWorkouts}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Workouts Completed</div>
          <div className="text-xs text-[var(--muted-foreground)] mt-1">
            {stats.completionRate}% completion rate
          </div>
        </Card>
        
        <Card className="text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">{stats.avgDailyCalories}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Avg Daily Calories</div>
          <div className="text-xs text-[var(--muted-foreground)] mt-1">
            {stats.totalCalories.toLocaleString()} total logged
          </div>
        </Card>

        <Card className="text-center">
          <div className="text-3xl font-bold text-purple-600 mb-2">{stats.progressEntries}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Progress Entries</div>
          {stats.currentWeight && (
            <div className="text-xs text-[var(--muted-foreground)] mt-1">
              Current: {stats.currentWeight}kg
            </div>
          )}
        </Card>

        <Card className="text-center">
          <div className={`text-3xl font-bold mb-2 ${stats.weightChange && stats.weightChange > 0 ? 'text-green-600' : stats.weightChange && stats.weightChange < 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {stats.weightChange ? `${stats.weightChange > 0 ? '+' : ''}${stats.weightChange.toFixed(1)}kg` : 'N/A'}
          </div>
          <div className="text-sm text-[var(--muted-foreground)]">Weight Change</div>
          <div className="text-xs text-[var(--muted-foreground)] mt-1">
            Since first entry
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity */}
        <Card title="Weekly Activity">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.weeklyActivity}>
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
              <Bar dataKey="meals" fill="#10b981" name="Meals" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Meal Distribution */}
        <Card title="Meal Type Distribution">
          {stats.mealDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.mealDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.mealDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--card)', 
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--foreground)'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              <div className="text-4xl mb-2">🍽️</div>
              <div>No meals logged yet</div>
            </div>
          )}
        </Card>
      </div>

      {/* Top Exercises */}
      <Card title="Most Performed Exercises">
        {stats.topExercises.length > 0 ? (
          <div className="space-y-3">
            {stats.topExercises.map((exercise, index) => (
              <div key={exercise.name} className="flex items-center justify-between p-3 bg-[var(--secondary)] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[var(--primary)] text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <span className="font-medium text-[var(--foreground)]">{exercise.name}</span>
                </div>
                <div className="text-[var(--muted-foreground)]">
                  {exercise.count} times
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--muted-foreground)]">
            <div className="text-4xl mb-2">💪</div>
            <div>Complete some workouts to see your top exercises</div>
          </div>
        )}
      </Card>

      {/* Achievement Badges */}
      <Card title="Achievements">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`text-center p-4 rounded-lg ${stats.completedWorkouts >= 1 ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <div className="text-2xl mb-2">🏃‍♂️</div>
            <div className="text-sm font-medium">First Workout</div>
            <div className="text-xs text-[var(--muted-foreground)]">Complete 1 workout</div>
          </div>
          
          <div className={`text-center p-4 rounded-lg ${stats.completedWorkouts >= 10 ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <div className="text-2xl mb-2">💪</div>
            <div className="text-sm font-medium">Consistent</div>
            <div className="text-xs text-[var(--muted-foreground)]">Complete 10 workouts</div>
          </div>
          
          <div className={`text-center p-4 rounded-lg ${stats.progressEntries >= 5 ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <div className="text-2xl mb-2">📊</div>
            <div className="text-sm font-medium">Progress Tracker</div>
            <div className="text-xs text-[var(--muted-foreground)]">Log 5 progress entries</div>
          </div>
          
          <div className={`text-center p-4 rounded-lg ${stats.completionRate >= 80 ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <div className="text-2xl mb-2">🎯</div>
            <div className="text-sm font-medium">High Achiever</div>
            <div className="text-xs text-[var(--muted-foreground)]">80% completion rate</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* -------------------- Meals Page -------------------- */
function MealsPage() {
  const { appData, logMeal, updateMeal, deleteMeal } = useData();
  const { push } = useToast();
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [newMeal, setNewMeal] = useState({
    name: '',
    type: 'breakfast' as 'breakfast' | 'lunch' | 'dinner' | 'snack',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    notes: ''
  });

  const meals = appData.meals || [];
  const today = new Date().toISOString().split('T')[0];
  const todayMeals = meals.filter((m: Meal) => m.date === today);

  const handleAddMeal = () => {
    if (!newMeal.name || !newMeal.calories) {
      push("Please fill in meal name and calories", { type: "error" });
      return;
    }

    const meal: Partial<Meal> = {
      name: newMeal.name,
      type: newMeal.type,
      calories: parseInt(newMeal.calories),
      protein: parseInt(newMeal.protein) || 0,
      carbs: parseInt(newMeal.carbs) || 0,
      fat: parseInt(newMeal.fat) || 0,
      notes: newMeal.notes || undefined
    };

    logMeal(meal);
    push("Meal logged successfully", { type: "success" });
    setNewMeal({
      name: '',
      type: 'breakfast',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      notes: ''
    });
    setShowAddMeal(false);
  };

  const todayTotals = useMemo(() => {
    return todayMeals.reduce((totals, meal: Meal) => ({
      calories: totals.calories + meal.calories,
      protein: totals.protein + meal.protein,
      carbs: totals.carbs + meal.carbs,
      fat: totals.fat + meal.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }, [todayMeals]);

  const mealsByType = useMemo(() => {
    const grouped = todayMeals.reduce((acc: any, meal: Meal) => {
      if (!acc[meal.type]) acc[meal.type] = [];
      acc[meal.type].push(meal);
      return acc;
    }, {});

    return {
      breakfast: grouped.breakfast || [],
      lunch: grouped.lunch || [],
      dinner: grouped.dinner || [],
      snack: grouped.snack || []
    };
  }, [todayMeals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--foreground)]">Nutrition Tracking</h2>
          <p className="text-[var(--muted-foreground)]">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <Button onClick={() => setShowAddMeal(true)}>Log Meal</Button>
      </div>

      {/* Daily Totals */}
      <Card title="Today's Nutrition">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-[var(--primary)] mb-1">{todayTotals.calories}</div>
            <div className="text-sm text-[var(--muted-foreground)]">Calories</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 mb-1">{todayTotals.protein}g</div>
            <div className="text-sm text-[var(--muted-foreground)]">Protein</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600 mb-1">{todayTotals.carbs}g</div>
            <div className="text-sm text-[var(--muted-foreground)]">Carbs</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">{todayTotals.fat}g</div>
            <div className="text-sm text-[var(--muted-foreground)]">Fat</div>
          </div>
        </div>
      </Card>

      {/* Meals by Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(mealsByType).map(([type, typeMeals]) => (
          <Card key={type} title={type.charAt(0).toUpperCase() + type.slice(1)}>
            {(typeMeals as Meal[]).length > 0 ? (
              <div className="space-y-3">
                {(typeMeals as Meal[]).map((meal: Meal) => (
                  <div key={meal.id} className="p-3 bg-[var(--secondary)] rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-[var(--foreground)]">{meal.name}</div>
                      <Button size="sm" variant="danger" onClick={() => deleteMeal(meal.id)}>
                        ×
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-[var(--muted-foreground)]">
                      <div>Calories: {meal.calories}</div>
                      <div>Protein: {meal.protein}g</div>
                      <div>Carbs: {meal.carbs}g</div>
                      <div>Fat: {meal.fat}g</div>
                    </div>
                    {meal.notes && (
                      <div className="text-sm text-[var(--muted-foreground)] mt-2">
                        Notes: {meal.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--muted-foreground)]">
                <div className="text-3xl mb-2">🍽️</div>
                <div className="text-sm">No {type} logged</div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Recent Meals */}
      {meals.length > 0 && (
        <Card title="Recent Meals">
          <div className="space-y-3">
            {meals.slice(0, 10).map((meal: Meal) => (
              <div key={meal.id} className="flex items-center justify-between p-3 bg-[var(--secondary)] rounded-lg">
                <div>
                  <div className="font-medium text-[var(--foreground)]">{meal.name}</div>
                  <div className="text-sm text-[var(--muted-foreground)]">
                    {new Date(meal.date).toLocaleDateString()} • {meal.type} • {meal.calories} cal
                  </div>
                </div>
                <Button size="sm" variant="danger" onClick={() => deleteMeal(meal.id)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add Meal Modal */}
      <Modal isOpen={showAddMeal} onClose={() => setShowAddMeal(false)} title="Log New Meal">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Meal Name *"
              value={newMeal.name}
              onChange={(e) => setNewMeal({ ...newMeal, name: e.target.value })}
              placeholder="e.g., Grilled Chicken Salad"
              required
            />
            <Select
              label="Meal Type"
              value={newMeal.type}
              onChange={(e) => setNewMeal({ ...newMeal, type: e.target.value as any })}
              options={[
                { value: 'breakfast', label: 'Breakfast' },
                { value: 'lunch', label: 'Lunch' },
                { value: 'dinner', label: 'Dinner' },
                { value: 'snack', label: 'Snack' }
              ]}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Input
              label="Calories *"
              type="number"
              value={newMeal.calories}
              onChange={(e) => setNewMeal({ ...newMeal, calories: e.target.value })}
              placeholder="450"
              required
            />
            <Input
              label="Protein (g)"
              type="number"
              value={newMeal.protein}
              onChange={(e) => setNewMeal({ ...newMeal, protein: e.target.value })}
              placeholder="25"
            />
            <Input
              label="Carbs (g)"
              type="number"
              value={newMeal.carbs}
              onChange={(e) => setNewMeal({ ...newMeal, carbs: e.target.value })}
              placeholder="30"
            />
            <Input
              label="Fat (g)"
              type="number"
              value={newMeal.fat}
              onChange={(e) => setNewMeal({ ...newMeal, fat: e.target.value })}
              placeholder="15"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Notes</label>
            <textarea
              value={newMeal.notes}
              onChange={(e) => setNewMeal({ ...newMeal, notes: e.target.value })}
              placeholder="Any additional notes about this meal..."
              className="w-full p-2 border border-[var(--input)] rounded-lg bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200 resize-none"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleAddMeal} className="flex-1">Log Meal</Button>
            <Button variant="secondary" onClick={() => setShowAddMeal(false)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* -------------------- Chat Page -------------------- */
function ChatPage() {
  const { appData, sendMessage, markMessageRead } = useData();
  const { session, getUser, users } = useAuth();
  const { push } = useToast();
  const [newMessage, setNewMessage] = useState('');
  const [selectedContact, setSelectedContact] = useState<string | null>(null);

  const user = session ? getUser(session.userId) : null;
  const messages = appData.messages || [];

  // Get potential contacts (trainer-client relationships)
  const contacts = useMemo(() => {
    if (!user) return [];
    
    if (user.role === 'trainer') {
      return users.filter(u => u.role === 'client' && u.trainerId === user.id);
    } else {
      const trainer = users.find(u => u.id === user.trainerId);
      return trainer ? [trainer] : [];
    }
  }, [user, users]);

  // Get messages for selected contact
  const contactMessages = useMemo(() => {
    if (!selectedContact || !user) return [];
    
    return messages
      .filter((m: Message) => 
        (m.senderId === user.id && m.receiverId === selectedContact) ||
        (m.senderId === selectedContact && m.receiverId === user.id)
      )
      .sort((a: Message, b: Message) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages, selectedContact, user]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedContact || !user) {
      push("Please enter a message", { type: "error" });
      return;
    }

    sendMessage({
      senderId: user.id,
      receiverId: selectedContact,
      content: newMessage.trim()
    });

    setNewMessage('');
    push("Message sent", { type: "success" });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[var(--foreground)]">Messages</h2>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
        {/* Contacts List */}
        <Card title="Contacts" className="lg:col-span-1">
          {contacts.length > 0 ? (
            <div className="space-y-2">
              {contacts.map(contact => {
                const unreadCount = messages.filter((m: Message) => 
                  m.senderId === contact.id && m.receiverId === user?.id && !m.read
                ).length;

                return (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContact(contact.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                      selectedContact === contact.id 
                        ? 'bg-[var(--primary)] text-white' 
                        : 'bg-[var(--secondary)] hover:bg-[var(--accent)] text-[var(--foreground)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{contact.name}</div>
                        <div className="text-sm opacity-75">{contact.role}</div>
                      </div>
                      {unreadCount > 0 && (
                        <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadCount}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              <div className="text-4xl mb-2">👥</div>
              <div className="text-sm">No contacts available</div>
            </div>
          )}
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-3 flex flex-col">
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
                <div>
                  <div className="font-semibold text-[var(--foreground)]">
                    {contacts.find(c => c.id === selectedContact)?.name}
                  </div>
                  <div className="text-sm text-[var(--muted-foreground)]">
                    {contacts.find(c => c.id === selectedContact)?.role}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
                {contactMessages.length > 0 ? (
                  contactMessages.map((message: Message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.senderId === user?.id
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-[var(--secondary)] text-[var(--foreground)]'
                        }`}
                      >
                        <div className="text-sm">{message.content}</div>
                        <div className={`text-xs mt-1 ${
                          message.senderId === user?.id ? 'text-blue-100' : 'text-[var(--muted-foreground)]'
                        }`}>
                          {new Date(message.timestamp).toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-[var(--muted-foreground)]">
                    <div className="text-4xl mb-2">💬</div>
                    <div>No messages yet. Start the conversation!</div>
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="pt-4 border-t border-[var(--border)]">
                <div className="flex gap-2">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-1 p-2 border border-[var(--input)] rounded-lg bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200 resize-none"
                    rows={2}
                  />
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                    Send
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--muted-foreground)]">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <div className="text-lg">Select a contact to start messaging</div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* -------------------- Settings Page -------------------- */
function SettingsPage() {
  const { settings, update } = useSettings();
  return (
    <div className="max-w-4xl">
      <SettingsPanel external={{ settings, update }} />
    </div>
  );
}

/* -------------------- Login Page -------------------- */
function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const { login, register } = useAuth();
  const { push } = useToast();
  const [view, setView] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ 
    email: "", 
    password: "", 
    name: "", 
    role: "client",
    phone: ""
  });
  const { settings } = useSettings();

  const handleLogin = (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      const user = login({ email: form.email, password: form.password });
      push(`Welcome back, ${user.name}!`, { type: "success" });
      onSuccess();
    } catch (err: any) {
      push(err?.message || "Login failed", { type: "error" });
    }
  };

  const handleRegister = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.name || !form.email || !form.password) {
      push("Please fill in all required fields", { type: "error" });
      return;
    }
    
    try {
      const user = register({ 
        name: form.name, 
        email: form.email, 
        password: form.password, 
        role: form.role as any,
        phone: form.phone || undefined
      });
      push(`Account created for ${user.name}`, { type: "success" });
      // auto-login
      login({ email: form.email, password: form.password });
      onSuccess();
    } catch (err: any) {
      push(err?.message || "Registration failed", { type: "error" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--background)] to-[var(--muted)] transition-colors duration-300">
      <div className={`max-w-4xl w-full grid md:grid-cols-2 gap-6 ${settings.compact ? 'p-3' : 'p-6'}`}>
        <div className="hidden md:flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-[var(--primary)] to-indigo-600 text-white rounded-lg p-8 transition-all duration-300 ease-in-out hover:scale-105">
          <LogoPlaceholder size={72} />
          <div className="text-3xl font-bold">FitnessPro</div>
          <p className="text-center text-lg opacity-90">Your complete fitness companion for trainers and clients.</p>
          <div className="text-sm opacity-75 text-center">
            <div>✓ Track workouts and progress</div>
            <div>✓ Monitor nutrition and meals</div>
            <div>✓ Connect with trainers/clients</div>
            <div>✓ Comprehensive analytics</div>
          </div>
        </div>

        <div className={`bg-[var(--card)] rounded-lg shadow-xl border border-[var(--border)] transition-all duration-300 ease-in-out ${settings.compact ? 'p-4' : 'p-8'} ${settings.animations ? 'animate-slide-up' : ''}`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-[var(--card-foreground)]">
              {view === "login" ? "Welcome Back" : "Create Account"}
            </h2>
            <div className="md:hidden">
              <LogoPlaceholder size={40} />
            </div>
          </div>

          {view === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Enter your email"
                required
              />
              <Input
                label="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter your password"
                required
              />
              
              <div className="text-sm text-[var(--muted-foreground)] bg-[var(--secondary)] p-3 rounded-lg">
                <div className="font-medium mb-1">Demo Accounts:</div>
                <div>Trainer: trainer@fit.app / trainer</div>
                <div>Client: client@fit.app / client</div>
              </div>

              <div className="flex flex-col gap-3">
                <Button type="submit" className="w-full">
                  Sign In
                </Button>
                <button 
                  type="button" 
                  onClick={() => setView("register")} 
                  className="text-sm text-[var(--primary)] hover:underline transition-colors duration-200"
                >
                  Don't have an account? Create one
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <Input
                label="Full Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter your full name"
                required
              />
              <Select
                label="Account Type"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                options={[
                  { value: 'client', label: 'Client - Track my fitness journey' },
                  { value: 'trainer', label: 'Trainer - Manage clients' }
                ]}
              />
              <Input
                label="Email Address *"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Enter your email"
                required
              />
              <Input
                label="Phone Number"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
              <Input
                label="Password *"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Create a password"
                required
              />
              
              <div className="flex flex-col gap-3">
                <Button type="submit" className="w-full">
                  Create Account
                </Button>
                <button 
                  type="button" 
                  onClick={() => setView("login")} 
                  className="text-sm text-[var(--primary)] hover:underline transition-colors duration-200"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- Main App Shell -------------------- */
function MainAppShell({ setRoute }: { setRoute: (r: "login" | "app") => void }) {
  const { session, logout, getUser } = useAuth();
  const me = session ? getUser(session.userId) : null;
  const [page, setPage] = useState<string>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { push } = useToast();
  const { settings } = useSettings();

  useEffect(() => setPage("dashboard"), []);

  const handleLogout = () => {
    logout();
    setRoute("login");
  };

  const navItems = me?.role === "trainer" 
    ? ["dashboard", "clients", "workouts", "progress", "stats", "meals", "chat", "settings"] 
    : ["dashboard", "workouts", "meals", "progress", "stats", "chat", "settings"];

  const getPageIcon = (pageName: string) => {
    const icons: { [key: string]: string } = {
      dashboard: "📊",
      clients: "👥",
      workouts: "💪",
      progress: "📈",
      stats: "📋",
      meals: "🍽️",
      chat: "💬",
      settings: "⚙️"
    };
    return icons[pageName] || "📄";
  };

  const renderPage = () => {
    switch (page) {
      case "dashboard": return <DashboardPage />;
      case "clients": return <ClientsPage />;
      case "workouts": return <WorkoutsPage />;
      case "progress": return <ProgressPage />;
      case "stats": return <StatsPage />;
      case "settings": return <SettingsPage />;
      case "meals": return <MealsPage />;
      case "chat": return <ChatPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[var(--card)] border-r border-[var(--border)] shadow-lg transform transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:static md:translate-x-0 md:flex md:flex-col`}>
        <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
          <LogoPlaceholder size={48} />
          <div>
            <div className="font-bold text-lg text-[var(--card-foreground)]">FitnessPro</div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {me?.role ? `${me.role.charAt(0).toUpperCase() + me.role.slice(1)} Portal` : "Portal"}
            </div>
          </div>
        </div>
        <nav className={`flex flex-col gap-1 ${settings.compact ? 'p-2' : 'p-4'} flex-1`}>
          {navItems.map((p) => (
            <button 
              key={p} 
              onClick={() => { setPage(p); setSidebarOpen(false); }} 
              className={`flex items-center gap-3 text-left px-3 py-2 rounded-lg transition-all duration-200 ease-in-out hover:scale-105 ${
                page === p 
                  ? "bg-[var(--primary)] text-white shadow-md" 
                  : "hover:bg-[var(--secondary)] text-[var(--card-foreground)]"
              }`}
            >
              <span className="text-lg">{getPageIcon(p)}</span>
              <span className="font-medium">{p.charAt(0).toUpperCase() + p.slice(1)}</span>
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-[var(--border)]">
          <div className="text-xs text-[var(--muted-foreground)] text-center">
            FitnessPro v1.0
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 md:hidden z-30" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col overflow-hidden min-h-screen">
        <TopBar 
          title={page.charAt(0).toUpperCase() + page.slice(1)} 
          onLogout={handleLogout} 
          onToggleSidebar={() => setSidebarOpen((s) => !s)} 
        />
        <div className={`flex-1 overflow-y-auto transition-all duration-300 ease-in-out ${settings.compact ? 'p-3' : 'p-6'} ${settings.animations ? 'animate-fade-in' : ''}`}>
          {renderPage()}
        </div>
      </div>
    </div>
  );
}

/* -------------------- App (root) -------------------- */
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [route, setRoute] = useState<"loading" | "login" | "app">("loading");

  useEffect(() => {
    const t = setTimeout(() => {
      setLoaded(true);
      setRoute("login");
    }, 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { save("userData", userData); }, [userData]);
    <SettingsProvider>
      <AuthProvider>
        <DataProvider>
          <ToastProvider>
            <div className="h-screen w-screen flex flex-col font-sans transition-colors duration-300 overflow-hidden">
              {route === "loading" && <LoadingScreen />}
              {route === "login" && <LoginPage onSuccess={() => setRoute("app")} />}
              {route === "app" && <MainAppShell setRoute={(r) => setRoute(r)} />}
            </div>
          </ToastProvider>
        </DataProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}