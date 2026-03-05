import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const STATUS_CFG = {
  draft:           { label: 'Draft',           cls: 'badge-gray'  },
  pending_manager: { label: 'Pending Manager', cls: 'badge-amber' },
  pending_hr_head: { label: 'Pending HR Head', cls: 'badge-amber' },
  approved:        { label: 'Approved',        cls: 'badge-green' },
  rejected:        { label: 'Rejected',        cls: 'badge-red'   },
  issued:          { label: 'Issued',          cls: 'badge-green' },
  withdrawn:       { label: 'Withdrawn',       cls: 'badge-red'   },
};

function StatCard({ label, value, color, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '22px 24px',
        borderTop: `2px solid ${color}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.transform = '')}
    >
      <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--display)', color, lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const nav = (path) => { window.location.hash = path; };

export default function DashboardPage() {
  const { user }   = useAuth();
  const [stats,        setStats]        = useState({});
  const [letters,      setLetters]      = useState([]);
  const [empCount,     setEmpCount]     = useState(0);
  const [pendingForMe, setPendingForMe] = useState(0);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get('/api/approvals/stats'),
      axios.get('/api/letters/'),
      axios.get('/api/employees/?status=active'),
      axios.get('/api/approvals/pending'),
    ]).then(([s, l, e, p]) => {
      setStats(s.data);
      setLetters(l.data.slice(0, 10));
      setEmpCount(e.data.length);
      setPendingForMe(Array.isArray(p.data) ? p.data.length : 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const pending      = (stats.pending_manager || 0) + (stats.pending_hr_head || 0);
  const totalLetters = Object.values(stats).reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Welcome back, {user?.name} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {loading ? <div className="page-loading"><div className="spinner" /></div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
            <StatCard label="Active Employees"   value={empCount}           color="var(--accent)"     sub="in system"         onClick={() => nav('/employees')} />
            <StatCard label="Total Letters"      value={totalLetters}       color="var(--text-muted)" sub="all time"          onClick={() => nav('/letters')} />
            <StatCard label="Approved"           value={stats.approved||0}  color="var(--green)"      sub="offer letters" />
            <StatCard label="Awaiting Approval"  value={pending}            color="var(--amber)"      sub="pending action"    onClick={() => nav('/approvals')} />
            <StatCard label="My Pending Actions" value={pendingForMe}       color="var(--red)"        sub="require my review" onClick={() => nav('/approvals')} />
            <StatCard label="Drafts"             value={stats.draft||0}     color="var(--text-dim)"   sub="not submitted"     onClick={() => nav('/letters')} />
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Offer Letters</span>
              <button className="btn btn-sm btn-secondary" onClick={() => nav('/letters')}>View all →</button>
            </div>
            {letters.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">◈</div>
                <p>No offer letters generated yet</p>
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => nav('/letters')}>
                  Generate your first letter
                </button>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Employee</th><th>Version</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {letters.map(l => {
                      const cfg = STATUS_CFG[l.status] || {};
                      return (
                        <tr key={l._id}>
                          <td>
                            <div style={{ fontWeight: 500 }}>{l.employee_name}</div>
                            <div className="mono text-muted text-sm">{l.employee_code}</div>
                          </td>
                          <td><span className="badge badge-gray mono">v{l.version}</span></td>
                          <td><span className={`badge ${cfg.cls}`}>{cfg.label}</span></td>
                          <td className="mono text-muted text-sm">{new Date(l.created_at).toLocaleDateString('en-IN')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}