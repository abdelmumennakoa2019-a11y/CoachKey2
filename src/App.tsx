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
import type { User, Workout, Meal, Message, ProgressEntry, AppSettings, Toast, ValidationError, UserRole } from './types';
import { validateData, userRegistrationSchema, clientCreationSchema, workoutSchema, mealSchema, progressSchema, messageSchema, getPasswordStrength, sanitizeString, sanitizeNumber } from './utils/validation';
import { db } from './services/database';
import { firebaseAuth } from './services/firebase';

/* -------------------- Utilities -------------------- */
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const save = (k: string, v: any) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(k, JSON.stringify(v));
  }
};

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

/* -------------------- Toast System -------------------- */
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
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`w-full px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out animate-toast-in ${
              t.type === "error" ? "bg-red-600 text-white" : 
              t.type === "success" ? "bg-green-600 text-white" : 
              t.type === "warning" ? "bg-yellow-600 text-white" :
              "bg-white text-gray-900 border dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
            }`}
          >
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 text-sm">{t.msg}</div>
              <button onClick={() => remove(t.id)} className="text-xs opacity-70 hover:opacity-100 ml-2">
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

/* -------------------- Settings Context -------------------- */
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  primary: '#2563eb',
  compact: false,
  animations: true,
  timezone: typeof Intl !== 'undefined' ? (Intl as any).DateTimeFormat?.()?.resolvedOptions?.().timeZone || 'UTC' : 'UTC',
  telemetry: true,
  notifications: true,
  language: 'en',
};

const SettingsContext = createContext<{ settings: AppSettings; update: (patch: Partial<AppSettings>) => void } | null>(null);

function SettingsProvider({ children }: { children: React.ReactNode }) {
  const saved = load("settings", DEFAULT_SETTINGS);
  const [settings, setSettings] = useState<AppSettings>(saved);
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => { 
    save("settings", settings); 
  }, [settings]);

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

