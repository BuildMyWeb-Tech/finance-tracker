import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={styles.root}>
      <div style={styles.bgPattern} />
      <div style={styles.card}>
        <div style={styles.icon}>₹</div>
        <h1 style={styles.code}>404</h1>
        <p style={styles.title}>Page not found</p>
        <p style={styles.sub}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button style={styles.button} onClick={() => navigate('/')}>
          Go to Home
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#1A1F16',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '"DM Sans", sans-serif',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden',
  },
  bgPattern: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `radial-gradient(circle at 30% 30%, rgba(201,168,76,0.07) 0%, transparent 55%),
                      radial-gradient(circle at 70% 70%, rgba(76,175,115,0.05) 0%, transparent 55%)`,
    pointerEvents: 'none',
  },
  card: {
    background: '#232918',
    borderRadius: '20px',
    padding: '48px 36px',
    width: '100%',
    maxWidth: '360px',
    border: '1px solid rgba(201,168,76,0.2)',
    boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
    animation: 'fadeUp 0.5s ease forwards',
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
  },
  icon: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #C9A84C, #A07830)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '26px',
    color: '#1A1F16',
    fontWeight: '700',
    margin: '0 auto 20px',
    boxShadow: '0 8px 24px rgba(201,168,76,0.3)',
  },
  code: {
    fontSize: '64px',
    fontWeight: '700',
    color: '#C9A84C',
    margin: '0 0 8px',
    lineHeight: 1,
    letterSpacing: '-2px',
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#F5EDDA',
    margin: '0 0 10px',
  },
  sub: {
    fontSize: '13px',
    color: '#A89F8C',
    margin: '0 0 28px',
    lineHeight: 1.6,
  },
  button: {
    background: 'linear-gradient(135deg, #C9A84C, #A07830)',
    color: '#1A1F16',
    border: 'none',
    borderRadius: '12px',
    padding: '13px 32px',
    fontSize: '14px',
    fontWeight: '600',
    fontFamily: '"DM Sans", sans-serif',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
};