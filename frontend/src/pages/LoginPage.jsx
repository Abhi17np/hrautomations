import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, password);
      window.location.hash = '/';
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 20,
      backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(79,142,247,0.08), transparent)'
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img
            src="/infopaceee.jpg"
            alt="Infopace Logo"
            style={{
              width: 120, height: 80, borderRadius: 12, marginBottom: 16,
              objectFit: 'contain', background: '#fff', padding: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0'
            }}
          />
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 800 }}>
            HR <span style={{ color: 'var(--accent)' }}>Automation </span> System
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Internal document automation</p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Sign in to continue</h2>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}