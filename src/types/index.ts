// Core Types
export type UserRole = "trainer" | "client";

export type User = {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  password?: string; // Only for local storage, not for Firebase
  clients?: User[];
  trainerId?: string;
  activityLog?: ActivityLogEntry[];
  avatar?: string;
  phone?: string;
  dateJoined?: string;
  isActive?: boolean;
  lastLogin?: string;
  preferences?: UserPreferences;
};

export type ActivityLogEntry = {
  msg: string;
  time: string;
  type?: 'info' | 'success' | 'warning' | 'error';
};

export type UserPreferences = {
  notifications: boolean;
  emailUpdates: boolean;
  theme: 'auto' | 'light' | 'dark';
  language: string;
};

export type WorkoutExercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  duration?: number; // in minutes
  notes?: string;
  restTime?: number; // in seconds
  targetMuscleGroup?: string;
};

export type Workout = {
  id: string;
  name: string;
  date: string;
  exercises: WorkoutExercise[];
  completed: boolean;
  duration?: number;
  calories?: number;
  notes?: string;
  clientId?: string;
  trainerId?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  category?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Meal = {
  id: string;
  name: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  date: string;
  notes?: string;
  ingredients?: string[];
  servingSize?: string;
  userId?: string;
};

export type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
  type?: 'text' | 'image' | 'file';
  attachments?: string[];
};

export type ProgressEntry = {
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
    neck?: number;
  };
  photos?: string[];
  notes?: string;
  userId?: string;
  mood?: number; // 1-10 scale
  energy?: number; // 1-10 scale
  sleep?: number; // hours
};

export type AppSettings = {
  theme: 'auto' | 'light' | 'dark';
  primary: string;
  compact: boolean;
  animations: boolean;
  timezone: string;
  telemetry: boolean;
  notifications: boolean;
  language: string;
};

export type Toast = {
  id: string;
  msg: React.ReactNode;
  type?: "info" | "error" | "success" | "warning";
  ttl?: number;
};

export type ValidationError = {
  field: string;
  message: string;
};

export type DatabaseConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
};

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};