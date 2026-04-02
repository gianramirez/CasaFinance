import { useAuth } from './hooks/useAuth';
import AuthPage from './pages/AuthPage';
import CasaFinance from './pages/CasaFinance';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#F5F5F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
        fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      }}>
        <div style={{ fontSize: 40 }}>🏠</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#0F6E56' }}>CasaFinance</div>
        <div style={{ fontSize: 14, color: '#9a9a9a' }}>Loading...</div>
      </div>
    );
  }

  return user ? <CasaFinance /> : <AuthPage />;
}
