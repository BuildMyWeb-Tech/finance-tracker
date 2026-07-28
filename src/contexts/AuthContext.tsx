/**
 * AuthContext.tsx
 * Handles login/logout with localStorage token persistence.
 * clearAuthToken is imported from LoginPage to clear on logout.
 */

import { createContext, useContext, useState, ReactNode } from 'react';

const TOKEN_KEY = 'finance_auth_token';

function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── Credentials store ─────────────────────────────────────────────────────
// Add / change credentials here
const USERS: Record<string, string> = {
  ajai: 'ajai123',
  appa: 'appa123',
  amma: 'amma123',
  mauli: 'mauli123',
  admin: 'admin123',
};

// ─── Types ─────────────────────────────────────────────────────────────────

interface AuthContextType {
  isLoggedIn: boolean;
  currentUser: string | null;
  login: (userId: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// ─── Provider ──────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  const login = (userId: string, password: string): { success: boolean; error?: string } => {
    const uid = userId.trim().toLowerCase();
    const expected = USERS[uid];
    if (!expected) return { success: false, error: 'User not found' };
    if (expected !== password) return { success: false, error: 'Incorrect password' };
    setIsLoggedIn(true);
    setCurrentUser(uid);
    return { success: true };
  };

  const logout = () => {
    clearAuthToken();
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}