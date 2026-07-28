/**
 * LoginPage.tsx
 * Family Finance login with Ajai quick-login + localStorage token (30-day persist).
 */

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const TOKEN_KEY = 'finance_auth_token';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface AuthToken {
  userId: string;
  password: string;
  expiresAt: number;
}

export function saveAuthToken(userId: string, password: string) {
  const token: AuthToken = {
    userId,
    password,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

export function loadAuthToken(): AuthToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const token: AuthToken = JSON.parse(raw);
    if (Date.now() > token.expiresAt) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // On mount: try auto-login from stored token
  useEffect(() => {
    const token = loadAuthToken();
    if (token) {
      setUserId(token.userId);
      setPassword(token.password);
      // Auto-submit after a short delay for UX
      setTimeout(() => {
        const result = login(token.userId, token.password);
        if (!result.success) {
          clearAuthToken();
        }
      }, 300);
    } else {
      inputRef.current?.focus();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password) {
      setError('Please enter both User ID and Password');
      return;
    }
    setLoading(true);
    setError('');

    await new Promise(r => setTimeout(r, 600));

    const result = login(userId, password);
    if (!result.success) {
      setError(result.error || 'Invalid credentials');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } else {
      // Save token on successful login
      saveAuthToken(userId, password);
    }
    setLoading(false);
  };

  const handleAjaiLogin = async () => {
    const AJAI_ID = 'ajai';
    const AJAI_PASS = 'ajai123';
    setUserId(AJAI_ID);
    setPassword(AJAI_PASS);
    setError('');
    setLoading(true);

    await new Promise(r => setTimeout(r, 400));

    const result = login(AJAI_ID, AJAI_PASS);
    if (!result.success) {
      setError(result.error || 'Ajai login failed');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } else {
      saveAuthToken(AJAI_ID, AJAI_PASS);
    }
    setLoading(false);
  };

  return (
    <div style={styles.root}>
      <div style={styles.bgPattern} />

      <div style={{ ...styles.card, ...(shake ? styles.shake : {}) }}>
        {/* Logo */}
        <div style={styles.logoArea}>
          <div style={styles.logoIcon}>₹</div>
          <h1 style={styles.appName}>Family Finance Tracker</h1>
        </div>

        {/* Divider */}
        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>Sign In</span>
          <div style={styles.dividerLine} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>User ID</label>
            <input
              ref={inputRef}
              type="text"
              value={userId}
              onChange={e => { setUserId(e.target.value); setError(''); }}
              placeholder="Enter user ID"
              style={styles.input}
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter password"
              style={styles.input}
              autoComplete="current-password"
              disabled={loading}
              onKeyDown={e => e.key === 'Enter' && handleSubmit(e as any)}
            />
          </div>

          {error && (
            <div style={styles.errorBox}>
              <span style={styles.errorIcon}>⚠</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
            disabled={loading}
          >
            {loading ? (
              <span style={styles.loadingDots}>
                <span style={{ ...styles.dot, animationDelay: '0ms' }} />
                <span style={{ ...styles.dot, animationDelay: '150ms' }} />
                <span style={{ ...styles.dot, animationDelay: '300ms' }} />
              </span>
            ) : (
              'Enter App →'
            )}
          </button>
        </form>

        {/* Divider */}
        <div style={{ ...styles.divider, margin: '16px 0 0' }}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>Quick Login</span>
          <div style={styles.dividerLine} />
        </div>

        {/* Ajai Quick Login */}
        <button
          type="button"
          onClick={handleAjaiLogin}
          disabled={loading}
          style={{ ...styles.ajaiButton, ...(loading ? styles.buttonDisabled : {}) }}
        >
          <span style={styles.ajaiAvatar}>A</span>
          Ajai Login
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const gold = '#C9A84C';
const darkBg = '#1A1F16';
const cardBg = '#232918';
const cream = '#F5EDDA';
const mutedCream = '#A89F8C';

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: darkBg,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '"DM Sans", sans-serif',
    padding: '20px',
    gap: '20px',
    position: 'relative',
    overflow: 'hidden',
  },
  bgPattern: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `radial-gradient(circle at 20% 20%, rgba(201,168,76,0.06) 0%, transparent 50%),
                      radial-gradient(circle at 80% 80%, rgba(76,175,115,0.05) 0%, transparent 50%)`,
    pointerEvents: 'none',
  },
  card: {
    background: cardBg,
    borderRadius: '20px',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '380px',
    border: `1px solid rgba(201,168,76,0.2)`,
    boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
    animation: 'fadeUp 0.6s ease forwards',
    position: 'relative',
    zIndex: 1,
  },
  shake: {
    animation: 'shake 0.4s ease',
  },
  logoArea: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logoIcon: {
    width: '60px',
    height: '60px',
    borderRadius: '16px',
    background: `linear-gradient(135deg, ${gold}, #A07830)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    color: '#1A1F16',
    fontWeight: '700',
    margin: '0 auto 14px',
    boxShadow: `0 8px 24px rgba(201,168,76,0.3)`,
  },
  appName: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '26px',
    fontWeight: '700',
    color: cream,
    margin: '0 0 6px',
    letterSpacing: '-0.3px',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '24px',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'rgba(201,168,76,0.15)',
  },
  dividerText: {
    fontSize: '11px',
    color: mutedCream,
    fontWeight: '500',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '500',
    color: mutedCream,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  input: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: '10px',
    padding: '12px 14px',
    fontSize: '15px',
    color: cream,
    outline: 'none',
    transition: 'border-color 0.2s, background 0.2s',
    fontFamily: '"DM Sans", sans-serif',
  },
  errorBox: {
    background: 'rgba(220,60,60,0.12)',
    border: '1px solid rgba(220,60,60,0.3)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#E88',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  errorIcon: {
    fontSize: '14px',
  },
  button: {
    background: `linear-gradient(135deg, ${gold}, #A07830)`,
    color: '#1A1F16',
    border: 'none',
    borderRadius: '12px',
    padding: '14px',
    fontSize: '15px',
    fontWeight: '600',
    fontFamily: '"DM Sans", sans-serif',
    cursor: 'pointer',
    marginTop: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '48px',
    transition: 'opacity 0.2s, transform 0.1s',
    letterSpacing: '0.3px',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  ajaiButton: {
    marginTop: '14px',
    width: '100%',
    background: 'rgba(76,175,115,0.12)',
    border: '1px solid rgba(76,175,115,0.3)',
    borderRadius: '12px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#4CAF73',
    fontFamily: '"DM Sans", sans-serif',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    transition: 'background 0.2s',
  },
  ajaiAvatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'rgba(76,175,115,0.2)',
    border: '1px solid rgba(76,175,115,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700',
    color: '#4CAF73',
  },
  loadingDots: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#1A1F16',
    display: 'inline-block',
    animation: 'bounce 1.2s infinite ease-in-out',
  },
};