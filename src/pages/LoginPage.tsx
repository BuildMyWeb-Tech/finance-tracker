/**
 * LoginPage.tsx — Login + Register tabs
 * Each user's data is isolated in Supabase by userId.
 */

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type AuthTab = 'login' | 'register';

export default function LoginPage() {
  const { login, register, authReady } = useAuth();

  const [tab, setTab]               = useState<AuthTab>('login');
  const [userId, setUserId]         = useState('');
  const [password, setPassword]     = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [shake, setShake]           = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authReady) inputRef.current?.focus();
  }, [authReady]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleLogin = async (uid = userId, pwd = password) => {
    if (!uid.trim() || !pwd) { setError('Please enter User ID and Password'); return; }
    setLoading(true); setError('');
    const result = await login(uid.trim(), pwd);
    if (!result.success) { setError(result.error || 'Login failed'); triggerShake(); }
    setLoading(false);
  };

  const handleRegister = async () => {
    setLoading(true); setError('');
    const result = await register(userId, password, confirmPass);
    if (!result.success) { setError(result.error || 'Registration failed'); triggerShake(); }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'login') handleLogin();
    else handleRegister();
  };

  const quickLogin = async (uid: string, pwd: string) => {
    setUserId(uid); setPassword(pwd); setError(''); setLoading(true);
    const result = await login(uid, pwd);
    if (!result.success) { setError(result.error || 'Quick login failed'); triggerShake(); }
    setLoading(false);
  };

  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', background: '#1A1F16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#C9A84C', fontSize: 28 }}>₹</div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <div style={s.bgPattern} />
      <div style={{ ...s.card, ...(shake ? s.shake : {}) }}>

        {/* Logo */}
        <div style={s.logoArea}>
          <div style={s.logoIcon}>₹</div>
          <h1 style={s.appName}>Family Finance Tracker</h1>
          <p style={s.subtitle}>Your data, your privacy</p>
        </div>

        {/* Tab switcher */}
        <div style={s.tabRow}>
          {(['login', 'register'] as AuthTab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              style={{ ...s.tabBtn, ...(tab === t ? s.tabBtnActive : {}) }}
            >
              {t === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>User ID</label>
            <input
              ref={inputRef}
              type="text"
              value={userId}
              onChange={e => { setUserId(e.target.value); setError(''); }}
              placeholder={tab === 'register' ? 'Choose a unique ID (e.g. ajai2)' : 'Enter your User ID'}
              style={s.input}
              autoComplete="username"
              disabled={loading}
              autoCapitalize="none"
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter password"
              style={s.input}
              autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
              disabled={loading}
            />
          </div>

          {tab === 'register' && (
            <div style={s.field}>
              <label style={s.label}>Confirm Password</label>
              <input
                type="password"
                value={confirmPass}
                onChange={e => { setConfirmPass(e.target.value); setError(''); }}
                placeholder="Re-enter password"
                style={s.input}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>
          )}

          {error && (
            <div style={s.errorBox}>
              <span style={s.errorIcon}>⚠</span> {error}
            </div>
          )}

          {tab === 'register' && (
            <div style={s.infoBox}>
              <p style={{ margin: 0, fontSize: 11, color: '#8db8a0', lineHeight: 1.5 }}>
                ✓ Your data is stored separately from other users<br />
                ✓ Only you can see your transactions<br />
                ✓ Remember your User ID and Password
              </p>
            </div>
          )}

          <button
            type="submit"
            style={{ ...s.button, ...(loading ? s.buttonDisabled : {}) }}
            disabled={loading}
          >
            {loading ? (
              <span style={s.loadingDots}>
                <span style={{ ...s.dot, animationDelay: '0ms' }} />
                <span style={{ ...s.dot, animationDelay: '150ms' }} />
                <span style={{ ...s.dot, animationDelay: '300ms' }} />
              </span>
            ) : tab === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>
        </form>

        {/* Quick logins — only on login tab */}
        {tab === 'login' && (
          <>
            <div style={{ ...s.divider, margin: '18px 0 0' }}>
              <div style={s.dividerLine} />
              <span style={s.dividerText}>Quick Login</span>
              <div style={s.dividerLine} />
            </div>
            <div style={s.quickRow}>
              {[
                { id: 'ajai', label: 'Ajai', color: '#4CAF73' },
                { id: 'appa', label: 'Appa', color: '#C9A84C' },
                { id: 'amma', label: 'Amma', color: '#a78bfa' },
                { id: 'mauli', label: 'Mauli', color: '#f472b6' },
              ].map(u => (
                <button
                  key={u.id}
                  onClick={() => quickLogin(u.id, `${u.id}123`)}
                  disabled={loading}
                  style={{ ...s.quickBtn, borderColor: `${u.color}44`, color: u.color }}
                >
                  <span style={{ ...s.quickAvatar, background: `${u.color}22`, border: `1px solid ${u.color}44`, color: u.color }}>
                    {u.label[0]}
                  </span>
                  {u.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
        @keyframes bounce { 0%,80%,100%{transform:scale(0);opacity:.3} 40%{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  );
}

const gold = '#C9A84C';
const darkBg = '#1A1F16';
const cardBg = '#232918';
const cream = '#F5EDDA';
const mutedCream = '#A89F8C';

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: darkBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: '"DM Sans", sans-serif', padding: '20px', gap: '20px', position: 'relative', overflow: 'hidden' },
  bgPattern: { position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 20% 20%, rgba(201,168,76,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(76,175,115,0.05) 0%, transparent 50%)`, pointerEvents: 'none' },
  card: { background: cardBg, borderRadius: '20px', padding: '36px 32px', width: '100%', maxWidth: '380px', border: `1px solid rgba(201,168,76,0.2)`, boxShadow: '0 24px 60px rgba(0,0,0,0.4)', animation: 'fadeUp 0.6s ease forwards', position: 'relative', zIndex: 1 },
  shake: { animation: 'shake 0.4s ease' },
  logoArea: { textAlign: 'center', marginBottom: '22px' },
  logoIcon: { width: '56px', height: '56px', borderRadius: '16px', background: `linear-gradient(135deg, ${gold}, #A07830)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', color: '#1A1F16', fontWeight: '700', margin: '0 auto 12px', boxShadow: `0 8px 24px rgba(201,168,76,0.3)` },
  appName: { fontFamily: '"Playfair Display", serif', fontSize: '23px', fontWeight: '700', color: cream, margin: '0 0 4px', letterSpacing: '-0.3px' },
  subtitle: { fontSize: '11px', color: mutedCream, margin: 0, letterSpacing: '0.3px' },
  tabRow: { display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '4px', marginBottom: '20px' },
  tabBtn: { flex: 1, padding: '8px', fontSize: '13px', fontWeight: '500', color: mutedCream, background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: '"DM Sans", sans-serif', transition: 'all 0.2s' },
  tabBtnActive: { background: gold, color: '#1A1F16', fontWeight: '600' },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '11px', fontWeight: '500', color: mutedCream, letterSpacing: '0.5px', textTransform: 'uppercase' },
  input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '10px', padding: '11px 13px', fontSize: '14px', color: cream, outline: 'none', fontFamily: '"DM Sans", sans-serif' },
  errorBox: { background: 'rgba(220,60,60,0.12)', border: '1px solid rgba(220,60,60,0.3)', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#E88', display: 'flex', alignItems: 'center', gap: '8px' },
  errorIcon: { fontSize: '13px' },
  infoBox: { background: 'rgba(76,175,115,0.06)', border: '1px solid rgba(76,175,115,0.2)', borderRadius: '8px', padding: '10px 12px' },
  button: { background: `linear-gradient(135deg, ${gold}, #A07830)`, color: '#1A1F16', border: 'none', borderRadius: '12px', padding: '13px', fontSize: '14px', fontWeight: '600', fontFamily: '"DM Sans", sans-serif', cursor: 'pointer', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '46px', letterSpacing: '0.3px' },
  buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  divider: { display: 'flex', alignItems: 'center', gap: '10px' },
  dividerLine: { flex: 1, height: '1px', background: 'rgba(201,168,76,0.15)' },
  dividerText: { fontSize: '10px', color: mutedCream, fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase' },
  quickRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' },
  quickBtn: { background: 'rgba(255,255,255,0.03)', border: '1px solid', borderRadius: '10px', padding: '9px 12px', fontSize: '13px', fontWeight: '600', fontFamily: '"DM Sans", sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s' },
  quickAvatar: { width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' },
  loadingDots: { display: 'flex', gap: '6px', alignItems: 'center' },
  dot: { width: '7px', height: '7px', borderRadius: '50%', background: '#1A1F16', display: 'inline-block', animation: 'bounce 1.2s infinite ease-in-out' },
};