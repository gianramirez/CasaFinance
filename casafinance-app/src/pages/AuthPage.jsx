import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const COLORS = {
  primary: '#0F6E56',
  primaryLight: '#e8f5f0',
  bg: '#F5F5F0',
  card: '#FFFFFF',
  cardBorder: '#e8e5df',
  textPrimary: '#1a1a1a',
  textSecondary: '#6b6b6b',
  textMuted: '#9a9a9a',
  danger: '#E24B4A',
};

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    if (!email || !password) {
      setError('Email and password are required.');
      setLoading(false);
      return;
    }

    if (mode === 'signup') {
      const { error: err } = await signUp(email, password, name || email.split('@')[0]);
      if (err) {
        setError(err.message);
      } else {
        setSuccess('Account created! Check your email to confirm, then sign in.');
        setMode('login');
      }
    } else {
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(err.message);
      }
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Logo area */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏠</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.primary, letterSpacing: -0.5 }}>
          CasaFinance
        </div>
        <div style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 4 }}>
          Your family's financial home base
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: COLORS.card,
        borderRadius: 20,
        padding: '32px 24px',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        border: `1px solid ${COLORS.cardBorder}`,
      }}>
        <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700, color: COLORS.textPrimary }}>
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h2>

        {error && (
          <div style={{
            background: '#fdeaea',
            color: COLORS.danger,
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            marginBottom: 16,
          }}>{error}</div>
        )}
        {success && (
          <div style={{
            background: COLORS.primaryLight,
            color: COLORS.primary,
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            marginBottom: 16,
          }}>{success}</div>
        )}

        {mode === 'signup' && (
          <>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 6 }}>
              Display name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Gian"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${COLORS.cardBorder}`, fontSize: 15,
                marginBottom: 16, boxSizing: 'border-box', outline: 'none',
              }}
            />
          </>
        )}

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 6 }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="gian@example.com"
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            border: `1px solid ${COLORS.cardBorder}`, fontSize: 15,
            marginBottom: 16, boxSizing: 'border-box', outline: 'none',
          }}
        />

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 6 }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            border: `1px solid ${COLORS.cardBorder}`, fontSize: 15,
            marginBottom: 24, boxSizing: 'border-box', outline: 'none',
          }}
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '14px', borderRadius: 12,
            background: COLORS.primary, color: '#fff', border: 'none',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            opacity: loading ? 0.6 : 1,
            boxShadow: `0 4px 14px ${COLORS.primary}44`,
          }}
        >
          {loading ? 'Loading...' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: COLORS.textSecondary }}>
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess(''); }}
            style={{
              background: 'none', border: 'none', color: COLORS.primary,
              fontWeight: 600, cursor: 'pointer', fontSize: 14,
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
