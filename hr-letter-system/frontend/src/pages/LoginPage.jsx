import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
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

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await axios.post('/api/auth/seed');
      setEmail('admin@company.com');
      setPassword('admin123');
    } catch { }
    setSeeding(false);
  };

  const DEMO = [
    { label: 'Admin', email: 'admin@company.com', pass: 'admin123', color: '#f5a623' },
    { label: 'HR', email: 'hr@company.com', pass: 'hr123', color: '#3fcf8e' },
    { label: 'HR Head', email: 'hrhead@company.com', pass: 'hrhead123', color: '#4f8ef7' },
    { label: 'Manager', email: 'manager@company.com', pass: 'manager123', color: '#c084fc' },
  ];

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

        <div style={{ marginTop: 16, padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Demo accounts</span>
            <button className="btn btn-sm btn-secondary" onClick={handleSeed} disabled={seeding} style={{ fontSize: 11 }}>
              {seeding ? 'Seeding...' : 'Seed DB'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {DEMO.map(acc => (
              <button
                key={acc.email}
                onClick={() => { setEmail(acc.email); setPassword(acc.pass); }}
                style={{
                  padding: '7px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = acc.color + '66'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: acc.color }}>{acc.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{acc.pass}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}