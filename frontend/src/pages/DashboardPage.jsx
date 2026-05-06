/**
 * DashboardPage.jsx — Role-specific dashboards
 *
 * admin / hr_head  → HR Command Centre: org-wide stats, pipeline view, action items
 * manager          → Team Dashboard: team status, pending approvals, exit tracking
 * employee         → My Portal: personal status, my documents, my exit status
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const nav = (path) => { window.location.hash = path; };

const TODAY = new Date().toLocaleDateString('en-IN', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// ─── Shared helpers ───────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—';
  try {
    // Handle DD-MM-YYYY format from backend
    const parts = d.split(/[-/]/);
    let date;
    if (parts.length === 3 && parts[0].length === 2) {
      // DD-MM-YYYY → convert to YYYY-MM-DD for reliable parsing
      date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
      date = new Date(d);
    }
    if (isNaN(date)) return d;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function Badge({ status }) {
  const MAP = {
    active: 'badge-green', approved: 'badge-green', issued: 'badge-green',
    pending_hr_head: 'badge-amber', pending_manager: 'badge-amber',
    resignation_pending: 'badge-amber', notice_period: 'badge-amber',
    clearance_pending: 'badge-amber', clearance_complete: 'badge-blue',
    rejected: 'badge-red', exited: 'badge-gray', inactive: 'badge-gray',
    draft: 'badge-gray',
  };
  const label = status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';
  return <span className={`badge ${MAP[status] || 'badge-gray'}`}>{label}</span>;
}

// Metric card — big number + label + optional click
function Metric({ value, label, sub, color = 'var(--accent)', icon, onClick, urgent }) {
  return (
    <div onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: `1.5px solid ${urgent ? 'rgba(239,68,68,.3)' : 'var(--border)'}`,
        borderRadius: 12, padding: '20px 22px',
        borderLeft: `4px solid ${color}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all .15s',
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
    >
      {urgent && (
        <div style={{ position: 'absolute', top: 10, right: 12, width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 6px var(--red)' }} />
      )}
      {icon && <div style={{ fontSize: 22, marginBottom: 8, opacity: .7 }}>{icon}</div>}
      <div style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1, letterSpacing: -1 }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6, color: 'var(--text)' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// Section header
function SectionTitle({ children, action, actionLabel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>
        {children}
      </div>
      {action && (
        <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }} onClick={action}>
          {actionLabel || 'View all →'}
        </button>
      )}
    </div>
  );
}

// Pipeline stage bar
function PipelineBar({ stages }) {
  const total = stages.reduce((a, s) => a + s.count, 0) || 1;
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {stages.map(s => (
        <div key={s.label} style={{ flex: 1, minWidth: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--text-dim)' }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: s.color, fontFamily: 'var(--mono)' }}>{s.count}</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(s.count / total) * 100}%`, background: s.color, borderRadius: 99, transition: 'width .5s' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HR HEAD / ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function HRDashboard({ user }) {
  const [data, setData] = useState({
    employees: [], letterStats: {}, aoOrders: [], exitEmployees: [],
    pendingResign: [], pendingLetters: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      axios.get('/api/employees/'),
      axios.get('/api/approvals/stats'),
      axios.get('/api/appointment-orders/'),
      axios.get('/api/exit/'),
      axios.get('/api/exit/pending-approvals'),
      axios.get('/api/approvals/pending'),
    ]).then(([emps, stats, ao, exit, resign, pending]) => {
      setData({
        employees: emps.value?.data || [],
        letterStats: stats.value?.data || {},
        aoOrders: ao.value?.data || [],
        exitEmployees: exit.value?.data || [],
        pendingResign: resign.value?.data || [],
        pendingLetters: pending.value?.data || [],
      });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const { employees, letterStats, aoOrders, exitEmployees, pendingResign, pendingLetters } = data;

  const active = employees.filter(e => e.status === 'active').length;
  const exiting = employees.filter(e => ['resignation_pending', 'notice_period', 'clearance_pending', 'clearance_complete'].includes(e.status)).length;
  const exited = employees.filter(e => e.status === 'exited').length;
  const totalEmp = employees.length;

  const pendingAO = aoOrders.filter(o => o.status === 'pending_hr_head').length;
  const totalAO = aoOrders.length;
  const approvedAO = aoOrders.filter(o => o.status === 'approved').length;

  const pendingLetCount = pendingLetters.length;
  const totalPending = pendingLetCount + pendingAO + pendingResign.length;

  const allCleared = exitEmployees.filter(e => e.status === 'clearance_complete').length;
  const noticePeriod = exitEmployees.filter(e => e.status === 'notice_period').length;

  // Recent activity: last 5 letters
  const recentLetters = [...(data.pendingLetters || [])].slice(0, 5);

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
            HR Command Centre
          </div>
          <h1 className="page-title" style={{ margin: 0 }}>Good morning, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle" style={{ marginTop: 4 }}>{TODAY}</p>
        </div>
        {totalPending > 0 && (
          <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', flexShrink: 0, boxShadow: '0 0 8px var(--red)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--red)' }}>{totalPending} items need your attention</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Pending approvals across all modules</div>
            </div>
            <button className="btn btn-sm" style={{ background: 'var(--red)', borderColor: 'var(--red)', color: '#fff', fontSize: 12 }}
              onClick={() => nav('/approvals')}>Review Now →</button>
          </div>
        )}
      </div>

      {/* Org snapshot */}
      <SectionTitle action={() => nav('/employees')} actionLabel="View employees →">Organisation Snapshot</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <Metric value={totalEmp} label="Total Employees" sub="all records" color="var(--accent)" icon="👥" onClick={() => nav('/employees')} />
        <Metric value={active} label="Active" sub="currently employed" color="var(--green)" icon="✓" onClick={() => nav('/employees')} />
        <Metric value={exiting} label="In Exit Pipeline" sub="notice to clearance" color="var(--amber)" icon="→" onClick={() => nav('/exit')} urgent={exiting > 0} />
        <Metric value={allCleared} label="Ready to Relieve" sub="all clearances done" color="var(--green)" icon="🎯" onClick={() => nav('/exit')} urgent={allCleared > 0} />
      </div>

      {/* Pending actions */}
      <SectionTitle action={() => nav('/approvals')} actionLabel="Go to Approvals →">Pending Actions</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        <Metric value={pendingLetCount} label="Offer Letters" sub="awaiting HR approval" color="var(--amber)" icon="📄" onClick={() => nav('/approvals')} urgent={pendingLetCount > 0} />
        <Metric value={pendingAO} label="Appointment Orders" sub="awaiting HR approval" color="var(--amber)" icon="📋" onClick={() => nav('/approvals')} urgent={pendingAO > 0} />
        <Metric value={pendingResign.length} label="Resignations" sub="pending approval" color="var(--red)" icon="✉" onClick={() => nav('/approvals')} urgent={pendingResign.length > 0} />
      </div>

      {/* Two column section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

        {/* Exit pipeline */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <SectionTitle action={() => nav('/exit')} actionLabel="Manage →">Exit Pipeline</SectionTitle>
          <PipelineBar stages={[
            { label: 'Notice Period', count: noticePeriod, color: 'var(--amber)' },
            { label: 'Clearance', count: exitEmployees.filter(e => e.status === 'clearance_pending').length, color: 'var(--red)' },
            { label: 'All Cleared', count: allCleared, color: 'var(--green)' },
            { label: 'Exited', count: exited, color: 'var(--text-dim)' },
          ]} />
          {allCleared > 0 && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(63,207,142,.08)', border: '1px solid rgba(63,207,142,.2)', borderRadius: 8, fontSize: 12, color: 'var(--green)' }}>
              🎯 {allCleared} employee{allCleared !== 1 ? 's' : ''} cleared — relieving letter can be generated
            </div>
          )}
        </div>

        {/* Letter pipeline */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <SectionTitle action={() => nav('/letters')} actionLabel="View letters →">Offer Letter Pipeline</SectionTitle>
          <PipelineBar stages={[
            { label: 'Draft', count: letterStats.draft || 0, color: 'var(--text-dim)' },
            { label: 'Pending', count: (letterStats.pending_hr_head || 0), color: 'var(--amber)' },
            { label: 'Approved', count: letterStats.approved || 0, color: 'var(--accent)' },
            { label: 'Issued', count: letterStats.issued || 0, color: 'var(--green)' },
          ]} />
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
            {[
              ['Total Orders', totalAO],
              ['Approved Orders', approvedAO],
            ].map(([k, v]) => (
              <div key={k} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 3 }}>Appointment {k}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending resignations table */}
      {pendingResign.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>⚠ Pending Resignations</div>
            <button className="btn btn-sm btn-primary" style={{ fontSize: 11 }} onClick={() => nav('/approvals')}>Review All →</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Designation</th><th>Resigned On</th><th>Last Working Day</th><th>Reason</th></tr></thead>
              <tbody>
                {pendingResign.slice(0, 5).map(e => (
                  <tr key={e._id}>
                    <td><div style={{ fontWeight: 500 }}>{e.name}</div><div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{e.employee_id}</div></td>
                    <td style={{ fontSize: 13 }}>{e.designation}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(e.resignation_date)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--amber)' }}>{fmtDate(e.last_working_day)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{e.exit_reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent offer letters */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Recent Offer Letters Pending</div>
          <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }} onClick={() => nav('/approvals')}>View all →</button>
        </div>
        {recentLetters.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div style={{ fontWeight: 600 }}>No pending offer letters</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>All caught up!</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Designation</th><th>Status</th><th>Submitted</th></tr></thead>
              <tbody>
                {recentLetters.map(l => (
                  <tr key={l._id}>
                    <td><div style={{ fontWeight: 500 }}>{l.employee_name}</div><div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{l.employee_code}</div></td>
                    <td style={{ fontSize: 13 }}>{l.designation || '—'}</td>
                    <td><Badge status={l.status} /></td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>{fmtDate(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MANAGER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function ManagerDashboard({ user }) {
  const [data, setData] = useState({ pendingResign: [], exitPipeline: [], aoOrders: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      axios.get('/api/exit/pending-approvals'),
      axios.get('/api/exit/'),
      axios.get('/api/appointment-orders/'),
    ]).then(([resign, exit, ao]) => {
      setData({
        pendingResign: resign.value?.data || [],
        exitPipeline: exit.value?.data || [],
        aoOrders: ao.value?.data || [],
      });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const { pendingResign, exitPipeline, aoOrders } = data;
  const inNotice = exitPipeline.filter(e => e.status === 'notice_period').length;
  const inClearance = exitPipeline.filter(e => ['clearance_pending', 'clearance_complete'].includes(e.status)).length;
  const aoMine = aoOrders.filter(o => o.status === 'approved').length;

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
            Team Dashboard
          </div>
          <h1 className="page-title" style={{ margin: 0 }}>Hi, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle" style={{ marginTop: 4 }}>{TODAY}</p>
        </div>
        {pendingResign.length > 0 && (
          <div style={{ background: 'rgba(245,166,35,.08)', border: '1px solid rgba(245,166,35,.25)', borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--amber)' }}>{pendingResign.length} resignation{pendingResign.length !== 1 ? 's' : ''} awaiting your approval</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Action required from you as manager</div>
            </div>
            <button className="btn btn-sm" style={{ background: 'var(--amber)', borderColor: 'var(--amber)', color: '#000', fontSize: 12 }}
              onClick={() => nav('/approvals')}>Review →</button>
          </div>
        )}
      </div>

      {/* Metrics */}
      <SectionTitle>Team Overview</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <Metric value={pendingResign.length} label="Pending Resignations" sub="need your approval" color="var(--amber)" icon="✉" onClick={() => nav('/approvals')} urgent={pendingResign.length > 0} />
        <Metric value={inNotice} label="Serving Notice" sub="in notice period" color="var(--amber)" icon="⏳" onClick={() => nav('/exit')} />
        <Metric value={inClearance} label="In Clearance" sub="dept clearances" color="var(--accent)" icon="🔄" onClick={() => nav('/exit')} />
        <Metric value={aoMine} label="Orders Approved" sub="appointment orders" color="var(--green)" icon="✓" onClick={() => nav('/appointment')} />
      </div>

      {/* Pending resignations detail */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Team Resignation Requests</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>Approve or reject your team's resignation applications</div>
          </div>
          <button className="btn btn-sm btn-primary" style={{ fontSize: 11 }} onClick={() => nav('/approvals')}>Go to Approvals →</button>
        </div>
        {pendingResign.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div style={{ fontWeight: 600 }}>No pending resignations</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>Your team has no pending resignation requests.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Designation</th><th>Resignation Date</th><th>Last Working Day</th><th>Reason</th><th>Action</th></tr></thead>
              <tbody>
                {pendingResign.map(e => (
                  <tr key={e._id}>
                    <td><div style={{ fontWeight: 500 }}>{e.name}</div><div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{e.employee_id}</div></td>
                    <td style={{ fontSize: 13 }}>{e.designation}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(e.resignation_date)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--amber)' }}>{fmtDate(e.last_working_day)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{e.exit_reason || '—'}</td>
                    <td><button className="btn btn-sm btn-primary" style={{ fontSize: 11 }} onClick={() => nav('/approvals')}>Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Exit pipeline */}
      {exitPipeline.length > 0 && (
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Team Exit Pipeline</div>
            <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }} onClick={() => nav('/exit')}>View →</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Status</th><th>Last Working Day</th></tr></thead>
              <tbody>
                {exitPipeline.slice(0, 5).map(e => (
                  <tr key={e._id}>
                    <td><div style={{ fontWeight: 500 }}>{e.name}</div><div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{e.employee_id}</div></td>
                    <td><Badge status={e.status} /></td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--amber)' }}>{fmtDate(e.last_working_day)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function EmployeeDashboard({ user }) {
  const [data, setData] = useState({ letters: [], aoOrders: [], exitStatus: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      axios.get('/api/letters/'),
      axios.get('/api/appointment-orders/'),
      axios.get('/api/exit/my-status'),
    ]).then(([letters, ao, exit]) => {
      setData({
        letters: letters.value?.data || [],
        aoOrders: ao.value?.data || [],
        exitStatus: exit.value?.data || null,
      });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const { letters, aoOrders, exitStatus } = data;
  const offerLetters = letters.filter(l => l.letter_type === 'offer');
  const latestLetter = offerLetters[0];
  const latestAO = aoOrders[0];
  const inExit = exitStatus?.in_exit_pipeline;
  const exitSt = exitStatus?.status;
  const isExited = exitSt === 'exited';
  const isPending = exitSt === 'resignation_pending';
  const approvedAOs = aoOrders.filter(o => o.status === 'approved').length;
  const pendingAOs = aoOrders.filter(o => o.status === 'pending_hr_head').length;
  const rejectedAOs = aoOrders.filter(o => o.status === 'rejected').length;

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const download = async (id, fmt, name) => {
    try {
      const r = await axios.get(`/api/exit/relieving/${id}/download?format=${fmt}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url; a.download = `${name}.${fmt}`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Download failed'); }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Employee Portal</div>
        <h1 className="page-title" style={{ margin: 0 }}>{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="page-subtitle" style={{ marginTop: 4 }}>{TODAY}</p>
      </div>

      {/* Status banner if in exit pipeline */}
      {inExit && (
        <div style={{
          background: isPending ? 'rgba(245,166,35,.08)' : isExited ? 'rgba(63,207,142,.08)' : 'rgba(99,102,241,.08)',
          border: `1px solid ${isPending ? 'rgba(245,166,35,.25)' : isExited ? 'rgba(63,207,142,.25)' : 'rgba(99,102,241,.2)'}`,
          borderRadius: 12, padding: '16px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ fontSize: 28 }}>{isPending ? '⏳' : isExited ? '✓' : '🔄'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              {isPending ? 'Your resignation is awaiting manager approval'
                : isExited ? 'Exit process complete — relieving letter ready'
                  : `Exit in progress — ${exitSt?.replace(/_/g, ' ')}`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {exitStatus?.resignation_date && `Resignation Date: ${fmtDate(exitStatus.resignation_date)}`}
              {exitStatus?.last_working_day && ` · Last Working Day: ${fmtDate(exitStatus.last_working_day)}`}
            </div>
          </div>
          {isExited && exitStatus?.relieving_letter_id && (
            <div style={{ display: 'flex', gap: 8 }}>
              {exitStatus.has_pdf && <button className="btn btn-sm btn-primary" style={{ fontSize: 11 }} onClick={() => download(exitStatus.relieving_letter_id, 'pdf', 'relieving_letter')}>⬇ PDF</button>}
              {exitStatus.has_docx && <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }} onClick={() => download(exitStatus.relieving_letter_id, 'docx', 'relieving_letter')}>⬇ DOCX</button>}
            </div>
          )}
          {!isExited && !isPending && (
            <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }} onClick={() => nav('/exit')}>View Details →</button>
          )}
        </div>
      )}

      {/* My document metrics */}
      <SectionTitle>My Documents</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        <Metric value={offerLetters.length} label="Offer Letters" sub="all versions" color="var(--accent)" icon="📄" onClick={() => nav('/letters')} />
        <Metric value={approvedAOs} label="Appointment Orders" sub="approved & ready" color="var(--green)" icon="✓" onClick={() => nav('/appointment')} />
        <Metric value={pendingAOs + rejectedAOs} label="Needs Action" sub="pending or rejected" color={pendingAOs + rejectedAOs > 0 ? 'var(--amber)' : 'var(--text-dim)'} icon="📋" onClick={() => nav('/appointment')} urgent={pendingAOs + rejectedAOs > 0} />
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Latest offer letter */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <SectionTitle action={() => nav('/letters')} actionLabel="View all →">My Latest Offer Letter</SectionTitle>
          {!latestLetter ? (
            <div className="empty-state" style={{ padding: '20px 0', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              No offer letters yet
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <Badge status={latestLetter.status} />
                <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>v{latestLetter.version}</span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{fmtDate(latestLetter.created_at)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: 13 }}>
                {[
                  ['Designation', latestLetter.context?.designation],
                  ['Department', latestLetter.context?.department],
                  ['CTC', latestLetter.context?.ctc ? `₹${latestLetter.context.ctc}` : null],
                  ['Joining Date', fmtDate(latestLetter.context?.joining_date)],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'var(--mono)', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
              </div>
              {latestLetter.status === 'rejected' && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,.07)', borderRadius: 6, fontSize: 12, color: 'var(--red)' }}>
                  ✗ Letter was rejected. Check Offer Letters for details.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Latest appointment order */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <SectionTitle action={() => nav('/appointment')} actionLabel="View all →">My Latest Appointment Order</SectionTitle>
          {!latestAO ? (
            <div className="empty-state" style={{ padding: '20px 0', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              No appointment orders yet
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                Your appointment order will appear here once HR creates one for you.
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <Badge status={latestAO.status} />
                <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{latestAO.reference_number}</span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{fmtDate(latestAO.created_at)}</span>
              </div>
              {latestAO.status === 'rejected' && (
                <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,.07)', borderRadius: 8, fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>
                  ✗ Rejected — you can edit and resubmit
                  <div style={{ marginTop: 8 }}>
                    <button className="btn btn-sm" style={{ fontSize: 11, background: 'var(--amber)', borderColor: 'var(--amber)', color: '#000' }}
                      onClick={() => nav('/appointment')}>✎ Edit & Resubmit</button>
                  </div>
                </div>
              )}
              {latestAO.status === 'pending_hr_head' && (
                <div style={{ padding: '10px 12px', background: 'rgba(245,166,35,.08)', borderRadius: 8, fontSize: 12, color: 'var(--amber)' }}>
                  ⏳ Submitted — awaiting HR Head approval
                </div>
              )}
              {latestAO.status === 'approved' && (
                <div style={{ padding: '10px 12px', background: 'rgba(63,207,142,.08)', borderRadius: 8, fontSize: 12, color: 'var(--green)' }}>
                  ✓ Approved — download your appointment order
                  <div style={{ marginTop: 8 }}>
                    <button className="btn btn-sm btn-primary" style={{ fontSize: 11 }} onClick={() => nav('/appointment')}>⬇ Download</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card" style={{ padding: '20px 22px' }}>
        <SectionTitle>Quick Actions</SectionTitle>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: '📋 View Appointment Orders', path: '/appointment', primary: true },
            { label: '📄 View My Offer Letters', path: '/letters', primary: false },
            { label: '🗂 My Documents', path: '/documents', primary: false },
            ...(!inExit ? [{ label: '→ Apply for Resignation', path: '/exit', primary: false }] : []),
          ].map(a => (
            <button key={a.label}
              className={`btn ${a.primary ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 13 }}
              onClick={() => nav(a.path)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root router
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role || 'employee';

  if (['admin', 'hr_head'].includes(role)) return <HRDashboard user={user} />;
  if (role === 'manager') return <ManagerDashboard user={user} />;
  return <EmployeeDashboard user={user} />;
}