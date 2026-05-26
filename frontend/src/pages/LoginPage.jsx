import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');
  const [cursor, setCursor] = useState({ x: 50, y: 50 });
  const { login } = useAuth();

  useEffect(() => {
    let targetX = 50;
    let targetY = 50;
    let currentX = 50;
    let currentY = 50;
    let animId;

    const move = (e) => {
      targetX = (e.clientX / window.innerWidth) * 100;
      targetY = (e.clientY / window.innerHeight) * 100;
    };

    const update = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      setCursor({ x: currentX, y: currentY });

      const elements = document.querySelectorAll('.parallax-shape');
      elements.forEach((el, i) => {
        const speed = (i + 1) * 0.05;
        const x = (targetX - 50) * speed;
        const y = (targetY - 50) * speed;
        el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${x * 0.1}deg)`;
      });

      animId = requestAnimationFrame(update);
    };

    window.addEventListener('mousemove', move);
    update();
    return () => {
      window.removeEventListener('mousemove', move);
      cancelAnimationFrame(animId);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      window.location.hash = '/';
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>

      {/* Animated Background */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>

        {/* Blob 1 — top-left, indigo */}
        <div style={{
          position: 'absolute',
          top: '-15%', left: '-10%',
          width: '55vw', height: '55vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(68, 76, 231, 0.10) 0%, transparent 70%)',
          animation: 'blobDrift1 18s ease-in-out infinite alternate',
        }} />

        {/* Blob 2 — bottom-right, green */}
        <div style={{
          position: 'absolute',
          bottom: '-20%', right: '-10%',
          width: '50vw', height: '50vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 106, 0.08) 0%, transparent 70%)',
          animation: 'blobDrift2 22s ease-in-out infinite alternate',
        }} />

        {/* Blob 3 — center-right, purple */}
        <div style={{
          position: 'absolute',
          top: '30%', right: '-5%',
          width: '35vw', height: '35vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.07) 0%, transparent 70%)',
          animation: 'blobDrift3 14s ease-in-out infinite alternate',
        }} />

        {/* Blob 4 — center-left, sky blue */}
        <div style={{
          position: 'absolute',
          bottom: '10%', left: '5%',
          width: '40vw', height: '40vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.06) 0%, transparent 70%)',
          animation: 'blobDrift4 26s ease-in-out infinite alternate',
        }} />

        {/* Floating Glass Shapes */}
        <div className="parallax-shape" style={{
          position: 'absolute', top: '20%', right: '15%',
          width: 140, height: 140,
          background: 'rgba(255,255,255,0.4)',
          borderRadius: 30,
          border: '1px solid rgba(255,255,255,0.6)',
          backdropFilter: 'blur(8px)',
          opacity: 0.5,
        }} />
        <div className="parallax-shape" style={{
          position: 'absolute', bottom: '15%', left: '10%',
          width: 100, height: 100,
          background: 'rgba(255,255,255,0.3)',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.5)',
          backdropFilter: 'blur(6px)',
          opacity: 0.4,
        }} />

        {/* Cursor Halo */}
        <div style={{
          position: 'absolute',
          left: `${cursor.x}%`, top: `${cursor.y}%`,
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(68,76,231,0.06) 0%, transparent 65%)',
          transform: 'translate(-50%, -50%)',
          transition: 'left 0.6s cubic-bezier(0.23, 1, 0.32, 1), top 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
        }} />

        {/* Subtle Grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(68,76,231,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
      </div>

      {/* Main Content Container */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 410,
        margin: '0 20px',
        animation: 'slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>

        {/* Branding Section */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 140, height: 75, borderRadius: 18,
            background: '#ffffff',
            boxShadow: '0 12px 30px rgba(68,76,231,0.12), 0 1px 3px rgba(0,0,0,0.05)',
            marginBottom: 20, padding: '10px 14px',
            border: '1px solid rgba(255,255,255,1)',
          }}>
            <img src="/infopaceee.jpg" alt="Infopace"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>

          <h1 style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 24, fontWeight: 800, color: '#0f172a',
            letterSpacing: '-0.5px', margin: '0 0 6px',
          }}>
            HR <span style={{
              background: 'linear-gradient(135deg, #444ce7, #6172f3)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Automation</span> System
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', fontWeight: 500, margin: 0 }}>
            Infopace India — Internal HR Portal
          </p>
        </div>

        {/* Glass Card */}
        <div style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.8)',
          borderRadius: 24,
          padding: '36px 36px 32px',
          boxShadow: '0 25px 50px -12px rgba(68,76,231,0.12), inset 0 0 0 1px rgba(255,255,255,0.4)',
        }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 18, fontWeight: 700, color: '#0f172a',
              margin: '0 0 6px',
            }}>Welcome back</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Sign in to access your dashboard
            </p>
          </div>

          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: 12, marginBottom: 20,
              background: '#fef2f2', border: '1px solid rgba(239, 68, 68, 0.1)',
              color: '#dc2626', fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Email Field */}
            <div>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 700,
                color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8,
              }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused('')}
                placeholder="you@infopaceindia.com"
                required
                style={{
                  width: '100%', padding: '12px 16px',
                  borderRadius: 12, fontSize: 14,
                  border: `1.5px solid ${focused === 'email' ? '#444ce7' : '#e2e8f0'}`,
                  background: focused === 'email' ? '#fff' : 'rgba(255,255,255,0.5)',
                  color: '#0f172a', outline: 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: focused === 'email' ? '0 0 0 4px rgba(68,76,231,0.08)' : 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Password Field */}
            <div>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 700,
                color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8,
              }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused('')}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '12px 16px',
                  borderRadius: 12, fontSize: 14,
                  border: `1.5px solid ${focused === 'password' ? '#444ce7' : '#e2e8f0'}`,
                  background: focused === 'password' ? '#fff' : 'rgba(255,255,255,0.5)',
                  color: '#0f172a', outline: 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: focused === 'password' ? '0 0 0 4px rgba(68,76,231,0.08)' : 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 8, padding: '13px',
                borderRadius: 14, border: 'none',
                background: loading ? '#94a3b8' : 'linear-gradient(135deg, #444ce7 0%, #6172f3 100%)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: loading ? 'none' : '0 8px 24px rgba(68,76,231,0.25)',
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
            >
              {loading ? (
                <>
                  <div className="spinner" />
                  Signing in…
                </>
              ) : 'Sign in →'}
            </button>
          </form>
        </div>

        <p style={{
          textAlign: 'center', marginTop: 24,
          fontSize: 12.5, color: '#94a3b8', fontWeight: 500,
        }}>
          Contact your administrator if you need access
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');

        @keyframes blobDrift1 {
          0%   { transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(40px, 30px) scale(1.05); }
          66%  { transform: translate(20px, 60px) scale(0.97); }
          100% { transform: translate(60px, 20px) scale(1.08); }
        }
        @keyframes blobDrift2 {
          0%   { transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(-50px, -30px) scale(1.06); }
          66%  { transform: translate(-20px, -60px) scale(0.95); }
          100% { transform: translate(-40px, -10px) scale(1.04); }
        }
        @keyframes blobDrift3 {
          0%   { transform: translate(0px, 0px) scale(1); }
          50%  { transform: translate(-30px, 50px) scale(1.1); }
          100% { transform: translate(20px, 80px) scale(0.93); }
        }
        @keyframes blobDrift4 {
          0%   { transform: translate(0px, 0px) scale(1); }
          40%  { transform: translate(60px, -40px) scale(1.07); }
          100% { transform: translate(30px, -70px) scale(0.96); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .parallax-shape {
          transition: transform 0.2s cubic-bezier(0.1, 1, 0.3, 1);
        }
        input::placeholder { color: #cbd5e1; }
      `}</style>
    </div>
  );
}