import React, { useState, useEffect, createContext, useContext } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

// Types
interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  joinDate: string;
  membershipType: 'basic' | 'premium' | 'elite';
  goals: string[];
}

interface WorkoutSession {
  id: string;
  date: string;
  type: string;
  duration: number;
  calories: number;
  exercises: Exercise[];
  notes?: string;
}

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  duration?: number;
  category: string;
}

interface NutritionEntry {
  id: string;
  date: string;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Goal {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  deadline: string;
  category: 'fitness' | 'nutrition' | 'wellness';
}

interface AppSettings {
  theme: 'auto' | 'light' | 'dark';
  primary: string;
  compact: boolean;
  animations: boolean;
  timezone: string;
  telemetry: boolean;
}

// Context
const AuthContext = createContext<{
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}>({
  user: null,
  login: async () => {},
  logout: () => {},
  isLoading: false,
});

const SettingsContext = createContext<{
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
}>({
  settings: {
    theme: 'auto',
    primary: '#2563eb',
    compact: false,
    animations: true,
    timezone: 'UTC',
    telemetry: true,
  },
  updateSettings: () => {},
});

// Mock Data
const mockUser: User = {
  id: '1',
  name: 'Alex Johnson',
  email: 'alex@example.com',
  avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
  joinDate: '2024-01-15',
  membershipType: 'premium',
  goals: ['Lose 10kg', 'Run 5K', 'Build muscle'],
};

const mockWorkouts: WorkoutSession[] = [
  {
    id: '1',
    date: '2024-12-20',
    type: 'Strength Training',
    duration: 60,
    calories: 350,
    exercises: [
      { id: '1', name: 'Bench Press', sets: 3, reps: 10, weight: 80, category: 'chest' },
      { id: '2', name: 'Squats', sets: 3, reps: 12, weight: 100, category: 'legs' },
    ],
    notes: 'Great session, felt strong today!',
  },
  {
    id: '2',
    date: '2024-12-19',
    type: 'Cardio',
    duration: 45,
    calories: 420,
    exercises: [
      { id: '3', name: 'Treadmill Run', sets: 1, reps: 1, duration: 30, category: 'cardio' },
      { id: '4', name: 'Cycling', sets: 1, reps: 1, duration: 15, category: 'cardio' },
    ],
  },
];

const mockNutrition: NutritionEntry[] = [
  {
    id: '1',
    date: '2024-12-20',
    meal: 'breakfast',
    food: 'Oatmeal with berries',
    calories: 320,
    protein: 12,
    carbs: 58,
    fat: 6,
  },
  {
    id: '2',
    date: '2024-12-20',
    meal: 'lunch',
    food: 'Grilled chicken salad',
    calories: 450,
    protein: 35,
    carbs: 20,
    fat: 25,
  },
];

const mockGoals: Goal[] = [
  {
    id: '1',
    title: 'Weight Loss',
    target: 10,
    current: 3.5,
    unit: 'kg',
    deadline: '2025-06-01',
    category: 'fitness',
  },
  {
    id: '2',
    title: 'Daily Steps',
    target: 10000,
    current: 7500,
    unit: 'steps',
    deadline: '2024-12-31',
    category: 'wellness',
  },
];

// Chart data
const weeklyProgressData = [
  { day: 'Mon', calories: 2200, steps: 8500, weight: 75.2 },
  { day: 'Tue', calories: 2100, steps: 9200, weight: 75.0 },
  { day: 'Wed', calories: 2300, steps: 7800, weight: 74.8 },
  { day: 'Thu', calories: 2000, steps: 10500, weight: 74.6 },
  { day: 'Fri', calories: 2250, steps: 9800, weight: 74.5 },
  { day: 'Sat', calories: 2400, steps: 12000, weight: 74.3 },
  { day: 'Sun', calories: 2150, steps: 8900, weight: 74.1 },
];

const workoutTypeData = [
  { name: 'Strength', value: 40, color: '#2563eb' },
  { name: 'Cardio', value: 35, color: '#16a34a' },
  { name: 'Flexibility', value: 15, color: '#dc2626' },
  { name: 'Sports', value: 10, color: '#ca8a04' },
];

// Components
const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate auth check
    setTimeout(() => {
      setUser(mockUser);
      setIsLoading(false);
    }, 1000);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    // Simulate login
    setTimeout(() => {
      setUser(mockUser);
      setIsLoading(false);
    }, 1500);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'auto',
    primary: '#2563eb',
    compact: false,
    animations: true,
    timezone: 'UTC',
    telemetry: true,
  });

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

