import { useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { firebaseAuth } from '../services/firebase';
import { validateData, userRegistrationSchema } from '../utils/validation';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });

  const setError = useCallback((error: string | null) => {
    setAuthState(prev => ({ ...prev, error }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setAuthState(prev => ({ ...prev, loading }));
  }, []);

  const setUser = useCallback((user: User | null) => {
    setAuthState(prev => ({ ...prev, user, loading: false }));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await firebaseAuth.signIn(email, password);
      // Convert Firebase user to app user
      const user: User = {
        id: result.user.uid,
        email: result.user.email || email,
        name: result.user.displayName || 'User',
        role: 'client', // Default role, should be fetched from custom claims
        isActive: true,
        dateJoined: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };
      setUser(user);
      return user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign in failed';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setUser]);

  const signUp = useCallback(async (userData: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    role: 'trainer' | 'client';
    phone?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      // Validate input data
      const validation = validateData(userRegistrationSchema, userData);
      if (!validation.success) {
        throw new Error(validation.errors[0].message);
      }

      const result = await firebaseAuth.signUp(userData.email, userData.password, userData.name);
      
      // Set custom claims for role
      await firebaseAuth.setCustomClaims(result.user.uid, { role: userData.role });

      const user: User = {
        id: result.user.uid,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        phone: userData.phone,
        isActive: true,
        dateJoined: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      setUser(user);
      return user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign up failed';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setUser]);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await firebaseAuth.signOut();
      setUser(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign out failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setUser]);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      await firebaseAuth.resetPassword(email);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password reset failed';
      setError(errorMessage);
      throw error;
    }
  }, [setError]);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const claims = await firebaseAuth.getCustomClaims(firebaseUser.uid);
          const user: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'User',
            role: claims?.role || 'client',
            isActive: true,
            dateJoined: new Date().toISOString(),
            lastLogin: new Date().toISOString()
          };
          setUser(user);
        } catch (error) {
          console.error('Error fetching user claims:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
    });

    return unsubscribe;
  }, [setUser]);

  return {
    ...authState,
    signIn,
    signUp,
    signOut,
    resetPassword,
    clearError: () => setError(null)
  };
}