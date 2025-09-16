import { z } from 'zod';
import type { ValidationError } from '../types';

// Password validation schema
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Email validation schema
export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .min(1, 'Email is required');

// Name validation schema
export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters long')
  .max(50, 'Name must be less than 50 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

// Phone validation schema
export const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number')
  .min(10, 'Phone number must be at least 10 digits')
  .optional();

// User registration schema
export const userRegistrationSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  phone: phoneSchema,
  role: z.enum(['trainer', 'client']),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Client creation schema (for trainers)
export const clientCreationSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  temporaryPassword: passwordSchema,
});

// Workout validation schema
export const workoutExerciseSchema = z.object({
  name: z.string().min(1, 'Exercise name is required').max(100, 'Exercise name too long'),
  sets: z.number().min(1, 'Sets must be at least 1').max(20, 'Sets cannot exceed 20'),
  reps: z.number().min(1, 'Reps must be at least 1').max(1000, 'Reps cannot exceed 1000'),
  weight: z.number().min(0, 'Weight cannot be negative').max(1000, 'Weight cannot exceed 1000kg').optional(),
  duration: z.number().min(0, 'Duration cannot be negative').max(480, 'Duration cannot exceed 8 hours').optional(),
  restTime: z.number().min(0, 'Rest time cannot be negative').max(600, 'Rest time cannot exceed 10 minutes').optional(),
});

export const workoutSchema = z.object({
  name: z.string().min(1, 'Workout name is required').max(100, 'Workout name too long'),
  exercises: z.array(workoutExerciseSchema).min(1, 'At least one exercise is required'),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  category: z.string().max(50, 'Category name too long').optional(),
});

// Meal validation schema
export const mealSchema = z.object({
  name: z.string().min(1, 'Meal name is required').max(100, 'Meal name too long'),
  type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  calories: z.number().min(0, 'Calories cannot be negative').max(5000, 'Calories seem too high'),
  protein: z.number().min(0, 'Protein cannot be negative').max(500, 'Protein seems too high'),
  carbs: z.number().min(0, 'Carbs cannot be negative').max(1000, 'Carbs seem too high'),
  fat: z.number().min(0, 'Fat cannot be negative').max(500, 'Fat seems too high'),
  fiber: z.number().min(0, 'Fiber cannot be negative').max(100, 'Fiber seems too high').optional(),
  sugar: z.number().min(0, 'Sugar cannot be negative').max(500, 'Sugar seems too high').optional(),
  sodium: z.number().min(0, 'Sodium cannot be negative').max(10000, 'Sodium seems too high').optional(),
  servingSize: z.string().max(50, 'Serving size description too long').optional(),
  notes: z.string().max(300, 'Notes cannot exceed 300 characters').optional(),
});

// Progress entry validation schema
export const progressSchema = z.object({
  weight: z.number().min(20, 'Weight seems too low').max(500, 'Weight seems too high').optional(),
  bodyFat: z.number().min(1, 'Body fat percentage too low').max(60, 'Body fat percentage too high').optional(),
  muscle: z.number().min(10, 'Muscle mass seems too low').max(200, 'Muscle mass seems too high').optional(),
  measurements: z.object({
    chest: z.number().min(50, 'Chest measurement seems too low').max(200, 'Chest measurement seems too high').optional(),
    waist: z.number().min(40, 'Waist measurement seems too low').max(200, 'Waist measurement seems too high').optional(),
    hips: z.number().min(50, 'Hip measurement seems too low').max(200, 'Hip measurement seems too high').optional(),
    arms: z.number().min(15, 'Arm measurement seems too low').max(80, 'Arm measurement seems too high').optional(),
    thighs: z.number().min(30, 'Thigh measurement seems too low').max(120, 'Thigh measurement seems too high').optional(),
    neck: z.number().min(25, 'Neck measurement seems too low').max(60, 'Neck measurement seems too high').optional(),
  }).optional(),
  mood: z.number().min(1, 'Mood rating must be between 1-10').max(10, 'Mood rating must be between 1-10').optional(),
  energy: z.number().min(1, 'Energy rating must be between 1-10').max(10, 'Energy rating must be between 1-10').optional(),
  sleep: z.number().min(0, 'Sleep hours cannot be negative').max(24, 'Sleep hours cannot exceed 24').optional(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
});

// Message validation schema
export const messageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(1000, 'Message too long'),
  receiverId: z.string().min(1, 'Receiver ID is required'),
});

// Validation helper functions
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: ValidationError[] } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: ValidationError[] = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return { success: false, errors };
    }
    return { success: false, errors: [{ field: 'unknown', message: 'Validation failed' }] };
  }
}

export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

export function isValidPassword(password: string): boolean {
  return passwordSchema.safeParse(password).success;
}

export function getPasswordStrength(password: string): { score: number; feedback: string[] } {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Add uppercase letters');

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Add lowercase letters');

  if (/[0-9]/.test(password)) score += 1;
  else feedback.push('Add numbers');

  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else feedback.push('Add special characters');

  if (password.length >= 12) score += 1;

  return { score, feedback };
}

// Sanitization functions
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export function sanitizeNumber(input: string | number): number | null {
  const num = typeof input === 'string' ? parseFloat(input) : input;
  return isNaN(num) ? null : num;
}

// Date validation
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

export function isDateInRange(dateString: string, minDate?: Date, maxDate?: Date): boolean {
  const date = new Date(dateString);
  if (!isValidDate(dateString)) return false;
  
  if (minDate && date < minDate) return false;
  if (maxDate && date > maxDate) return false;
  
  return true;
}