const LoginForm: React.FC = () => {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await login(email, password);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg animate-fade-in">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
          <p className="mt-2 text-gray-600">Sign in to your fitness dashboard</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your password"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

const Sidebar: React.FC<{ activeTab: string; setActiveTab: (tab: string) => void }> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useContext(AuthContext);
  const { settings } = useContext(SettingsContext);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'workouts', label: 'Workouts', icon: '💪' },
    { id: 'nutrition', label: 'Nutrition', icon: '🥗' },
    { id: 'goals', label: 'Goals', icon: '🎯' },
    { id: 'progress', label: 'Progress', icon: '📈' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className={`bg-white shadow-lg h-full flex flex-col ${settings.compact ? 'w-16' : 'w-64'} transition-all duration-300`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          {user?.avatar && (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          )}
          {!settings.compact && (
            <div>
              <h3 className="font-semibold text-gray-900">{user?.name}</h3>
              <p className="text-sm text-gray-500 capitalize">{user?.membershipType}</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === item.id
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {!settings.compact && <span className="font-medium">{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={logout}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors ${
            settings.compact ? 'justify-center' : ''
          }`}
        >
          <span className="text-xl">🚪</span>
          {!settings.compact && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  change?: string;
  icon: string;
  color?: string;
}> = ({ title, value, change, icon, color = 'blue' }) => {
  const { settings } = useContext(SettingsContext);
  
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${settings.compact ? 'p-4' : 'p-6'} animate-fade-in`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <p className={`text-sm mt-1 ${change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
              {change}
            </p>
          )}
        </div>
        <div className={`text-3xl opacity-80`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { settings } = useContext(SettingsContext);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Today's Calories"
          value="2,150"
          change="+5%"
          icon="🔥"
          color="red"
        />
        <StatCard
          title="Steps"
          value="8,547"
          change="+12%"
          icon="👟"
          color="green"
        />
        <StatCard
          title="Workouts This Week"
          value="4"
          change="+1"
          icon="💪"
          color="blue"
        />
        <StatCard
          title="Weight"
          value="74.1 kg"
          change="-0.5kg"
          icon="⚖️"
          color="purple"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Progress</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyProgressData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="weight" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Workout Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={workoutTypeData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {workoutTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {mockWorkouts.slice(0, 3).map((workout) => (
            <div key={workout.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">
                    {workout.type === 'Strength Training' ? '💪' : '🏃'}
                  </span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{workout.type}</h4>
                  <p className="text-sm text-gray-500">{workout.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900">{workout.duration} min</p>
                <p className="text-sm text-gray-500">{workout.calories} cal</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const WorkoutsTab: React.FC = () => {
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutSession | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Workouts</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          + New Workout
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Workouts</h3>
            <div className="space-y-4">
              {mockWorkouts.map((workout) => (
                <div
                  key={workout.id}
                  className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setSelectedWorkout(workout)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{workout.type}</h4>
                      <p className="text-sm text-gray-500">{workout.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{workout.duration} min</p>
                      <p className="text-sm text-gray-500">{workout.calories} cal</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">
                      {workout.exercises.length} exercises
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Workout Details</h3>
            {selectedWorkout ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900">{selectedWorkout.type}</h4>
                  <p className="text-sm text-gray-500">{selectedWorkout.date}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Duration</p>
                    <p className="font-medium">{selectedWorkout.duration} min</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Calories</p>
                    <p className="font-medium">{selectedWorkout.calories}</p>
                  </div>
                </div>
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Exercises</h5>
                  <div className="space-y-2">
                    {selectedWorkout.exercises.map((exercise) => (
                      <div key={exercise.id} className="p-2 bg-gray-50 rounded">
                        <p className="font-medium text-sm">{exercise.name}</p>
                        <p className="text-xs text-gray-500">
                          {exercise.sets} sets × {exercise.reps} reps
                          {exercise.weight && ` @ ${exercise.weight}kg`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedWorkout.notes && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Notes</h5>
                    <p className="text-sm text-gray-600">{selectedWorkout.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Select a workout to view details
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const NutritionTab: React.FC = () => {
  const todayNutrition = mockNutrition.filter(entry => entry.date === '2024-12-20');
  const totalCalories = todayNutrition.reduce((sum, entry) => sum + entry.calories, 0);
  const totalProtein = todayNutrition.reduce((sum, entry) => sum + entry.protein, 0);
  const totalCarbs = todayNutrition.reduce((sum, entry) => sum + entry.carbs, 0);
  const totalFat = todayNutrition.reduce((sum, entry) => sum + entry.fat, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Nutrition</h1>
        <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
          + Log Food
        </button>
      </div>

      {/* Daily Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Calories" value={totalCalories} icon="🔥" />
        <StatCard title="Protein" value={`${totalProtein}g`} icon="🥩" />
        <StatCard title="Carbs" value={`${totalCarbs}g`} icon="🍞" />
        <StatCard title="Fat" value={`${totalFat}g`} icon="🥑" />
      </div>

      {/* Meals */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Meals</h3>
        <div className="space-y-4">
          {['breakfast', 'lunch', 'dinner', 'snack'].map((mealType) => {
            const mealEntries = todayNutrition.filter(entry => entry.meal === mealType);
            const mealCalories = mealEntries.reduce((sum, entry) => sum + entry.calories, 0);
            
            return (
              <div key={mealType} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 capitalize">{mealType}</h4>
                  <span className="text-sm text-gray-500">{mealCalories} cal</span>
                </div>
                {mealEntries.length > 0 ? (
                  <div className="space-y-2">
                    {mealEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{entry.food}</span>
                        <span className="text-gray-500">{entry.calories} cal</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No food logged</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const GoalsTab: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Goals</h1>
        <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
          + New Goal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mockGoals.map((goal) => {
          const progress = (goal.current / goal.target) * 100;
          
          return (
            <div key={goal.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  goal.category === 'fitness' ? 'bg-blue-100 text-blue-800' :
                  goal.category === 'nutrition' ? 'bg-green-100 text-green-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {goal.category}
                </span>
              </div>
              
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>{goal.current} {goal.unit}</span>
                  <span>{goal.target} {goal.unit}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  ></div>
                </div>
                <div className="text-center mt-2">
                  <span className="text-sm font-medium text-gray-900">
                    {progress.toFixed(1)}% Complete
                  </span>
                </div>
              </div>
              
              <div className="text-sm text-gray-500">
                <p>Deadline: {new Date(goal.deadline).toLocaleDateString()}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ProgressTab: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Progress</h1>
        <div className="flex space-x-2">
          <button className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Week
          </button>
          <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">
            Month
          </button>
          <button className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Year
          </button>
        </div>
      </div>

      {/* Weight Progress */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Weight Progress</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={weeklyProgressData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="weight" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.1} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Activity Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Steps</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyProgressData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="steps" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Calories Burned</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyProgressData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="calories" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const SettingsTab: React.FC = () => {
  const { settings, updateSettings } = useContext(SettingsContext);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Appearance</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">Theme</label>
              <p className="text-sm text-gray-500">Choose your preferred theme</p>
            </div>
            <select
              value={settings.theme}
              onChange={(e) => updateSettings({ theme: e.target.value as 'auto' | 'light' | 'dark' })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">Compact Mode</label>
              <p className="text-sm text-gray-500">Reduce spacing for more content</p>
            </div>
            <input
              type="checkbox"
              checked={settings.compact}
              onChange={(e) => updateSettings({ compact: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">Animations</label>
              <p className="text-sm text-gray-500">Enable smooth transitions</p>
            </div>
            <input
              type="checkbox"
              checked={settings.animations}
              onChange={(e) => updateSettings({ animations: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Privacy</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">Analytics</label>
              <p className="text-sm text-gray-500">Help improve the app with usage data</p>
            </div>
            <input
              type="checkbox"
              checked={settings.telemetry}
              onChange={(e) => updateSettings({ telemetry: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const MainContent: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'workouts':
        return <WorkoutsTab />;
      case 'nutrition':
        return <NutritionTab />;
      case 'goals':
        return <GoalsTab />;
      case 'progress':
        return <ProgressTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-6">
        {renderContent()}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <SettingsProvider>
      <AuthProvider>
        <AuthContext.Consumer>
          {({ user, isLoading }) => {
            if (isLoading) {
              return <LoadingSpinner />;
            }

            if (!user) {
              return <LoginForm />;
            }

            return (
              <div className="flex h-screen bg-gray-100">
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
                <MainContent activeTab={activeTab} />
              </div>
            );
          }}
        </AuthContext.Consumer>
      </AuthProvider>
    </SettingsProvider>
  );
};

export default App;