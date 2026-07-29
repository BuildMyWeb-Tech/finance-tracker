/**
 * AuthContext.tsx
 * Multi-user auth: login + register. Each user has isolated DB data.
 * Credentials stored in Supabase app_config (key: registered_users).
 * Falls back to hardcoded USERS if Supabase unavailable.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { loadRegisteredUsers, registerUser as dbRegisterUser } from '@/lib/supabase-store';

const TOKEN_KEY = 'finance_auth_token';

// ─── Fallback credentials (used when Supabase unreachable) ───────────────────
const FALLBACK_USERS: Record<string, string> = {
  ajai:  'ajai123',
  appa:  'appa123',
  amma:  'amma123',
  mauli: 'mauli123',
};

// ─── Token helpers ────────────────────────────────────────────────────────────

interface AuthToken { userId: string; password: string; expiresAt: number; }
const TTL = 30 * 24 * 60 * 60 * 1000;

export function saveAuthToken(userId: string, password: string) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ userId, password, expiresAt: Date.now() + TTL }));
}
export function loadAuthToken(): AuthToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t: AuthToken = JSON.parse(raw);
    if (Date.now() > t.expiresAt) { localStorage.removeItem(TOKEN_KEY); return null; }
    return t;
  } catch { return null; }
}
export function clearAuthToken() { localStorage.removeItem(TOKEN_KEY); }

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextType {
  isLoggedIn: boolean;
  currentUser: string | null;
  authReady: boolean;
  login: (userId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  register: (userId: string, password: string, confirmPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dbUsers, setDbUsers] = useState<Record<string, string>>(FALLBACK_USERS);

  // Load registered users from DB on mount
  useEffect(() => {
    loadRegisteredUsers()
      .then(users => {
        if (Object.keys(users).length > 0) {
          setDbUsers({ ...FALLBACK_USERS, ...users });
        }
      })
      .catch(() => {}) // fallback stays
      .finally(() => {
        // Auto-login from token
        const token = loadAuthToken();
        if (token) {
          setIsLoggedIn(true);
          setCurrentUser(token.userId);
        }
        setAuthReady(true);
      });
  }, []);

  const getAllUsers = () => ({ ...FALLBACK_USERS, ...dbUsers });

  const login = async (userId: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const uid = userId.trim().toLowerCase();
    if (!uid) return { success: false, error: 'Enter a User ID' };

    // Refresh users from DB before login
    try {
      const fresh = await loadRegisteredUsers();
      if (Object.keys(fresh).length > 0) setDbUsers({ ...FALLBACK_USERS, ...fresh });
    } catch {}

    const users = getAllUsers();
    const expected = users[uid];
    if (!expected) return { success: false, error: 'User not found. Please register first.' };
    if (expected !== password) return { success: false, error: 'Incorrect password' };

    setIsLoggedIn(true);
    setCurrentUser(uid);
    saveAuthToken(uid, password);
    return { success: true };
  };

  const register = async (
    userId: string,
    password: string,
    confirmPassword: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const uid = userId.trim().toLowerCase();
    if (!uid || uid.length < 3) return { success: false, error: 'User ID must be at least 3 characters' };
    if (!/^[a-z0-9_]+$/.test(uid)) return { success: false, error: 'Only lowercase letters, numbers, underscores' };
    if (!password || password.length < 4) return { success: false, error: 'Password must be at least 4 characters' };
    if (password !== confirmPassword) return { success: false, error: 'Passwords do not match' };

    const users = getAllUsers();
    if (users[uid]) return { success: false, error: 'User ID already taken' };

    // Save to DB
    const result = await dbRegisterUser(uid, password);
    if (!result.success) {
      // Save locally as fallback
      const updated = { ...dbUsers, [uid]: password };
      setDbUsers(updated);
      localStorage.setItem('finance_local_users', JSON.stringify(updated));
    }

    // Update local state and auto-login
    setDbUsers(prev => ({ ...prev, [uid]: password }));
    setIsLoggedIn(true);
    setCurrentUser(uid);
    saveAuthToken(uid, password);
    return { success: true };
  };

  const logout = () => {
    clearAuthToken();
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, currentUser, authReady, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}