/* -------------------- Auth Context -------------------- */
const AuthContext = createContext<any>(null);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const savedUsers = load<User[]>("users", []);
  const initialUsers = savedUsers.length > 0 ? savedUsers : [
    { 
      id: "trainer-1", 
      role: "trainer", 
      name: "Alex Johnson", 
      email: "trainer@fit.app", 
      password: "trainer123", 
      clients: [], 
      activityLog: [{ msg: "Welcome to FitnessPro!", time: new Date().toLocaleString(), type: 'info' }],
      dateJoined: "2024-01-15",
      phone: "+1 (555) 123-4567",
      isActive: true,
      preferences: {
        notifications: true,
        emailUpdates: true,
        theme: 'auto',
        language: 'en'
      }
    },
    {
      id: "client-1",
      role: "client",
      name: "Sarah Wilson",
      email: "client@fit.app",
      password: "client123",
      trainerId: "trainer-1",
      activityLog: [{ msg: "Account created", time: new Date().toLocaleString(), type: 'success' }],
      dateJoined: "2024-02-01",
      phone: "+1 (555) 987-6543",
      isActive: true,
      preferences: {
        notifications: true,
        emailUpdates: false,
        theme: 'light',
        language: 'en'
      }
    }
  ];
  
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [session, setSession] = useState<{ userId: string; token: string } | null>(load("session", null));

  useEffect(() => { 
    save("users", users); 
  }, [users]);
  
  useEffect(() => { 
    save("session", session); 
  }, [session]);

  const register = async (payload: { name: string; email: string; password: string; confirmPassword: string; role: "client" | "trainer"; phone?: string }) => {
    // Validate input
    const validation = validateData(userRegistrationSchema, payload);
    if (!validation.success) {
      throw new Error(validation.errors[0].message);
    }

    if (users.find((u) => u.email === payload.email)) {
      throw new Error("Email already exists");
    }

    const user: User = {
      id: uid(),
      name: sanitizeString(payload.name),
      email: payload.email.toLowerCase(),
      password: payload.password, // In production, this would be hashed
      role: payload.role,
      phone: payload.phone ? sanitizeString(payload.phone) : undefined,
      clients: payload.role === "trainer" ? [] : undefined,
      trainerId: payload.role === "client" ? users.find((u) => u.role === "trainer")?.id : undefined,
      activityLog: [{ msg: "Account created", time: new Date().toLocaleString(), type: 'success' }],
      dateJoined: new Date().toISOString().split('T')[0],
      isActive: true,
      preferences: {
        notifications: true,
        emailUpdates: true,
        theme: 'auto',
        language: 'en'
      }
    };

    setUsers((u) => [user, ...u]);
    
    // Try to save to database (placeholder)
    try {
      await db.createUser(user);
    } catch (error) {
      console.warn('Database save failed, using local storage:', error);
    }

    return user;
  };

  const login = async ({ email, password }: { email: string; password: string }) => {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    if (!user.isActive) {
      throw new Error("Account is deactivated");
    }

    const token = uid();
    setSession({ userId: user.id, token });
    
    // Update last login
    updateUser(user.id, { lastLogin: new Date().toISOString() });
    
    return user;
  };

  const logout = () => {
    setSession(null);
    // Clear any cached data
    localStorage.removeItem('session');
  };

  const getUser = (id?: string) => users.find((u) => u.id === id);
  
  const updateUser = (id: string, patch: Partial<User>) => {
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const createClient = async (clientData: { name: string; email: string; phone?: string; temporaryPassword: string }, trainerId: string) => {
    // Validate input
    const validation = validateData(clientCreationSchema, clientData);
    if (!validation.success) {
      throw new Error(validation.errors[0].message);
    }

    if (users.find((u) => u.email === clientData.email)) {
      throw new Error("Email already exists");
    }

    const client: User = {
      id: uid(),
      name: sanitizeString(clientData.name),
      email: clientData.email.toLowerCase(),
      password: clientData.temporaryPassword,
      role: "client",
      phone: clientData.phone ? sanitizeString(clientData.phone) : undefined,
      trainerId,
      activityLog: [{ msg: "Account created by trainer", time: new Date().toLocaleString(), type: 'info' }],
      dateJoined: new Date().toISOString().split('T')[0],
      isActive: true,
      preferences: {
        notifications: true,
        emailUpdates: true,
        theme: 'auto',
        language: 'en'
      }
    };

    setUsers((u) => [client, ...u]);
    
    // Add client to trainer's client list
    setUsers((u) => u.map((x) => 
      x.id === trainerId 
        ? { ...x, clients: [...(x.clients || []), client] } 
        : x
    ));

    // Try to save to database (placeholder)
    try {
      await db.createUser(client);
    } catch (error) {
      console.warn('Database save failed, using local storage:', error);
    }

    return client;
  };

  const deleteUser = (id: string) => {
    setUsers((u) => u.filter((x) => x.id !== id));
  };

  return (
    <AuthContext.Provider value={{ 
      users, 
      session, 
      register, 
      login, 
      logout, 
      getUser, 
      updateUser, 
      createClient,
      deleteUser 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/* -------------------- Data Context -------------------- */
const DataContext = createContext<any>(null);

function DataProvider({ children }: { children: React.ReactNode }) {
  const savedData = load("data", { workouts: [], meals: [], messages: [], progress: [] });
  const [appData, setAppData] = useState<any>(savedData);

  useEffect(() => { 
    save("data", appData); 
  }, [appData]);

  const addWorkout = async (w: Partial<Workout>) => {
    // Validate workout data
    const validation = validateData(workoutSchema, w);
    if (!validation.success) {
      throw new Error(validation.errors[0].message);
    }

    const workout: Workout = { 
      id: uid(), 
      date: new Date().toISOString().split('T')[0], 
      completed: false, 
      exercises: [], 
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...w 
    };
    
    setAppData((d: any) => ({ ...d, workouts: [workout, ...(d.workouts || [])] }));
    
    // Try to save to database (placeholder)
    try {
      await db.createWorkout(workout);
    } catch (error) {
      console.warn('Database save failed, using local storage:', error);
    }
    
    return workout;
  };

  const updateWorkout = async (id: string, updates: Partial<Workout>) => {
    const updatedWorkout = { ...updates, updatedAt: new Date().toISOString() };
    setAppData((d: any) => ({ 
      ...d, 
      workouts: d.workouts.map((w: any) => (w.id === id ? { ...w, ...updatedWorkout } : w)) 
    }));
    
    try {
      await db.updateWorkout(id, updatedWorkout);
    } catch (error) {
      console.warn('Database update failed, using local storage:', error);
    }
  };

  const deleteWorkout = async (id: string) => {
    setAppData((d: any) => ({ ...d, workouts: d.workouts.filter((w: any) => w.id !== id) }));
    
    try {
      await db.deleteWorkout(id);
    } catch (error) {
      console.warn('Database delete failed, using local storage:', error);
    }
  };

  const logMeal = async (meal: Partial<Meal>) => {
    // Validate meal data
    const validation = validateData(mealSchema, meal);
    if (!validation.success) {
      throw new Error(validation.errors[0].message);
    }

    const newMeal: Meal = { 
      id: uid(), 
      date: new Date().toISOString().split('T')[0], 
      ...meal 
    } as Meal;
    
    setAppData((d: any) => ({ ...d, meals: [newMeal, ...(d.meals || [])] }));
    
    try {
      await db.createMeal(newMeal);
    } catch (error) {
      console.warn('Database save failed, using local storage:', error);
    }
    
    return newMeal;
  };

  const updateMeal = async (id: string, updates: Partial<Meal>) => {
    setAppData((d: any) => ({ 
      ...d, 
      meals: d.meals.map((m: any) => (m.id === id ? { ...m, ...updates } : m)) 
    }));
    
    try {
      await db.updateMeal(id, updates);
    } catch (error) {
      console.warn('Database update failed, using local storage:', error);
    }
  };

  const deleteMeal = async (id: string) => {
    setAppData((d: any) => ({ ...d, meals: d.meals.filter((m: any) => m.id !== id) }));
    
    try {
      await db.deleteMeal(id);
    } catch (error) {
      console.warn('Database delete failed, using local storage:', error);
    }
  };

  const sendMessage = async (message: Partial<Message>) => {
    // Validate message data
    const validation = validateData(messageSchema, message);
    if (!validation.success) {
      throw new Error(validation.errors[0].message);
    }

    const newMessage: Message = { 
      id: uid(), 
      timestamp: new Date().toISOString(), 
      read: false, 
      type: 'text',
      ...message 
    } as Message;
    
    setAppData((d: any) => ({ ...d, messages: [newMessage, ...(d.messages || [])] }));
    
    try {
      await db.createMessage(newMessage);
    } catch (error) {
      console.warn('Database save failed, using local storage:', error);
    }
    
    return newMessage;
  };

  const markMessageRead = async (id: string) => {
    setAppData((d: any) => ({ 
      ...d, 
      messages: d.messages.map((m: any) => (m.id === id ? { ...m, read: true } : m)) 
    }));
    
    try {
      await db.markMessageAsRead(id);
    } catch (error) {
      console.warn('Database update failed, using local storage:', error);
    }
  };

  const addProgressEntry = async (entry: Partial<ProgressEntry>) => {
    // Validate progress data
    const validation = validateData(progressSchema, entry);
    if (!validation.success) {
      throw new Error(validation.errors[0].message);
    }

    const newEntry: ProgressEntry = { 
      id: uid(), 
      date: new Date().toISOString().split('T')[0], 
      ...entry 
    } as ProgressEntry;
    
    setAppData((d: any) => ({ ...d, progress: [newEntry, ...(d.progress || [])] }));
    
    try {
      await db.createProgressEntry(newEntry);
    } catch (error) {
      console.warn('Database save failed, using local storage:', error);
    }
    
    return newEntry;
  };

  const updateProgressEntry = async (id: string, updates: Partial<ProgressEntry>) => {
    setAppData((d: any) => ({ 
      ...d, 
      progress: d.progress.map((p: any) => (p.id === id ? { ...p, ...updates } : p)) 
    }));
    
    try {
      await db.updateProgressEntry(id, updates);
    } catch (error) {
      console.warn('Database update failed, using local storage:', error);
    }
  };

  const deleteProgressEntry = async (id: string) => {
    setAppData((d: any) => ({ ...d, progress: d.progress.filter((p: any) => p.id !== id) }));
    
    try {
      await db.deleteProgressEntry(id);
    } catch (error) {
      console.warn('Database delete failed, using local storage:', error);
    }
  };

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

/* -------------------- UI Components -------------------- */
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
        <div className="text-sm text-[var(--muted-foreground)]">
          {user ? `${user.name} (${user.role})` : "Not signed in"}
        </div>
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
  className = "",
  type = "button"
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}) {
  const baseClasses = "font-medium rounded-lg transition-all duration-200 ease-in-out hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]";
  
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
      type={type}
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
  className = "",
  error,
  min,
  max,
  step
}: {
  label?: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        step={step}
        className={`w-full p-2 border rounded-lg bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200 ${
          error ? 'border-red-500' : 'border-[var(--input)]'
        }`}
      />
      {error && <div className="text-red-500 text-sm mt-1">{error}</div>}
    </div>
  );
}

function Select({ 
  label, 
  value, 
  onChange, 
  options,
  className = "",
  required = false,
  error
}: {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  className?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={onChange}
        required={required}
        className={`w-full p-2 border rounded-lg bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200 ${
          error ? 'border-red-500' : 'border-[var(--input)]'
        }`}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {error && <div className="text-red-500 text-sm mt-1">{error}</div>}
    </div>
  );
}

function Textarea({ 
  label, 
  value, 
  onChange, 
  placeholder,
  required = false,
  className = "",
  error,
  rows = 3
}: {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  error?: string;
  rows?: number;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className={`w-full p-2 border rounded-lg bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200 resize-vertical ${
          error ? 'border-red-500' : 'border-[var(--input)]'
        }`}
      />
      {error && <div className="text-red-500 text-sm mt-1">{error}</div>}
    </div>
  );
}

function Modal({ isOpen, onClose, title, children, size = "md" }: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" onClick={onClose}>
      <div 
        className={`bg-[var(--card)] p-6 rounded-lg shadow-xl ${sizeClasses[size]} w-full max-h-[90vh] overflow-y-auto m-4 animate-slide-up`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-[var(--card-foreground)]">{title}</h2>
          <button 
            onClick={onClose} 
            className="text-2xl text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-200"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PasswordStrengthIndicator({ password }: { password: string }) {
  const { score, feedback } = getPasswordStrength(password);
  
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500', 'bg-green-600'];
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-2">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded ${i < score ? colors[score - 1] : 'bg-gray-200 dark:bg-gray-700'}`}
          />
        ))}
      </div>
      <div className="text-xs text-[var(--muted-foreground)]">
        {password && (
          <>
            <div>Strength: {labels[score - 1] || 'Very Weak'}</div>
            {feedback.length > 0 && (
              <div className="mt-1">
                {feedback.map((tip, i) => (
                  <div key={i}>• {tip}</div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------- Auth Pages -------------------- */
function LoginPage({ onLogin, onShowRegister }: { onLogin: (user: User) => void; onShowRegister: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const { login } = useAuth();
  const { push } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      // Validate inputs
      if (!email) throw new Error("Email is required");
      if (!password) throw new Error("Password is required");

      const user = await login({ email: sanitizeString(email), password });
      push(`Welcome back, ${user.name}!`, { type: "success" });
      onLogin(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      setErrors({ general: message });
      push(message, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          <LogoPlaceholder size={64} />
          <h1 className="text-2xl font-bold text-[var(--foreground)] mt-4">Welcome to FitnessPro</h1>
          <p className="text-[var(--muted-foreground)] mt-2">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            error={errors.email}
          />
          
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            error={errors.password}
          />

          {errors.general && (
            <div className="text-red-500 text-sm text-center">{errors.general}</div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-[var(--muted-foreground)]">
            Don't have an account?{" "}
            <button
              onClick={onShowRegister}
              className="text-[var(--primary)] hover:underline font-medium"
            >
              Sign up
            </button>
          </p>
        </div>

        <div className="mt-6 p-4 bg-[var(--secondary)] rounded-lg">
          <h3 className="font-medium text-[var(--foreground)] mb-2">Demo Accounts:</h3>
          <div className="text-sm text-[var(--muted-foreground)] space-y-1">
            <div><strong>Trainer:</strong> trainer@fit.app / trainer123</div>
            <div><strong>Client:</strong> client@fit.app / client123</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function RegisterPage({ onRegister, onShowLogin }: { onRegister: (user: User) => void; onShowLogin: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    role: "client" as UserRole
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const { register } = useAuth();
  const { push } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const user = await register({
        ...formData,
        name: sanitizeString(formData.name),
        email: sanitizeString(formData.email),
        phone: formData.phone ? sanitizeString(formData.phone) : undefined
      });
      
      push(`Account created successfully! Welcome, ${user.name}!`, { type: "success" });
      onRegister(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      setErrors({ general: message });
      push(message, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          <LogoPlaceholder size={64} />
          <h1 className="text-2xl font-bold text-[var(--foreground)] mt-4">Create Account</h1>
          <p className="text-[var(--muted-foreground)] mt-2">Join FitnessPro today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Enter your full name"
            required
            error={errors.name}
          />
          
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="Enter your email"
            required
            error={errors.email}
          />

          <Input
            label="Phone (Optional)"
            type="tel"
            value={formData.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="Enter your phone number"
            error={errors.phone}
          />

          <Select
            label="Account Type"
            value={formData.role}
            onChange={(e) => updateField("role", e.target.value)}
            options={[
              { value: "client", label: "Client - Track my fitness journey" },
              { value: "trainer", label: "Trainer - Manage clients" }
            ]}
            required
          />
          
          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => updateField("password", e.target.value)}
            placeholder="Create a strong password"
            required
            error={errors.password}
          />

          <PasswordStrengthIndicator password={formData.password} />
          
          <Input
            label="Confirm Password"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => updateField("confirmPassword", e.target.value)}
            placeholder="Confirm your password"
            required
            error={errors.confirmPassword}
          />

          {errors.general && (
            <div className="text-red-500 text-sm text-center">{errors.general}</div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-[var(--muted-foreground)]">
            Already have an account?{" "}
            <button
              onClick={onShowLogin}
              className="text-[var(--primary)] hover:underline font-medium"
            >
              Sign in
            </button>
          </p>
        </div>
      </Card>
    </div>
  );
}

/* -------------------- Dashboard Page -------------------- */
function DashboardPage() {
  const { session, getUser } = useAuth();
  const { appData } = useData();
  const user = session ? getUser(session.userId) : null;

  const today = new Date().toISOString().split('T')[0];
  const todayWorkouts = appData.workouts?.filter((w: Workout) => 
    w.date === today && (user?.role === 'trainer' ? w.trainerId === user.id : w.clientId === user?.id)
  ) || [];
  
  const todayMeals = appData.meals?.filter((m: Meal) => 
    m.date === today && m.userId === user?.id
  ) || [];
  
  const recentProgress = appData.progress?.filter((p: ProgressEntry) => 
    p.userId === user?.id
  ).slice(0, 1)[0] || null;

  const weeklyStats = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const workouts = appData.workouts?.filter((w: Workout) => 
        w.date === date && w.completed && (
          user?.role === 'trainer' ? w.trainerId === user.id : w.clientId === user?.id
        )
      ) || [];
      
      const meals = appData.meals?.filter((m: Meal) => 
        m.date === date && m.userId === user?.id
      ) || [];
      
      const totalCalories = meals.reduce((sum: number, meal: Meal) => sum + meal.calories, 0);
      
      return {
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        workouts: workouts.length,
        calories: Math.round(totalCalories / 100) // Scale down for chart
      };
    });
  }, [appData, user]);

  const totalStats = useMemo(() => {
    const userWorkouts = appData.workouts?.filter((w: Workout) => 
      user?.role === 'trainer' ? w.trainerId === user.id : w.clientId === user?.id
    ) || [];
    
    const completedWorkouts = userWorkouts.filter((w: Workout) => w.completed).length;
    const userMeals = appData.meals?.filter((m: Meal) => m.userId === user?.id) || [];
    const totalMeals = userMeals.length;
    const avgCalories = totalMeals > 0 ? Math.round(userMeals.reduce((sum: number, meal: Meal) => sum + meal.calories, 0) / totalMeals) : 0;
    const progressEntries = appData.progress?.filter((p: ProgressEntry) => p.userId === user?.id).length || 0;

    return { completedWorkouts, totalMeals, avgCalories, progressEntries };
  }, [appData, user]);

  const todayCalories = todayMeals.reduce((sum: number, meal: Meal) => sum + meal.calories, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[var(--foreground)]">Welcome back, {user?.name}!</h2>
          <p className="text-[var(--muted-foreground)] mt-1">Here's your fitness overview for today</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-[var(--muted-foreground)]">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
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
          <div className="text-3xl font-bold text-orange-600 mb-2">{todayCalories}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Today's Calories</div>
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
                  <div className={`px-2 py-1 rounded text-xs ${
                    workout.completed 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}>
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
                    <div className="text-xs text-[var(--muted-foreground)]">
                      P: {meal.protein}g C: {meal.carbs}g F: {meal.fat}g
                    </div>
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
              <div className="text-2xl font-bold text-purple-600">
                {new Date(recentProgress.date).toLocaleDateString()}
              </div>
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
  const { users, session, getUser, createClient } = useAuth();
  const { push } = useToast();
  const user = session ? getUser(session.userId) : null;
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    temporaryPassword: '' 
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const clients = users.filter(u => u.role === 'client' && u.trainerId === user?.id);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      if (!user) throw new Error("Not authenticated");
      
      const client = await createClient(newClient, user.id);
      push(`Client ${client.name} added successfully! Login: ${client.email}`, { type: "success" });
      setNewClient({ name: '', email: '', phone: '', temporaryPassword: '' });
      setShowAddClient(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add client";
      setErrors({ general: message });
      push(message, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setNewClient(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
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
                  <span className="text-[var(--foreground)]">
                    {client.dateJoined ? new Date(client.dateJoined).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Phone:</span>
                  <span className="text-[var(--foreground)]">{client.phone || 'Not provided'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Status:</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    client.isActive 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {client.isActive ? 'Active' : 'Inactive'}
                  </span>
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
        <form onSubmit={handleAddClient} className="space-y-4">
          <Input
            label="Client Name"
            value={newClient.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Enter client's full name"
            required
            error={errors.name}
          />
          
          <Input
            label="Email Address"
            type="email"
            value={newClient.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="Enter client's email"
            required
            error={errors.email}
          />
          
          <Input
            label="Phone Number (Optional)"
            type="tel"
            value={newClient.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="Enter client's phone number"
            error={errors.phone}
          />
          
          <Input
            label="Temporary Password"
            type="password"
            value={newClient.temporaryPassword}
            onChange={(e) => updateField("temporaryPassword", e.target.value)}
            placeholder="Create a temporary password for the client"
            required
            error={errors.temporaryPassword}
          />

          <PasswordStrengthIndicator password={newClient.temporaryPassword} />

          {errors.general && (
            <div className="text-red-500 text-sm">{errors.general}</div>
          )}

          <div className="bg-[var(--secondary)] p-4 rounded-lg">
            <h4 className="font-medium text-[var(--foreground)] mb-2">📧 What happens next?</h4>
            <ul className="text-sm text-[var(--muted-foreground)] space-y-1">
              <li>• Client account will be created immediately</li>
              <li>• Share the login credentials with your client</li>
              <li>• Client can change their password after first login</li>
              <li>• You'll be able to track their progress and assign workouts</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowAddClient(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Creating..." : "Create Client"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* -------------------- Workouts Page -------------------- */
function WorkoutsPage() {
  const { session, getUser } = useAuth();
  const { appData, addWorkout, updateWorkout, deleteWorkout } = useData();
  const { push } = useToast();
  const user = session ? getUser(session.userId) : null;
  
  const [showAddWorkout, setShowAddWorkout] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [newWorkout, setNewWorkout] = useState({
    name: '',
    exercises: [{ name: '', sets: 1, reps: 1, weight: 0, duration: 0, notes: '' }],
    notes: '',
    difficulty: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    category: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const userWorkouts = appData.workouts?.filter((w: Workout) => 
    user?.role === 'trainer' ? w.trainerId === user.id : w.clientId === user?.id
  ) || [];

  const handleAddExercise = () => {
    setNewWorkout(prev => ({
      ...prev,
      exercises: [...prev.exercises, { name: '', sets: 1, reps: 1, weight: 0, duration: 0, notes: '' }]
    }));
  };

  const handleRemoveExercise = (index: number) => {
    setNewWorkout(prev => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== index)
    }));
  };

  const handleExerciseChange = (index: number, field: string, value: string | number) => {
    setNewWorkout(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) => 
        i === index ? { ...ex, [field]: value } : ex
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const workoutData = {
        ...newWorkout,
        exercises: newWorkout.exercises.map(ex => ({
          ...ex,
          id: uid(),
          sets: sanitizeNumber(ex.sets) || 1,
          reps: sanitizeNumber(ex.reps) || 1,
          weight: sanitizeNumber(ex.weight) || undefined,
          duration: sanitizeNumber(ex.duration) || undefined
        })),
        clientId: user?.role === 'client' ? user.id : undefined,
        trainerId: user?.role === 'trainer' ? user.id : undefined
      };

      if (editingWorkout) {
        await updateWorkout(editingWorkout.id, workoutData);
        push("Workout updated successfully!", { type: "success" });
      } else {
        await addWorkout(workoutData);
        push("Workout created successfully!", { type: "success" });
      }

      setNewWorkout({
        name: '',
        exercises: [{ name: '', sets: 1, reps: 1, weight: 0, duration: 0, notes: '' }],
        notes: '',
        difficulty: 'beginner',
        category: ''
      });
      setShowAddWorkout(false);
      setEditingWorkout(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save workout";
      setErrors({ general: message });
      push(message, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteWorkout = async (workout: Workout) => {
    try {
      await updateWorkout(workout.id, { completed: !workout.completed });
      push(`Workout ${workout.completed ? 'marked as incomplete' : 'completed'}!`, { type: "success" });
    } catch (error) {
      push("Failed to update workout", { type: "error" });
    }
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    if (window.confirm("Are you sure you want to delete this workout?")) {
      try {
        await deleteWorkout(workoutId);
        push("Workout deleted successfully!", { type: "success" });
      } catch (error) {
        push("Failed to delete workout", { type: "error" });
      }
    }
  };

  const handleEditWorkout = (workout: Workout) => {
    setEditingWorkout(workout);
    setNewWorkout({
      name: workout.name,
      exercises: workout.exercises.map(ex => ({ ...ex })),
      notes: workout.notes || '',
      difficulty: workout.difficulty || 'beginner',
      category: workout.category || ''
    });
    setShowAddWorkout(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Workouts</h2>
        <Button onClick={() => setShowAddWorkout(true)}>Create Workout</Button>
      </div>

      {userWorkouts.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {userWorkouts.map((workout: Workout) => (
            <Card key={workout.id}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">{workout.name}</h3>
                  <div className="text-sm text-[var(--muted-foreground)]">
                    {new Date(workout.date).toLocaleDateString()} • {workout.exercises.length} exercises
                  </div>
                  {workout.difficulty && (
                    <div className={`inline-block px-2 py-1 rounded text-xs mt-1 ${
                      workout.difficulty === 'beginner' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      workout.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {workout.difficulty}
                    </div>
                  )}
                </div>
                <div className={`px-3 py-1 rounded text-sm ${
                  workout.completed 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                }`}>
                  {workout.completed ? 'Completed' : 'Pending'}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {workout.exercises.slice(0, 3).map((exercise, index) => (
                  <div key={exercise.id} className="flex justify-between items-center p-2 bg-[var(--secondary)] rounded">
                    <div>
                      <div className="font-medium text-[var(--foreground)]">{exercise.name}</div>
                      <div className="text-sm text-[var(--muted-foreground)]">
                        {exercise.sets} sets × {exercise.reps} reps
                        {exercise.weight && ` @ ${exercise.weight}kg`}
                      </div>
                    </div>
                  </div>
                ))}
                {workout.exercises.length > 3 && (
                  <div className="text-center text-sm text-[var(--muted-foreground)]">
                    +{workout.exercises.length - 3} more exercises
                  </div>
                )}
              </div>

              {workout.notes && (
                <div className="mb-4 p-3 bg-[var(--muted)] rounded">
                  <div className="text-sm text-[var(--muted-foreground)]">{workout.notes}</div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={workout.completed ? "secondary" : "primary"}
                  onClick={() => handleCompleteWorkout(workout)}
                  className="flex-1"
                >
                  {workout.completed ? 'Mark Incomplete' : 'Complete'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleEditWorkout(workout)}>
                  Edit
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
            <Button onClick={() => setShowAddWorkout(true)}>Create Your First Workout</Button>
          </div>
        </Card>
      )}

      <Modal 
        isOpen={showAddWorkout} 
        onClose={() => {
          setShowAddWorkout(false);
          setEditingWorkout(null);
          setNewWorkout({
            name: '',
            exercises: [{ name: '', sets: 1, reps: 1, weight: 0, duration: 0, notes: '' }],
            notes: '',
            difficulty: 'beginner',
            category: ''
          });
        }} 
        title={editingWorkout ? "Edit Workout" : "Create New Workout"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Workout Name"
              value={newWorkout.name}
              onChange={(e) => setNewWorkout(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Upper Body Strength"
              required
              error={errors.name}
            />
            
            <Select
              label="Difficulty"
              value={newWorkout.difficulty}
              onChange={(e) => setNewWorkout(prev => ({ ...prev, difficulty: e.target.value as any }))}
              options={[
                { value: 'beginner', label: 'Beginner' },
                { value: 'intermediate', label: 'Intermediate' },
                { value: 'advanced', label: 'Advanced' }
              ]}
            />
          </div>

          <Input
            label="Category (Optional)"
            value={newWorkout.category}
            onChange={(e) => setNewWorkout(prev => ({ ...prev, category: e.target.value }))}
            placeholder="e.g., Strength, Cardio, Flexibility"
          />

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Exercises</h3>
              <Button type="button" size="sm" onClick={handleAddExercise}>Add Exercise</Button>
            </div>
            
            <div className="space-y-4">
              {newWorkout.exercises.map((exercise, index) => (
                <div key={index} className="p-4 border border-[var(--border)] rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-[var(--foreground)]">Exercise {index + 1}</h4>
                    {newWorkout.exercises.length > 1 && (
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="danger" 
                        onClick={() => handleRemoveExercise(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Input
                      label="Exercise Name"
                      value={exercise.name}
                      onChange={(e) => handleExerciseChange(index, 'name', e.target.value)}
                      placeholder="e.g., Push-ups"
                      required
                    />
                    
                    <Input
                      label="Sets"
                      type="number"
                      value={exercise.sets}
                      onChange={(e) => handleExerciseChange(index, 'sets', parseInt(e.target.value) || 1)}
                      min={1}
                      max={20}
                      required
                    />
                    
                    <Input
                      label="Reps"
                      type="number"
                      value={exercise.reps}
                      onChange={(e) => handleExerciseChange(index, 'reps', parseInt(e.target.value) || 1)}
                      min={1}
                      max={1000}
                      required
                    />
                    
                    <Input
                      label="Weight (kg)"
                      type="number"
                      value={exercise.weight || ''}
                      onChange={(e) => handleExerciseChange(index, 'weight', parseFloat(e.target.value) || 0)}
                      min={0}
                      max={1000}
                      step={0.5}
                      placeholder="Optional"
                    />
                    
                    <Input
                      label="Duration (min)"
                      type="number"
                      value={exercise.duration || ''}
                      onChange={(e) => handleExerciseChange(index, 'duration', parseInt(e.target.value) || 0)}
                      min={0}
                      max={480}
                      placeholder="Optional"
                    />
                  </div>
                  
                  <Textarea
                    label="Exercise Notes"
                    value={exercise.notes || ''}
                    onChange={(e) => handleExerciseChange(index, 'notes', e.target.value)}
                    placeholder="Any specific instructions or notes..."
                    className="mt-3"
                    rows={2}
                  />
                </div>
              ))}
            </div>
          </div>

          <Textarea
            label="Workout Notes"
            value={newWorkout.notes}
            onChange={(e) => setNewWorkout(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Any additional notes about this workout..."
            rows={3}
          />

          {errors.general && (
            <div className="text-red-500 text-sm">{errors.general}</div>
          )}

          <div className="flex gap-3">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => {
                setShowAddWorkout(false);
                setEditingWorkout(null);
              }} 
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Saving..." : editingWorkout ? "Update Workout" : "Create Workout"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* -------------------- Progress Page -------------------- */
function ProgressPage() {
  const { session, getUser } = useAuth();
  const { appData, addProgressEntry, updateProgressEntry, deleteProgressEntry } = useData();
  const { push } = useToast();
  const user = session ? getUser(session.userId) : null;
  
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ProgressEntry | null>(null);
  const [newEntry, setNewEntry] = useState({
    weight: '',
    bodyFat: '',
    muscle: '',
    measurements: {
      chest: '',
      waist: '',
      hips: '',
      arms: '',
      thighs: '',
      neck: ''
    },
    mood: '',
    energy: '',
    sleep: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const userProgress = appData.progress?.filter((p: ProgressEntry) => 
    p.userId === user?.id
  ).sort((a: ProgressEntry, b: ProgressEntry) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ) || [];

  const chartData = useMemo(() => {
    return userProgress.slice(0, 10).reverse().map((entry: ProgressEntry) => ({
      date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weight: entry.weight || null,
      bodyFat: entry.bodyFat || null,
      muscle: entry.muscle || null
    }));
  }, [userProgress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const entryData = {
        weight: sanitizeNumber(newEntry.weight) || undefined,
        bodyFat: sanitizeNumber(newEntry.bodyFat) || undefined,
        muscle: sanitizeNumber(newEntry.muscle) || undefined,
        measurements: {
          chest: sanitizeNumber(newEntry.measurements.chest) || undefined,
          waist: sanitizeNumber(newEntry.measurements.waist) || undefined,
          hips: sanitizeNumber(newEntry.measurements.hips) || undefined,
          arms: sanitizeNumber(newEntry.measurements.arms) || undefined,
          thighs: sanitizeNumber(newEntry.measurements.thighs) || undefined,
          neck: sanitizeNumber(newEntry.measurements.neck) || undefined,
        },
        mood: sanitizeNumber(newEntry.mood) || undefined,
        energy: sanitizeNumber(newEntry.energy) || undefined,
        sleep: sanitizeNumber(newEntry.sleep) || undefined,
        notes: sanitizeString(newEntry.notes) || undefined,
        userId: user?.id
      };

      // Remove empty measurements
      const cleanedMeasurements = Object.fromEntries(
        Object.entries(entryData.measurements).filter(([_, value]) => value !== undefined)
      );
      
      if (Object.keys(cleanedMeasurements).length === 0) {
        delete entryData.measurements;
      } else {
        entryData.measurements = cleanedMeasurements as any;
      }

      if (editingEntry) {
        await updateProgressEntry(editingEntry.id, entryData);
        push("Progress entry updated successfully!", { type: "success" });
      } else {
        await addProgressEntry(entryData);
        push("Progress entry added successfully!", { type: "success" });
      }

      setNewEntry({
        weight: '',
        bodyFat: '',
        muscle: '',
        measurements: {
          chest: '',
          waist: '',
          hips: '',
          arms: '',
          thighs: '',
          neck: ''
        },
        mood: '',
        energy: '',
        sleep: '',
        notes: ''
      });
      setShowAddEntry(false);
      setEditingEntry(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save progress entry";
      setErrors({ general: message });
      push(message, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditEntry = (entry: ProgressEntry) => {
    setEditingEntry(entry);
    setNewEntry({
      weight: entry.weight?.toString() || '',
      bodyFat: entry.bodyFat?.toString() || '',
      muscle: entry.muscle?.toString() || '',
      measurements: {
        chest: entry.measurements?.chest?.toString() || '',
        waist: entry.measurements?.waist?.toString() || '',
        hips: entry.measurements?.hips?.toString() || '',
        arms: entry.measurements?.arms?.toString() || '',
        thighs: entry.measurements?.thighs?.toString() || '',
        neck: entry.measurements?.neck?.toString() || ''
      },
      mood: entry.mood?.toString() || '',
      energy: entry.energy?.toString() || '',
      sleep: entry.sleep?.toString() || '',
      notes: entry.notes || ''
    });
    setShowAddEntry(true);
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (window.confirm("Are you sure you want to delete this progress entry?")) {
      try {
        await deleteProgressEntry(entryId);
        push("Progress entry deleted successfully!", { type: "success" });
      } catch (error) {
        push("Failed to delete progress entry", { type: "error" });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Progress Tracking</h2>
        <Button onClick={() => setShowAddEntry(true)}>Add Entry</Button>
      </div>

      {/* Progress Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Weight Progress">
            <ResponsiveContainer width="100%" height={250}>
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
                <Line 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="var(--primary)" 
                  strokeWidth={2}
                  dot={{ fill: 'var(--primary)' }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Body Composition">
            <ResponsiveContainer width="100%" height={250}>
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
                <Line 
                  type="monotone" 
                  dataKey="bodyFat" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  dot={{ fill: '#ef4444' }}
                  connectNulls={false}
                  name="Body Fat %"
                />
                <Line 
                  type="monotone" 
                  dataKey="muscle" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ fill: '#10b981' }}
                  connectNulls={false}
                  name="Muscle Mass"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Progress Entries */}
      {userProgress.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Progress History</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {userProgress.map((entry: ProgressEntry) => (
              <Card key={entry.id}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-[var(--foreground)]">
                      {new Date(entry.date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </h4>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEditEntry(entry)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDeleteEntry(entry.id)}>
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  {entry.weight && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[var(--primary)]">{entry.weight} kg</div>
                      <div className="text-sm text-[var(--muted-foreground)]">Weight</div>
                    </div>
                  )}
                  {entry.bodyFat && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{entry.bodyFat}%</div>
                      <div className="text-sm text-[var(--muted-foreground)]">Body Fat</div>
                    </div>
                  )}
                  {entry.muscle && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{entry.muscle} kg</div>
                      <div className="text-sm text-[var(--muted-foreground)]">Muscle</div>
                    </div>
                  )}
                  {entry.mood && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{entry.mood}/10</div>
                      <div className="text-sm text-[var(--muted-foreground)]">Mood</div>
                    </div>
                  )}
                  {entry.energy && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{entry.energy}/10</div>
                      <div className="text-sm text-[var(--muted-foreground)]">Energy</div>
                    </div>
                  )}
                  {entry.sleep && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{entry.sleep}h</div>
                      <div className="text-sm text-[var(--muted-foreground)]">Sleep</div>
                    </div>
                  )}
                </div>

                {entry.measurements && Object.keys(entry.measurements).length > 0 && (
                  <div className="mb-4">
                    <h5 className="font-medium text-[var(--foreground)] mb-2">Measurements (cm)</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                      {Object.entries(entry.measurements).map(([key, value]) => (
                        value && (
                          <div key={key} className="flex justify-between">
                            <span className="text-[var(--muted-foreground)] capitalize">{key}:</span>
                            <span className="text-[var(--foreground)]">{value} cm</span>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {entry.notes && (
                  <div className="p-3 bg-[var(--muted)] rounded">
                    <div className="text-sm text-[var(--muted-foreground)]">{entry.notes}</div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">No progress entries yet</h3>
            <p className="text-[var(--muted-foreground)] mb-6">Start tracking your progress to see your fitness journey</p>
            <Button onClick={() => setShowAddEntry(true)}>Add Your First Entry</Button>
          </div>
        </Card>
      )}

      <Modal 
        isOpen={showAddEntry} 
        onClose={() => {
          setShowAddEntry(false);
          setEditingEntry(null);
          setNewEntry({
            weight: '',
            bodyFat: '',
            muscle: '',
            measurements: {
              chest: '',
              waist: '',
              hips: '',
              arms: '',
              thighs: '',
              neck: ''
            },
            mood: '',
            energy: '',
            sleep: '',
            notes: ''
          });
        }} 
        title={editingEntry ? "Edit Progress Entry" : "Add Progress Entry"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Weight (kg)"
              type="number"
              value={newEntry.weight}
              onChange={(e) => setNewEntry(prev => ({ ...prev, weight: e.target.value }))}
              placeholder="70.5"
              min={20}
              max={500}
              step={0.1}
            />
            
            <Input
              label="Body Fat (%)"
              type="number"
              value={newEntry.bodyFat}
              onChange={(e) => setNewEntry(prev => ({ ...prev, bodyFat: e.target.value }))}
              placeholder="15.5"
              min={1}
              max={60}
              step={0.1}
            />
            
            <Input
              label="Muscle Mass (kg)"
              type="number"
              value={newEntry.muscle}
              onChange={(e) => setNewEntry(prev => ({ ...prev, muscle: e.target.value }))}
              placeholder="45.2"
              min={10}
              max={200}
              step={0.1}
            />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Body Measurements (cm)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                label="Chest"
                type="number"
                value={newEntry.measurements.chest}
                onChange={(e) => setNewEntry(prev => ({ 
                  ...prev, 
                  measurements: { ...prev.measurements, chest: e.target.value }
                }))}
                placeholder="100"
                min={50}
                max={200}
                step={0.5}
              />
              
              <Input
                label="Waist"
                type="number"
                value={newEntry.measurements.waist}
                onChange={(e) => setNewEntry(prev => ({ 
                  ...prev, 
                  measurements: { ...prev.measurements, waist: e.target.value }
                }))}
                placeholder="80"
                min={40}
                max={200}
                step={0.5}
              />
              
              <Input
                label="Hips"
                type="number"
                value={newEntry.measurements.hips}
                onChange={(e) => setNewEntry(prev => ({ 
                  ...prev, 
                  measurements: { ...prev.measurements, hips: e.target.value }
                }))}
                placeholder="95"
                min={50}
                max={200}
                step={0.5}
              />
              
              <Input
                label="Arms"
                type="number"
                value={newEntry.measurements.arms}
                onChange={(e) => setNewEntry(prev => ({ 
                  ...prev, 
                  measurements: { ...prev.measurements, arms: e.target.value }
                }))}
                placeholder="35"
                min={15}
                max={80}
                step={0.5}
              />
              
              <Input
                label="Thighs"
                type="number"
                value={newEntry.measurements.thighs}
                onChange={(e) => setNewEntry(prev => ({ 
                  ...prev, 
                  measurements: { ...prev.measurements, thighs: e.target.value }
                }))}
                placeholder="60"
                min={30}
                max={120}
                step={0.5}
              />
              
              <Input
                label="Neck"
                type="number"
                value={newEntry.measurements.neck}
                onChange={(e) => setNewEntry(prev => ({ 
                  ...prev, 
                  measurements: { ...prev.measurements, neck: e.target.value }
                }))}
                placeholder="38"
                min={25}
                max={60}
                step={0.5}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Mood (1-10)"
              type="number"
              value={newEntry.mood}
              onChange={(e) => setNewEntry(prev => ({ ...prev, mood: e.target.value }))}
              placeholder="8"
              min={1}
              max={10}
            />
            
            <Input
              label="Energy Level (1-10)"
              type="number"
              value={newEntry.energy}
              onChange={(e) => setNewEntry(prev => ({ ...prev, energy: e.target.value }))}
              placeholder="7"
              min={1}
              max={10}
            />
            
            <Input
              label="Sleep (hours)"
              type="number"
              value={newEntry.sleep}
              onChange={(e) => setNewEntry(prev => ({ ...prev, sleep: e.target.value }))}
              placeholder="8"
              min={0}
              max={24}
              step={0.5}
            />
          </div>

          <Textarea
            label="Notes"
            value={newEntry.notes}
            onChange={(e) => setNewEntry(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="How are you feeling? Any observations about your progress..."
            rows={3}
          />

          {errors.general && (
            <div className="text-red-500 text-sm">{errors.general}</div>
          )}

          <div className="flex gap-3">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => {
                setShowAddEntry(false);
                setEditingEntry(null);
              }} 
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Saving..." : editingEntry ? "Update Entry" : "Add Entry"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* -------------------- Stats Page -------------------- */
function StatsPage() {
  const { session, getUser } = useAuth();
  const { appData } = useData();
  const user = session ? getUser(session.userId) : null;

  const userWorkouts = appData.workouts?.filter((w: Workout) => 
    user?.role === 'trainer' ? w.trainerId === user.id : w.clientId === user?.id
  ) || [];

  const userMeals = appData.meals?.filter((m: Meal) => m.userId === user?.id) || [];
  const userProgress = appData.progress?.filter((p: ProgressEntry) => p.userId === user?.id) || [];

  const stats = useMemo(() => {
    const completedWorkouts = userWorkouts.filter(w => w.completed);
    const totalExercises = userWorkouts.reduce((sum, w) => sum + w.exercises.length, 0);
    const totalCalories = userMeals.reduce((sum, m) => sum + m.calories, 0);
    const avgCaloriesPerDay = userMeals.length > 0 ? Math.round(totalCalories / userMeals.length) : 0;
    
    // Calculate workout frequency (workouts per week)
    const workoutDates = completedWorkouts.map(w => new Date(w.date));
    const oldestWorkout = workoutDates.length > 0 ? Math.min(...workoutDates.map(d => d.getTime())) : Date.now();
    const weeksSinceStart = Math.max(1, Math.ceil((Date.now() - oldestWorkout) / (7 * 24 * 60 * 60 * 1000)));
    const workoutsPerWeek = Math.round((completedWorkouts.length / weeksSinceStart) * 10) / 10;

    // Most common exercises
    const exerciseCount: { [key: string]: number } = {};
    userWorkouts.forEach(workout => {
      workout.exercises.forEach(exercise => {
        exerciseCount[exercise.name] = (exerciseCount[exercise.name] || 0) + 1;
      });
    });
    
    const topExercises = Object.entries(exerciseCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Nutrition breakdown
    const totalProtein = userMeals.reduce((sum, m) => sum + m.protein, 0);
    const totalCarbs = userMeals.reduce((sum, m) => sum + m.carbs, 0);
    const totalFat = userMeals.reduce((sum, m) => sum + m.fat, 0);

    const nutritionData = [
      { name: 'Protein', value: totalProtein, color: '#ef4444' },
      { name: 'Carbs', value: totalCarbs, color: '#3b82f6' },
      { name: 'Fat', value: totalFat, color: '#10b981' }
    ];

    // Progress trends
    const recentProgress = userProgress.slice(0, 6).reverse();
    const progressTrend = recentProgress.map(entry => ({
      date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weight: entry.weight || null,
      bodyFat: entry.bodyFat || null
    }));

    return {
      totalWorkouts: userWorkouts.length,
      completedWorkouts: completedWorkouts.length,
      completionRate: userWorkouts.length > 0 ? Math.round((completedWorkouts.length / userWorkouts.length) * 100) : 0,
      totalExercises,
      workoutsPerWeek,
      totalMeals: userMeals.length,
      totalCalories,
      avgCaloriesPerDay,
      totalProtein: Math.round(totalProtein),
      totalCarbs: Math.round(totalCarbs),
      totalFat: Math.round(totalFat),
      progressEntries: userProgress.length,
      topExercises,
      nutritionData,
      progressTrend
    };
  }, [userWorkouts, userMeals, userProgress]);

  const achievements = useMemo(() => {
    const badges = [];
    
    if (stats.completedWorkouts >= 1) badges.push({ name: "First Workout", icon: "🏃", description: "Completed your first workout" });
    if (stats.completedWorkouts >= 10) badges.push({ name: "Consistent", icon: "💪", description: "Completed 10 workouts" });
    if (stats.completedWorkouts >= 50) badges.push({ name: "Dedicated", icon: "🔥", description: "Completed 50 workouts" });
    if (stats.completedWorkouts >= 100) badges.push({ name: "Champion", icon: "🏆", description: "Completed 100 workouts" });
    
    if (stats.totalMeals >= 1) badges.push({ name: "Nutrition Tracker", icon: "🍎", description: "Logged your first meal" });
    if (stats.totalMeals >= 50) badges.push({ name: "Meal Master", icon: "🥗", description: "Logged 50 meals" });
    if (stats.totalMeals >= 100) badges.push({ name: "Nutrition Expert", icon: "👨‍🍳", description: "Logged 100 meals" });
    
    if (stats.progressEntries >= 1) badges.push({ name: "Progress Tracker", icon: "📊", description: "Logged your first progress entry" });
    if (stats.progressEntries >= 10) badges.push({ name: "Data Driven", icon: "📈", description: "Logged 10 progress entries" });
    
    if (stats.completionRate >= 80) badges.push({ name: "Reliable", icon: "⭐", description: "80%+ workout completion rate" });
    if (stats.workoutsPerWeek >= 3) badges.push({ name: "Regular", icon: "📅", description: "3+ workouts per week" });
    
    return badges;
  }, [stats]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[var(--foreground)]">Statistics & Analytics</h2>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="text-center">
          <div className="text-3xl font-bold text-[var(--primary)] mb-2">{stats.completedWorkouts}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Completed Workouts</div>
          <div className="text-xs text-[var(--muted-foreground)] mt-1">
            {stats.completionRate}% completion rate
          </div>
        </Card>
        
        <Card className="text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">{stats.workoutsPerWeek}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Workouts/Week</div>
          <div className="text-xs text-[var(--muted-foreground)] mt-1">
            {stats.totalExercises} total exercises
          </div>
        </Card>
        
        <Card className="text-center">
          <div className="text-3xl font-bold text-orange-600 mb-2">{stats.avgCaloriesPerDay}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Avg Daily Calories</div>
          <div className="text-xs text-[var(--muted-foreground)] mt-1">
            {stats.totalMeals} meals logged
          </div>
        </Card>
        
        <Card className="text-center">
          <div className="text-3xl font-bold text-purple-600 mb-2">{stats.progressEntries}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Progress Entries</div>
          <div className="text-xs text-[var(--muted-foreground)] mt-1">
            Tracking your journey
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Trend */}
        {stats.progressTrend.length > 0 && (
          <Card title="Progress Trend">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={stats.progressTrend}>
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
                <Line 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="var(--primary)" 
                  strokeWidth={2}
                  dot={{ fill: 'var(--primary)' }}
                  connectNulls={false}
                  name="Weight (kg)"
                />
                <Line 
                  type="monotone" 
                  dataKey="bodyFat" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  dot={{ fill: '#ef4444' }}
                  connectNulls={false}
                  name="Body Fat %"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Nutrition Breakdown */}
        {stats.nutritionData.some(d => d.value > 0) && (
          <Card title="Nutrition Breakdown">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats.nutritionData.filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${Math.round(value)}g`}
                >
                  {stats.nutritionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
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
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Exercises */}
        {stats.topExercises.length > 0 && (
          <Card title="Most Performed Exercises">
            <div className="space-y-3">
              {stats.topExercises.map((exercise, index) => (
                <div key={exercise.name} className="flex items-center justify-between p-3 bg-[var(--secondary)] rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[var(--primary)] text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="font-medium text-[var(--foreground)]">{exercise.name}</div>
                  </div>
                  <div className="text-[var(--muted-foreground)]">{exercise.count} times</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Achievements */}
        <Card title="Achievements">
          {achievements.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {achievements.map((badge, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-[var(--secondary)] rounded-lg">
                  <div className="text-2xl">{badge.icon}</div>
                  <div>
                    <div className="font-medium text-[var(--foreground)]">{badge.name}</div>
                    <div className="text-sm text-[var(--muted-foreground)]">{badge.description}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              <div className="text-4xl mb-2">🏆</div>
              <div>Start working out to earn achievements!</div>
            </div>
          )}
        </Card>
      </div>

      {/* Detailed Stats */}
      <Card title="Detailed Statistics">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <h4 className="font-semibold text-[var(--foreground)] mb-3">Workout Stats</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Total Workouts:</span>
                <span className="text-[var(--foreground)]">{stats.totalWorkouts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Completed:</span>
                <span className="text-[var(--foreground)]">{stats.completedWorkouts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Completion Rate:</span>
                <span className="text-[var(--foreground)]">{stats.completionRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Total Exercises:</span>
                <span className="text-[var(--foreground)]">{stats.totalExercises}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Weekly Average:</span>
                <span className="text-[var(--foreground)]">{stats.workoutsPerWeek}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-[var(--foreground)] mb-3">Nutrition Stats</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Meals Logged:</span>
                <span className="text-[var(--foreground)]">{stats.totalMeals}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Total Calories:</span>
                <span className="text-[var(--foreground)]">{stats.totalCalories.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Daily Average:</span>
                <span className="text-[var(--foreground)]">{stats.avgCaloriesPerDay}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Total Protein:</span>
                <span className="text-[var(--foreground)]">{stats.totalProtein}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Total Carbs:</span>
                <span className="text-[var(--foreground)]">{stats.totalCarbs}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Total Fat:</span>
                <span className="text-[var(--foreground)]">{stats.totalFat}g</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-[var(--foreground)] mb-3">Progress Stats</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Progress Entries:</span>
                <span className="text-[var(--foreground)]">{stats.progressEntries}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Achievements:</span>
                <span className="text-[var(--foreground)]">{achievements.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Account Age:</span>
                <span className="text-[var(--foreground)]">
                  {user?.dateJoined ? Math.ceil((Date.now() - new Date(user.dateJoined).getTime()) / (24 * 60 * 60 * 1000)) : 0} days
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* -------------------- Meals Page -------------------- */
function MealsPage() {
  const { session, getUser } = useAuth();
  const { appData, logMeal, updateMeal, deleteMeal } = useData();
  const { push } = useToast();
  const user = session ? getUser(session.userId) : null;
  
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [newMeal, setNewMeal] = useState({
    name: '',
    type: 'breakfast' as 'breakfast' | 'lunch' | 'dinner' | 'snack',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
    sugar: '',
    sodium: '',
    servingSize: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const userMeals = appData.meals?.filter((m: Meal) => m.userId === user?.id) || [];
  const selectedDateMeals = userMeals.filter((m: Meal) => m.date === selectedDate);

  const dailyTotals = useMemo(() => {
    return selectedDateMeals.reduce((totals, meal) => ({
      calories: totals.calories + meal.calories,
      protein: totals.protein + meal.protein,
      carbs: totals.carbs + meal.carbs,
      fat: totals.fat + meal.fat,
      fiber: totals.fiber + (meal.fiber || 0),
      sugar: totals.sugar + (meal.sugar || 0),
      sodium: totals.sodium + (meal.sodium || 0)
    }), {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0
    });
  }, [selectedDateMeals]);

  const mealsByType = useMemo(() => {
    const grouped = selectedDateMeals.reduce((acc, meal) => {
      if (!acc[meal.type]) acc[meal.type] = [];
      acc[meal.type].push(meal);
      return acc;
    }, {} as { [key: string]: Meal[] });

    return {
      breakfast: grouped.breakfast || [],
      lunch: grouped.lunch || [],
      dinner: grouped.dinner || [],
      snack: grouped.snack || []
    };
  }, [selectedDateMeals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const mealData = {
        name: sanitizeString(newMeal.name),
        type: newMeal.type,
        calories: sanitizeNumber(newMeal.calories) || 0,
        protein: sanitizeNumber(newMeal.protein) || 0,
        carbs: sanitizeNumber(newMeal.carbs) || 0,
        fat: sanitizeNumber(newMeal.fat) || 0,
        fiber: sanitizeNumber(newMeal.fiber) || undefined,
        sugar: sanitizeNumber(newMeal.sugar) || undefined,
        sodium: sanitizeNumber(newMeal.sodium) || undefined,
        servingSize: sanitizeString(newMeal.servingSize) || undefined,
        notes: sanitizeString(newMeal.notes) || undefined,
        date: selectedDate,
        userId: user?.id
      };

      if (editingMeal) {
        await updateMeal(editingMeal.id, mealData);
        push("Meal updated successfully!", { type: "success" });
      } else {
        await logMeal(mealData);
        push("Meal logged successfully!", { type: "success" });
      }

      setNewMeal({
        name: '',
        type: 'breakfast',
        calories: '',
        protein: '',
        carbs: '',
        fat: '',
        fiber: '',
        sugar: '',
        sodium: '',
        servingSize: '',
        notes: ''
      });
      setShowAddMeal(false);
      setEditingMeal(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save meal";
      setErrors({ general: message });
      push(message, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditMeal = (meal: Meal) => {
    setEditingMeal(meal);
    setNewMeal({
      name: meal.name,
      type: meal.type,
      calories: meal.calories.toString(),
      protein: meal.protein.toString(),
      carbs: meal.carbs.toString(),
      fat: meal.fat.toString(),
      fiber: meal.fiber?.toString() || '',
      sugar: meal.sugar?.toString() || '',
      sodium: meal.sodium?.toString() || '',
      servingSize: meal.servingSize || '',
      notes: meal.notes || ''
    });
    setShowAddMeal(true);
  };

  const handleDeleteMeal = async (mealId: string) => {
    if (window.confirm("Are you sure you want to delete this meal?")) {
      try {
        await deleteMeal(mealId);
        push("Meal deleted successfully!", { type: "success" });
      } catch (error) {
        push("Failed to delete meal", { type: "error" });
      }
    }
  };

  const updateField = (field: string, value: string) => {
    setNewMeal(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Nutrition Tracking</h2>
        <div className="flex items-center gap-4">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Button onClick={() => setShowAddMeal(true)}>Log Meal</Button>
        </div>
      </div>

      {/* Daily Summary */}
      <Card title={`Daily Summary - ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-[var(--primary)]">{Math.round(dailyTotals.calories)}</div>
            <div className="text-sm text-[var(--muted-foreground)]">Calories</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{Math.round(dailyTotals.protein)}</div>
            <div className="text-sm text-[var(--muted-foreground)]">Protein (g)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{Math.round(dailyTotals.carbs)}</div>
            <div className="text-sm text-[var(--muted-foreground)]">Carbs (g)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{Math.round(dailyTotals.fat)}</div>
            <div className="text-sm text-[var(--muted-foreground)]">Fat (g)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{Math.round(dailyTotals.fiber)}</div>
            <div className="text-sm text-[var(--muted-foreground)]">Fiber (g)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-pink-600">{Math.round(dailyTotals.sugar)}</div>
            <div className="text-sm text-[var(--muted-foreground)]">Sugar (g)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{Math.round(dailyTotals.sodium)}</div>
            <div className="text-sm text-[var(--muted-foreground)]">Sodium (mg)</div>
          </div>
        </div>
      </Card>

      {/* Meals by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(mealsByType).map(([type, meals]) => (
          <Card key={type} title={`${type.charAt(0).toUpperCase() + type.slice(1)} (${meals.length})`}>
            {meals.length > 0 ? (
              <div className="space-y-3">
                {meals.map((meal: Meal) => (
                  <div key={meal.id} className="p-3 bg-[var(--secondary)] rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-[var(--foreground)]">{meal.name}</div>
                        {meal.servingSize && (
                          <div className="text-sm text-[var(--muted-foreground)]">{meal.servingSize}</div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleEditMeal(meal)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteMeal(meal.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-[var(--muted-foreground)]">Cal:</span>
                        <span className="text-[var(--foreground)] ml-1">{meal.calories}</span>
                      </div>
                      <div>
                        <span className="text-[var(--muted-foreground)]">P:</span>
                        <span className="text-[var(--foreground)] ml-1">{meal.protein}g</span>
                      </div>
                      <div>
                        <span className="text-[var(--muted-foreground)]">C:</span>
                        <span className="text-[var(--foreground)] ml-1">{meal.carbs}g</span>
                      </div>
                      <div>
                        <span className="text-[var(--muted-foreground)]">F:</span>
                        <span className="text-[var(--foreground)] ml-1">{meal.fat}g</span>
                      </div>
                    </div>

                    {meal.notes && (
                      <div className="mt-2 text-sm text-[var(--muted-foreground)]">{meal.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--muted-foreground)]">
                <div className="text-3xl mb-2">
                  {type === 'breakfast' ? '🥞' : type === 'lunch' ? '🥗' : type === 'dinner' ? '🍽️' : '🍎'}
                </div>
                <div>No {type} logged</div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="mt-2"
                  onClick={() => {
                    setNewMeal(prev => ({ ...prev, type: type as any }));
                    setShowAddMeal(true);
                  }}
                >
                  Add {type}
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Modal 
        isOpen={showAddMeal} 
        onClose={() => {
          setShowAddMeal(false);
          setEditingMeal(null);
          setNewMeal({
            name: '',
            type: 'breakfast',
            calories: '',
            protein: '',
            carbs: '',
            fat: '',
            fiber: '',
            sugar: '',
            sodium: '',
            servingSize: '',
            notes: ''
          });
        }} 
        title={editingMeal ? "Edit Meal" : "Log New Meal"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Meal Name"
              value={newMeal.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g., Grilled Chicken Salad"
              required
              error={errors.name}
            />
            
            <Select
              label="Meal Type"
              value={newMeal.type}
              onChange={(e) => updateField("type", e.target.value)}
              options={[
                { value: 'breakfast', label: 'Breakfast' },
                { value: 'lunch', label: 'Lunch' },
                { value: 'dinner', label: 'Dinner' },
                { value: 'snack', label: 'Snack' }
              ]}
              required
            />
          </div>

          <Input
            label="Serving Size (Optional)"
            value={newMeal.servingSize}
            onChange={(e) => updateField("servingSize", e.target.value)}
            placeholder="e.g., 1 cup, 200g, 1 piece"
          />

          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Nutrition Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input
                label="Calories"
                type="number"
                value={newMeal.calories}
                onChange={(e) => updateField("calories", e.target.value)}
                placeholder="250"
                min={0}
                max={5000}
                required
                error={errors.calories}
              />
              
              <Input
                label="Protein (g)"
                type="number"
                value={newMeal.protein}
                onChange={(e) => updateField("protein", e.target.value)}
                placeholder="25"
                min={0}
                max={500}
                step={0.1}
                required
                error={errors.protein}
              />
              
              <Input
                label="Carbs (g)"
                type="number"
                value={newMeal.carbs}
                onChange={(e) => updateField("carbs", e.target.value)}
                placeholder="30"
                min={0}
                max={1000}
                step={0.1}
                required
                error={errors.carbs}
              />
              
              <Input
                label="Fat (g)"
                type="number"
                value={newMeal.fat}
                onChange={(e) => updateField("fat", e.target.value)}
                placeholder="10"
                min={0}
                max={500}
                step={0.1}
                required
                error={errors.fat}
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Additional Info (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Fiber (g)"
                type="number"
                value={newMeal.fiber}
                onChange={(e) => updateField("fiber", e.target.value)}
                placeholder="5"
                min={0}
                max={100}
                step={0.1}
              />
              
              <Input
                label="Sugar (g)"
                type="number"
                value={newMeal.sugar}
                onChange={(e) => updateField("sugar", e.target.value)}
                placeholder="8"
                min={0}
                max={500}
                step={0.1}
              />
              
              <Input
                label="Sodium (mg)"
                type="number"
                value={newMeal.sodium}
                onChange={(e) => updateField("sodium", e.target.value)}
                placeholder="300"
                min={0}
                max={10000}
                step={1}
              />
            </div>
          </div>

          <Textarea
            label="Notes"
            value={newMeal.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="Any additional notes about this meal..."
            rows={3}
          />

          {errors.general && (
            <div className="text-red-500 text-sm">{errors.general}</div>
          )}

          <div className="flex gap-3">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => {
                setShowAddMeal(false);
                setEditingMeal(null);
              }} 
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Saving..." : editingMeal ? "Update Meal" : "Log Meal"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* -------------------- Chat Page -------------------- */
function ChatPage() {
  const { session, getUser, users } = useAuth();
  const { appData, sendMessage, markMessageRead } = useData();
  const { push } = useToast();
  const user = session ? getUser(session.userId) : null;
  
  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Get available contacts based on user role
  const contacts = useMemo(() => {
    if (!user) return [];
    
    if (user.role === 'trainer') {
      // Trainers can message their clients
      return users.filter(u => u.role === 'client' && u.trainerId === user.id);
    } else {
      // Clients can message their trainer
      const trainer = users.find(u => u.id === user.trainerId);
      return trainer ? [trainer] : [];
    }
  }, [user, users]);

  // Get messages between current user and selected contact
  const messages = useMemo(() => {
    if (!user || !selectedContact) return [];
    
    return appData.messages?.filter((m: Message) => 
      (m.senderId === user.id && m.receiverId === selectedContact.id) ||
      (m.senderId === selectedContact.id && m.receiverId === user.id)
    ).sort((a: Message, b: Message) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ) || [];
  }, [appData.messages, user, selectedContact]);

  // Get unread message counts for each contact
  const unreadCounts = useMemo(() => {
    if (!user) return {};
    
    const counts: { [key: string]: number } = {};
    contacts.forEach(contact => {
      counts[contact.id] = appData.messages?.filter((m: Message) => 
        m.senderId === contact.id && m.receiverId === user.id && !m.read
      ).length || 0;
    });
    
    return counts;
  }, [appData.messages, user, contacts]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContact || !user) return;

    setLoading(true);
    try {
      await sendMessage({
        senderId: user.id,
        receiverId: selectedContact.id,
        content: sanitizeString(newMessage.trim())
      });
      
      setNewMessage('');
      push("Message sent!", { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send message";
      push(message, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContact = async (contact: User) => {
    setSelectedContact(contact);
    
    // Mark messages from this contact as read
    if (user) {
      const unreadMessages = appData.messages?.filter((m: Message) => 
        m.senderId === contact.id && m.receiverId === user.id && !m.read
      ) || [];
      
      for (const message of unreadMessages) {
        await markMessageRead(message.id);
      }
    }
  };

  if (user?.role !== 'trainer' && user?.role !== 'client') {
    return (
      <Card title="Access Restricted">
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🚫</div>
          <div className="text-[var(--muted-foreground)]">Chat is only available to trainers and clients</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[var(--foreground)]">Messages</h2>

      {contacts.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
          {/* Contacts List */}
          <Card title="Contacts" className="lg:col-span-1">
            <div className="space-y-2">
              {contacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => handleSelectContact(contact)}
                  className={`w-full p-3 rounded-lg text-left transition-colors duration-200 ${
                    selectedContact?.id === contact.id 
                      ? 'bg-[var(--primary)] text-white' 
                      : 'bg-[var(--secondary)] hover:bg-[var(--accent)] text-[var(--foreground)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {contact.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-medium">{contact.name}</div>
                        <div className={`text-sm ${
                          selectedContact?.id === contact.id ? 'text-white/70' : 'text-[var(--muted-foreground)]'
                        }`}>
                          {contact.role === 'trainer' ? 'Your Trainer' : 'Client'}
                        </div>
                      </div>
                    </div>
                    {unreadCounts[contact.id] > 0 && (
                      <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadCounts[contact.id]}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Chat Area */}
          <Card title={selectedContact ? `Chat with ${selectedContact.name}` : "Select a contact"} className="lg:col-span-2">
            {selectedContact ? (
              <div className="flex flex-col h-[500px]">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-3 mb-4 p-2">
                  {messages.length > 0 ? (
                    messages.map((message: Message) => (
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
                          <div
                            className={`text-xs mt-1 ${
                              message.senderId === user?.id ? 'text-white/70' : 'text-[var(--muted-foreground)]'
                            }`}
                          >
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
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 p-2 border border-[var(--input)] rounded-lg bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    disabled={loading}
                  />
                  <Button type="submit" disabled={loading || !newMessage.trim()}>
                    {loading ? "Sending..." : "Send"}
                  </Button>
                </form>
              </div>
            ) : (
              <div className="text-center py-12 text-[var(--muted-foreground)]">
                <div className="text-6xl mb-4">💬</div>
                <div>Select a contact to start chatting</div>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">No contacts available</h3>
            <p className="text-[var(--muted-foreground)] mb-6">
              {user?.role === 'trainer' 
                ? "Add clients to start messaging them" 
                : "You'll be able to message your trainer once assigned"
              }
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

/* -------------------- Settings Page -------------------- */
function SettingsPage() {
  const { settings, update } = useSettings();
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[var(--foreground)]">Settings</h2>
      <SettingsPanel external={{ settings, update }} />
    </div>
  );
}

/* -------------------- Main App -------------------- */
function App() {
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { session, logout, getUser } = useAuth();
  const { push } = useToast();
  const { settings } = useSettings();

  const user = session ? getUser(session.userId) : null;

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setShowAuth(!session);
  }, [session]);

  const handleLogin = (user: User) => {
    setShowAuth(false);
    push(`Welcome back, ${user.name}!`, { type: "success" });
  };

  const handleRegister = (user: User) => {
    setShowAuth(false);
    push(`Welcome to FitnessPro, ${user.name}!`, { type: "success" });
  };

  const handleLogout = () => {
    logout();
    setCurrentPage("dashboard");
    setSidebarOpen(false);
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "🏠", roles: ["trainer", "client"] },
    { id: "workouts", label: "Workouts", icon: "💪", roles: ["trainer", "client"] },
    { id: "progress", label: "Progress", icon: "📊", roles: ["client"] },
    { id: "meals", label: "Nutrition", icon: "🍽️", roles: ["client"] },
    { id: "stats", label: "Statistics", icon: "📈", roles: ["trainer", "client"] },
    { id: "clients", label: "Clients", icon: "👥", roles: ["trainer"] },
    { id: "chat", label: "Messages", icon: "💬", roles: ["trainer", "client"] },
    { id: "settings", label: "Settings", icon: "⚙️", roles: ["trainer", "client"] },
  ];

  const availableNavItems = navItems.filter(item => 
    !user || item.roles.includes(user.role)
  );

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard": return <DashboardPage />;
      case "clients": return <ClientsPage />;
      case "workouts": return <WorkoutsPage />;
      case "progress": return <ProgressPage />;
      case "stats": return <StatsPage />;
      case "meals": return <MealsPage />;
      case "chat": return <ChatPage />;
      case "settings": return <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (showAuth) {
    return authMode === "login" ? (
      <LoginPage 
        onLogin={handleLogin} 
        onShowRegister={() => setAuthMode("register")} 
      />
    ) : (
      <RegisterPage 
        onRegister={handleRegister} 
        onShowLogin={() => setAuthMode("login")} 
      />
    );
  }

  return (
    <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-40 w-64 h-full bg-[var(--card)] border-r border-[var(--border)] transition-transform duration-300 ease-in-out`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <LogoPlaceholder size={40} />
              <div>
                <div className="font-bold text-[var(--foreground)]">FitnessPro</div>
                <div className="text-xs text-[var(--muted-foreground)]">Fitness Platform</div>
              </div>
            </div>
          </div>
          
          <nav className="flex-1 p-4">
            <div className="space-y-2">
              {availableNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                    currentPage === item.id
                      ? 'bg-[var(--primary)] text-white'
                      : 'text-[var(--foreground)] hover:bg-[var(--secondary)]'
                  } ${settings.animations ? 'hover:scale-105' : ''}`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </nav>
          
          {user && (
            <div className="p-4 border-t border-[var(--border)]">
              <div className="flex items-center gap-3 p-3 bg-[var(--secondary)] rounded-lg">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--foreground)] truncate">{user.name}</div>
                  <div className="text-sm text-[var(--muted-foreground)] capitalize">{user.role}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar 
          title={availableNavItems.find(item => item.id === currentPage)?.label || "Dashboard"}
          onLogout={handleLogout}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <main className="flex-1 overflow-y-auto p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function AppWithProviders() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <AuthProvider>
          <DataProvider>
            <App />
          </DataProvider>
        </AuthProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}