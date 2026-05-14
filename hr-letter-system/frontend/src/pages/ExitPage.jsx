/**
 * ExitPage.jsx — Role-aware Exit & Relieving workflow
 *
 * EMPLOYEE:
 *   - If active: sees "+ Apply for Resignation" button, fills form, submits
 *   - If resignation_pending: sees "Awaiting manager approval" status
 *   - If notice_period / clearance stages: sees their status + clearance progress (read-only)
 *   - If exited: sees ⬇ Download Relieving Letter button
 *
 * MANAGER:
 *   - Top section: their OWN resignation status (same as EmployeeExitView)
 *   - Bottom section: "Team Approvals" — pending resignations from their team only
 *     (manager cannot approve/reject their own resignation from here)
 *
 * HR HEAD / ADMIN:
 *   - Sees full exit pipeline (notice_period → clearance → exited)
 *   - Can tick/untick all 5 clearances per employee
 *   - Generate Relieving button appears ONLY after all 5 clearances are ticked
 */

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const CLEARANCE_ITEMS = [
  { key: 'it_assets', label: 'IT Assets', icon: '⬡', desc: 'Laptop, access cards, equipment returned' },
  { key: 'finance', label: 'Finance', icon: '◈', desc: 'Dues settled, expense claims cleared' },
  { key: 'admin', label: 'Admin', icon: '▦', desc: 'Office keys, ID cards, parking returned' },
  { key: 'hr_docs', label: 'HR Docs', icon: '◉', desc: 'Signed docs, NDAs, policy acknowledgements' },
  { key: 'access_cards', label: 'Access Cards', icon: '◎', desc: 'Building and system access revoked' },
];

const STATUS_CFG = {
  active: { label: 'Active', cls: 'badge-green' },
  resignation_pending: { label: 'Pending Approval', cls: 'badge-amber' },
  notice_period: { label: 'Notice Period', cls: 'badge-amber' },
  clearance_pending: { label: 'Clearance Pending', cls: 'badge-amber' },
  clearance_complete: { label: 'Clearance Complete', cls: 'badge-blue' },
  exited: { label: 'Exited', cls: 'badge-gray' },
};

const PIPELINE_STEPS = [
  { key: 'resignation_pending', label: 'Resigned', sub: 'Awaiting Approval' },
  { key: 'notice_period', label: 'Notice Period', sub: 'Serving' },
  { key: 'clearance_pending', label: 'Clearance', sub: 'In Progress' },
  { key: 'clearance_complete', label: 'All Cleared', sub: 'Gate Passed' },
  { key: 'exited', label: 'Exited', sub: 'Letter Issued' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Badge({ status }) {
  const c = STATUS_CFG[status] || { label: status, cls: 'badge-gray' };
  return <span className={`badge ${c.cls}`}>{c.label}</span>;
}

function allCleared(emp) {
  const c = emp.clearances || {};
  return CLEARANCE_ITEMS.every(i => c[i.key] === true);
}

function clearedCount(emp) {
  const c = emp.clearances || {};
  return CLEARANCE_ITEMS.filter(i => c[i.key] === true).length;
}

function daysUntil(lwd) {
  if (!lwd) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(lwd + 'T00:00:00');
  return Math.round((d - today) / 86400000);
}

function ClearanceBar({ emp }) {
  const done = clearedCount(emp), total = CLEARANCE_ITEMS.length;
  const pct = Math.round((done / total) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: pct === 100 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : 'var(--red)', transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: pct === 100 ? 'var(--green)' : 'var(--text-dim)', whiteSpace: 'nowrap' }}>{done}/{total}</span>
    </div>
  );
}

// ─── Shared: Employee resignation status card ─────────────────────────────────
// Used by both EmployeeExitView and ManagerExitView (for their own status)

function MyResignationStatus({ myStatus, onResign, onDownload, downloading }) {
  const status = myStatus?.status;
  const inPipeline = myStatus?.in_exit_pipeline;

  if (!inPipeline || status === 'active') {
    return (
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>My Resignation</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>No active resignation on record</div>
          </div>
          <button className="btn btn-primary" onClick={onResign}>+ Apply for Resignation</button>
        </div>
      </div>
    );
  }

  const stepIdx = PIPELINE_STEPS.findIndex(s => s.key === status);
  const cleared = myStatus.cleared_count || 0;
  const total = myStatus.total_clearances || 5;

  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>My Resignation</div>

      {/* Pipeline tracker */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        {PIPELINE_STEPS.map((step, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', margin: '0 auto 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, background: done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--surface-2)', color: (done || active) ? '#fff' : 'var(--text-dim)', boxShadow: active ? '0 0 0 3px rgba(99,102,241,.18)' : 'none' }}>
                  {done ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? 'var(--text)' : done ? 'var(--green)' : 'var(--text-dim)' }}>{step.label}</div>
              </div>
              {i < PIPELINE_STEPS.length - 1 && <div style={{ width: 24, height: 2, background: done ? 'var(--green)' : 'var(--border)', flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>

      {/* Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 20px', marginBottom: 16 }}>
        {[
          ['Status', <Badge status={status} />],
          ['Resignation Date', myStatus.resignation_date || '—'],
          ['Last Working Day', myStatus.last_working_day || '—'],
          ['Exit Reason', myStatus.exit_reason || '—'],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'var(--mono)', marginBottom: 3 }}>{k}</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Clearance progress (read-only) */}
      {['clearance_pending', 'clearance_complete'].includes(status) && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 10 }}>Department Clearances ({cleared}/{total})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CLEARANCE_ITEMS.map(item => {
              const ok = myStatus.clearances?.[item.key];
              return (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: ok ? 'var(--green-dim)' : 'var(--surface-2)', border: `1px solid ${ok ? 'rgba(63,207,142,.2)' : 'var(--border)'}` }}>
                  <span style={{ fontSize: 13, opacity: .6 }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: ok ? 'var(--green)' : 'var(--text)' }}>{item.label}</div>
                  </div>
                  <span style={{ fontSize: 10, fontFamily: 'var(--mono)', padding: '2px 7px', borderRadius: 20, background: ok ? 'rgba(63,207,142,.15)' : 'var(--border)', color: ok ? 'var(--green)' : 'var(--text-dim)' }}>
                    {ok ? 'CLEARED' : 'PENDING'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending approval banner */}
      {status === 'resignation_pending' && (
        <div style={{ marginTop: 14, background: 'rgba(245,166,35,.08)', border: '1px solid rgba(245,166,35,.2)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>⏳</span>
          <div><strong>Awaiting manager approval.</strong> Your resignation has been submitted and is pending review.</div>
        </div>
      )}

      {/* Relieving letter download */}
      {status === 'exited' && myStatus.relieving_letter_id && (
        <div style={{ marginTop: 14, background: 'rgba(63,207,142,.08)', border: '1px solid rgba(63,207,142,.2)', borderRadius: 8, padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)', marginBottom: 4 }}>✓ Relieving Letter Ready</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>Your relieving letter has been generated.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {myStatus.has_pdf && <button className="btn btn-primary" onClick={() => onDownload('pdf')} disabled={downloading}>⬇ Download PDF</button>}
            {myStatus.has_docx && <button className="btn btn-secondary" onClick={() => onDownload('docx')} disabled={downloading}>⬇ Download DOCX</button>}
          </div>
        </div>
      )}
      {status === 'exited' && !myStatus.relieving_letter_id && (
        <div style={{ marginTop: 14, background: 'var(--surface-2)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
          ✓ Exit complete. Your relieving letter will appear here once issued by HR.
        </div>
      )}
    </div>
  );
}

// ─── EMPLOYEE VIEW ────────────────────────────────────────────────────────────

function EmployeeExitView() {
  const [myStatus, setMyStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showResign, setShowResign] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = () => {
    setLoading(true);
    axios.get('/api/exit/my-status').then(r => setMyStatus(r.data)).catch(() => { }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const download = async (fmt) => {
    if (!myStatus?.relieving_letter_id) return;
    setDownloading(true);
    try {
      const r = await axios.get(`/api/exit/relieving/${myStatus.relieving_letter_id}/download?format=${fmt}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `relieving_letter.${fmt}`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Download failed. Please try again.'); }
    finally { setDownloading(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)' }}>Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Exit & Relieving</h1>
          <p className="page-subtitle">Submit your resignation request</p>
        </div>
      </div>

      <MyResignationStatus
        myStatus={myStatus}
        onResign={() => setShowResign(true)}
        onDownload={download}
        downloading={downloading}
      />

      {showResign && (
        <EmployeeResignModal onClose={() => setShowResign(false)} onDone={() => { setShowResign(false); load(); }} />
      )}
    </div>
  );
}

// ─── Employee: Resignation Modal ──────────────────────────────────────────────

function EmployeeResignModal({ onClose, onDone }) {
  const [form, setForm] = useState({ resignation_date: '', exit_reason: '', last_working_day: '' });
  const [loading, setL] = useState(false);
  const [error, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setL(true);
    try {
      await axios.post('/api/exit/resign', {
        resignation_date: form.resignation_date,
        exit_reason: form.exit_reason,
        last_working_day: form.last_working_day || undefined,
      });
      onDone('Resignation submitted. Awaiting your manager\'s approval.');
    } catch (err) {
      setErr(err.response?.data?.error || 'Submission failed');
    } finally { setL(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="modal-title" style={{ margin: 0 }}>Apply for Resignation</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ background: 'rgba(245,166,35,.08)', border: '1px solid rgba(245,166,35,.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--amber)' }}>
          Your resignation will be sent to your manager for approval before it takes effect.
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Resignation Date *</label>
            <input type="date" required value={form.resignation_date}
              onChange={e => setForm({ ...form, resignation_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Exit Reason *</label>
            <textarea
              required                          // ← add this
              value={form.exit_reason}
              onChange={e => setExitReason(e.target.value)}
              placeholder="Describe your reason for resignation..."
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
          {/* <div className="form-group">
            <label className="form-label">Last Working Day <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(leave blank to auto-calculate)</span></label>
            <input type="date" value={form.last_working_day}
              onChange={e => setForm({ ...form, last_working_day: e.target.value })} />
          </div> */}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting…' : 'Submit Resignation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MANAGER VIEW ─────────────────────────────────────────────────────────────
// Split into two sections:
//   1. My Resignation — manager's own status (same as employee view)
//   2. Team Approvals — only their team members (self excluded by backend)

function ManagerExitView() {
  const [myStatus, setMyStatus] = useState(null);
  const [myLoading, setMyLoading] = useState(true);
  const [showResign, setShowResign] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // const [pending,      setPending]      = useState([]);
  // const [pipeline,     setPipeline]     = useState([]);
  // const [teamLoading,  setTeamLoading]  = useState(true);
  // const [activeTab,    setActiveTab]    = useState('approvals');
  // const [rejectTarget, setRejectTarget] = useState(null);
  // const [success,      setSuccess]      = useState('');

  const loadMyStatus = () => {
    setMyLoading(true);
    axios.get('/api/exit/my-status').then(r => setMyStatus(r.data)).catch(() => { }).finally(() => setMyLoading(false));
  };

  // const loadTeam = () => {
  //   setTeamLoading(true);
  //   Promise.all([
  //     axios.get('/api/exit/pending-approvals'),
  //     axios.get('/api/exit/'),
  //   ]).then(([p, l]) => {
  //     setPending(p.data);
  //     setPipeline(l.data);
  //   }).finally(() => setTeamLoading(false));
  // };

  useEffect(() => { loadMyStatus(); }, []);

  // const notify = (msg) => { setSuccess(msg); loadTeam(); setTimeout(() => setSuccess(''), 4000); };

  // const approve = async (emp) => {
  //   try {
  //     await axios.post(`/api/exit/${emp._id}/approve-resignation`);
  //     notify(`${emp.name}'s resignation approved. Now in notice period.`);
  //   } catch (e) { alert(e.response?.data?.error || 'Failed'); }
  // };

  const downloadRelieving = async (fmt) => {
    if (!myStatus?.relieving_letter_id) return;
    setDownloading(true);
    try {
      const r = await axios.get(`/api/exit/relieving/${myStatus.relieving_letter_id}/download?format=${fmt}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `relieving_letter.${fmt}`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Download failed. Please try again.'); }
    finally { setDownloading(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Exit & Relieving</h1>
      </div>

      {/* {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>} */}

      {/* ── Section 1: My resignation status ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: 1.2, marginBottom: 10 }}>My Resignation Status</div>
        {myLoading ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-dim)' }}>Loading…</div>
        ) : (
          <MyResignationStatus
            myStatus={myStatus}
            onResign={() => setShowResign(true)}
            onDownload={downloadRelieving}
            downloading={downloading}
          />
        )}
      </div>

      {/* ── Section 2: Team approvals ── */}
      {/* <div style={{ fontSize: 10, fontFamily: 'var(--mono)', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: 1.2, marginBottom: 10 }}>Team Exit Management</div> */}

      {/* Tabs
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button className={`tab-btn ${activeTab === 'approvals' ? 'active' : ''}`} onClick={() => setActiveTab('approvals')}>
          Pending Approvals
          {pending.length > 0 && <span style={{ marginLeft: 6, background: 'var(--amber)', color: '#000', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{pending.length}</span>}
        </button>
        <button className={`tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`} onClick={() => setActiveTab('pipeline')}>
          Exit Pipeline <span style={{ marginLeft: 6, background: 'var(--surface-2)', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{pipeline.length}</span>
        </button>
      </div>

      {teamLoading ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)' }}>Loading…</div> : (
        <>
          {/* Pending Approvals */}
      {showResign && (
        <EmployeeResignModal
          onClose={() => setShowResign(false)}
          onDone={() => { setShowResign(false); loadMyStatus(); }}
        />
      )}
    </div>
  );
}

function RejectModal({ emp, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [loading, setL] = useState(false);
  const submit = async () => {
    setL(true);
    try {
      await axios.post(`/api/exit/${emp._id}/reject-resignation`, { reason });
      onDone(`${emp.name}'s resignation rejected.`);
    } catch (e) { alert(e.response?.data?.error || 'Failed'); setL(false); }
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Reject Resignation</h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>Rejecting <strong>{emp.name}</strong>'s resignation will restore their status to active.</p>
        <div className="form-group">
          <label className="form-label">Reason (optional)</label>
          <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain the reason for rejection…" />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={submit} disabled={loading}>{loading ? 'Rejecting…' : '✗ Confirm Rejection'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── HR VIEW ──────────────────────────────────────────────────────────────────

function HRExitView() {
  const [employees, setEmployees] = useState([]);
  const [relievingTpls, setRelievingTpls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [clearTarget, setClearTarget] = useState(null);
  const [relTarget, setRelTarget] = useState(null);
  const [success, setSuccess] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      axios.get('/api/exit/'),
      axios.get('/api/templates/?type=relieving'),
    ]).then(([e, t]) => {
      setEmployees(e.data);
      setRelievingTpls(t.data.filter(x => x.is_active));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const notify = (msg) => { setSuccess(msg); load(); setTimeout(() => setSuccess(''), 5000); };

  const counts = useMemo(() =>
    employees.reduce((acc, e) => {
      if (acc[e.status] !== undefined) acc[e.status]++;
      return acc;
    }, { notice_period: 0, clearance_pending: 0, clearance_complete: 0, exited: 0 }),
    [employees]
  );

  const displayed = useMemo(() =>
    employees
      .filter(e => !filterStatus || e.status === filterStatus)
      .filter(e => !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.employee_id?.toLowerCase().includes(search.toLowerCase())),
    [employees, filterStatus, search]
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Exit & Relieving</h1>
          <p className="page-subtitle">Clearance management and relieving letter issuance</p>
        </div>
      </div>

      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      {/* Pipeline summary */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Exit Pipeline — Compliance Gate Active</div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
          {[
            { label: 'Notice Period', count: counts.notice_period, color: 'var(--amber)' },
            { label: 'Clearance', count: counts.clearance_pending, color: 'var(--amber)' },
            { label: 'All Cleared', count: counts.clearance_complete, color: 'var(--accent)' },
            { label: 'Exited', count: counts.exited, color: 'var(--green)' },
          ].map((step, i, arr) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ flex: 1, padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: step.color }}>{step.count}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: step.color }}>{step.label}</div>
              </div>
              {i < arr.length - 1 && <div style={{ padding: '0 8px', color: 'var(--border-bright)', fontSize: 16 }}>→</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Compliance gate notice */}
      <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(240,82,82,.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16 }}>⊘</span>
        <div style={{ fontSize: 12, color: 'var(--red)', lineHeight: 1.5 }}>
          <strong>Compliance Gate:</strong> The "Generate Relieving" button only appears after all 5 department clearances are confirmed. This cannot be bypassed.
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search by name or ID…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 240 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['', `All (${employees.length})`], ['notice_period', `Notice (${counts.notice_period})`], ['clearance_pending', `Pending (${counts.clearance_pending})`], ['clearance_complete', `Cleared (${counts.clearance_complete})`], ['exited', `Exited (${counts.exited})`]].map(([val, lbl]) => (
            <button key={val} className={`btn btn-sm ${filterStatus === val ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterStatus(val)} style={{ fontSize: 11 }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="page-loading"><div className="spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Employee</th><th>Designation</th>
                <th>Resigned On</th><th>Last Working Day</th>
                <th>Clearance</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr><td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-icon">⇥</div>
                      <p>{employees.length === 0 ? 'No employees in exit pipeline.' : 'No employees match this filter.'}</p>
                    </div>
                  </td></tr>
                ) : displayed.map(emp => {
                  const cleared = allCleared(emp);
                  const days = daysUntil(emp.last_working_day);
                  const overdue = days !== null && days < 0;
                  const cfg = STATUS_CFG[emp.status] || { label: emp.status, cls: 'badge-gray' };
                  return (
                    <tr key={emp._id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{emp.name}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{emp.employee_id}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{emp.designation}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{emp.department}</div>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>{emp.resignation_date || '—'}</td>
                      <td>
                        {emp.last_working_day ? (
                          <>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: overdue ? 'var(--red)' : days <= 5 ? 'var(--amber)' : 'var(--text)' }}>{emp.last_working_day}</div>
                            {emp.status !== 'exited' && days !== null && (
                              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: overdue ? 'var(--red)' : days <= 5 ? 'var(--amber)' : 'var(--text-dim)' }}>
                                {days > 0 ? `${days}d left` : days === 0 ? 'Today' : `${Math.abs(days)}d overdue`}
                              </div>
                            )}
                          </>
                        ) : '—'}
                      </td>
                      <td style={{ minWidth: 140 }}>
                        {emp.status !== 'notice_period'
                          ? <ClearanceBar emp={emp} />
                          : <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Not started</span>}
                      </td>
                      <td><span className={`badge ${cfg.cls}`}>{cfg.label}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {['notice_period', 'clearance_pending', 'clearance_complete'].includes(emp.status) && (
                            <button className="btn btn-sm btn-secondary" onClick={() => setClearTarget(emp)}>
                              ◉ Clearances
                            </button>
                          )}
                          {cleared && emp.status === 'clearance_complete' && (
                            <button className="btn btn-sm btn-primary"
                              style={{ background: 'var(--green)', borderColor: 'var(--green)' }}
                              onClick={() => setRelTarget(emp)}>
                              ◈ Generate Relieving
                            </button>
                          )}
                          {emp.status === 'exited' && (
                            <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--mono)' }}>✓ Complete</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {clearTarget && (
        <ClearancePanel emp={clearTarget}
          onUpdate={(type) => { load(); if (type === 'all_cleared') notify('All clearances complete! Relieving letter generation is now unlocked.'); }}
          onClose={() => { setClearTarget(null); load(); }} />
      )}

      {relTarget && (
        <RelievingModal emp={relTarget} templates={relievingTpls}
          onClose={() => setRelTarget(null)}
          onDone={(msg) => { setRelTarget(null); notify(msg); }} />
      )}
    </div>
  );
}

// ─── Clearance Panel (HR only) ────────────────────────────────────────────────

function ClearancePanel({ emp, onUpdate, onClose }) {
  const [clearances, setClearances] = useState(emp.clearances || {});
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');
  const days = daysUntil(emp.last_working_day);
  const done = CLEARANCE_ITEMS.filter(i => clearances[i.key]).length;
  const total = CLEARANCE_ITEMS.length;
  const pct = Math.round((done / total) * 100);

  const toggle = async (key, newVal) => {
    setSaving(key); setError('');
    try {
      const res = await axios.post(`/api/exit/${emp._id}/clearance`, { [key]: newVal });
      setClearances(prev => ({ ...prev, [key]: newVal }));
      if (res.data.all_cleared) onUpdate('all_cleared');
      else onUpdate('updated');
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    } finally { setSaving(null); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 className="modal-title" style={{ margin: 0 }}>Clearance Checklist</h2>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{emp.name} · {emp.employee_id}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: pct === 100 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : 'var(--red)' }}>{pct}%</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{done}/{total}</div>
          </div>
        </div>

        {emp.last_working_day && (
          <div style={{ background: days !== null && days <= 3 ? 'var(--red-dim)' : 'var(--surface-2)', border: `1px solid ${days !== null && days <= 3 ? 'rgba(240,82,82,.3)' : 'var(--border)'}`, borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>Last Working Day</div>
              <div style={{ fontWeight: 600 }}>{emp.last_working_day}</div>
            </div>
            {days !== null && <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: days <= 3 ? 'var(--red)' : days <= 7 ? 'var(--amber)' : 'var(--text-dim)' }}>{days > 0 ? `${days} days left` : days === 0 ? 'Today' : `${Math.abs(days)}d overdue`}</div>}
          </div>
        )}

        <div style={{ height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: pct === 100 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : 'var(--red)', transition: 'width .4s' }} />
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {CLEARANCE_ITEMS.map(item => {
            const ok = clearances[item.key] === true;
            const busy = saving === item.key;
            return (
              <div key={item.key} onClick={() => !busy && toggle(item.key, !ok)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 8, background: ok ? 'var(--green-dim)' : 'var(--surface-2)', border: `1px solid ${ok ? 'rgba(63,207,142,.25)' : 'var(--border)'}`, cursor: busy ? 'wait' : 'pointer', opacity: busy ? .6 : 1, transition: 'all .2s' }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: ok ? 'var(--green)' : 'var(--surface)', border: `1.5px solid ${ok ? 'var(--green)' : 'var(--border-bright)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white' }}>
                  {busy ? '…' : ok ? '✓' : ''}
                </div>
                <span style={{ fontSize: 16, opacity: .7 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: ok ? 'var(--green)' : 'var(--text)' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.desc}</div>
                </div>
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 99, background: ok ? 'rgba(63,207,142,.15)' : 'var(--border)', color: ok ? 'var(--green)' : 'var(--text-dim)' }}>
                  {ok ? 'CLEARED' : 'PENDING'}
                </span>
              </div>
            );
          })}
        </div>

        {pct === 100 ? (
          <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(63,207,142,.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--green)', marginBottom: 16 }}>
            ✓ All clearances complete. Relieving letter generation is now unlocked.
          </div>
        ) : (
          <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(240,82,82,.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--red)', marginBottom: 16 }}>
            ✕ {total - done} clearance{total - done !== 1 ? 's' : ''} remaining before relieving letter can be generated.
          </div>
        )}

        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

// ─── Friendly label for placeholder keys ─────────────────────────────────────

const PLACEHOLDER_LABELS = {
  employee_name: 'Employee Name',
  employee_id: 'Employee ID',
  designation: 'Designation',
  department: 'Department',
  joining_date: 'Date of Joining',
  last_working_day: 'Last Working Day',
  resignation_date: 'Resignation Date',
  exit_reason: 'Exit Reason',
  date: 'Letter Date',
};

// ─── Relieving Letter Modal (HR only) ────────────────────────────────────────
//
// Flow:
//   1. HR selects template  → auto-calls /preview with employee data
//   2a. All fields filled   → PDF preview rendered immediately
//   2b. Fields missing      → inline form shown for just the missing fields
//   3. HR fills missing     → clicks "Preview Again" → re-calls /preview with extra_fields
//   4. Preview looks good   → HR fills email → clicks "Generate"

function RelievingModal({ emp, templates, onClose, onDone }) {
  const [templateId, setTemplateId] = useState('');
  const [candidateEmail, setCandidateEmail] = useState(emp.email || emp.login_email || '');
  const [extraFields, setExtraFields] = useState({});// HR-filled missing values
  const [missingFields, setMissingFields] = useState([]);   // keys backend said were empty
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // Auto-fetch login email if not already on emp object
  useEffect(() => {
    if (!candidateEmail && emp._id) {
      axios.get(`/api/exit/${emp._id}/login-email`)
        .then(r => { if (r.data.email) setCandidateEmail(r.data.email); })
        .catch(() => { });
    }
  }, [emp._id]);

  // ── Call /preview — handles both step 1 (initial) and step 2 (after fill) ─
  const triggerPreview = async (tid, extra = {}) => {

    if (!tid) return;
    setPreviewing(true);
    setPreviewUrl(null);
    setPreviewError('');
    setMissingFields([]);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/exit/relieving/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employee_id: emp._id, template_id: tid, extra_fields: extra }),
      });

      if (res.status === 422) {
        // Backend found unfilled placeholders — show fill-in form
        const d = await res.json();
        setMissingFields(d.missing_fields || []);
        // Pre-fill extraFields with whatever the backend already resolved
        setExtraFields(prev => {
          const merged = { ...(d.current_ctx || {}), ...prev };
          // Keep only the missing keys so the form is minimal
          const filtered = {};
          (d.missing_fields || []).forEach(k => { filtered[k] = merged[k] || ''; });
          return { ...prev, ...filtered };
        });
        return;
      }

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setPreviewError(d.error || 'Preview failed. Check employee record.');
        return;
      }

      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      setPreviewError('Preview generation failed.');
    } finally {
      setPreviewing(false);
    }
  };

  // ── Template selector ────────────────────────────────────────────────────
  const handleTemplateChange = (tid) => {
    setTemplateId(tid);
    setExtraFields({});
    setMissingFields([]);
    triggerPreview(tid, {});
  };

  // Auto-select template if only one exists
  useEffect(() => {
    if (templates.length === 1 && !templateId) {
      handleTemplateChange(templates[0]._id);
    }
  }, [templates]);

  // ── HR filled missing fields → re-preview ───────────────────────────────
  const handleRePreview = () => {
    // Validate all missing fields are filled
    const empty = missingFields.filter(k => !String(extraFields[k] || '').trim());
    if (empty.length) {
      setPreviewError(`Please fill in: ${empty.map(k => PLACEHOLDER_LABELS[k] || k).join(', ')}`);
      return;
    }
    setPreviewError('');
    triggerPreview(templateId, extraFields);
  };

  // ── Final generate ───────────────────────────────────────────────────────
  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!previewUrl) { setGenError('Please preview the letter first.'); return; }
    setGenError(''); setGenerating(true);
    try {
      await axios.post('/api/exit/relieving/generate', {
        employee_id: emp._id,
        template_id: templateId,
        candidate_email: candidateEmail,
        extra_fields: extraFields,
      });
      onDone(`Relieving letter generated for ${emp.name}. Employee status updated to Exited.`);
    } catch (err) {
      const d = err.response?.data;
      setGenError(d?.missing_clearances
        ? `Missing clearances: ${d.missing_clearances.join(', ')}`
        : d?.error || 'Generation failed');
    } finally { setGenerating(false); }
  };

  const hasPreview = !!previewUrl;
  const hasMissing = missingFields.length > 0;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        className="modal"
        style={{ maxWidth: hasPreview ? 900 : 520, maxHeight: '95vh', overflowY: 'auto', transition: 'max-width .25s' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="modal-title" style={{ margin: 0 }}>Generate Relieving Letter</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Employee info card */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['Employee', emp.name], ['ID', emp.employee_id], ['Designation', emp.designation], ['LWD', emp.last_working_day]]
              .filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{v}</div>
                </div>
              ))}
          </div>
        </div>

        {/* Clearance banner */}
        <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(63,207,142,.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✓</span> All 5 clearances confirmed. Letter generation unlocked.
        </div>

        <form onSubmit={handleGenerate}>
          <div style={{ display: hasPreview ? 'grid' : 'block', gridTemplateColumns: '300px 1fr', gap: 24 }}>

            {/* ── Left column: controls ── */}
            <div>

              {/* Template selector */}
              <div className="form-group">
                <label className="form-label">Relieving Letter Template <span style={{ color: 'var(--red)' }}>*</span></label>
                <select required value={templateId} onChange={e => handleTemplateChange(e.target.value)}>
                  <option value="">Select template…</option>
                  {templates.map(t => <option key={t._id} value={t._id}>{t.name} (v{t.version})</option>)}
                </select>
                {templates.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 6 }}>No relieving templates found. Upload one in Templates.</div>
                )}
              </div>

              {/* Spinner while previewing */}
              {previewing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)', padding: '8px 0' }}>
                  <div className="spinner" style={{ width: 14, height: 14 }} /> Reading template & generating preview…
                </div>
              )}

              {/* ── Missing fields form ── */}
              {hasMissing && !previewing && (
                <div style={{ background: 'rgba(245,166,35,.07)', border: '1px solid rgba(245,166,35,.25)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)', marginBottom: 4 }}>
                    ⚠ {missingFields.length} field{missingFields.length !== 1 ? 's' : ''} not found in employee record
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
                    The following could not be filled from the employee record. Please enter them manually, then click Preview Again.
                  </div>

                  {missingFields.map(key => (
                    <div className="form-group" key={key} style={{ marginBottom: 10 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>
                        {PLACEHOLDER_LABELS[key] || key} <span style={{ color: 'var(--red)' }}>*</span>
                      </label>
                      <input
                        value={extraFields[key] || ''}
                        onChange={e => setExtraFields(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={`Enter ${PLACEHOLDER_LABELS[key] || key}…`}
                        style={{ fontSize: 13 }}
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', marginTop: 4 }}
                    onClick={handleRePreview}
                  >
                    ↻ Preview Again
                  </button>
                </div>
              )}

              {/* Preview error */}
              {previewError && !previewing && (
                <div style={{ fontSize: 12, color: 'var(--red)', padding: '6px 0', marginBottom: 8 }}>⚠ {previewError}</div>
              )}

              {/* Preview success indicator */}
              {hasPreview && !hasMissing && (
                <div style={{ fontSize: 12, color: 'var(--green)', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  ✓ Preview ready
                </div>
              )}

              {/* Candidate email */}
              <div className="form-group">
                <label className="form-label">Candidate Email <span style={{ color: 'var(--red)' }}>*</span></label>
                <input
                  type="email"
                  value={candidateEmail}
                  onChange={e => setCandidateEmail(e.target.value)}
                  placeholder="e.g. employee@gmail.com"
                  required
                />
              </div>

              {genError && <div className="alert alert-error" style={{ marginTop: 8 }}>{genError}</div>}
            </div>

            {/* ── Right column: PDF preview iframe ── */}
            {hasPreview && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Document Preview
                </div>
                <iframe
                  src={previewUrl}
                  style={{ flex: 1, minHeight: 520, border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }}
                  title="Relieving Letter Preview"
                />
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={generating || !templateId || !hasPreview || hasMissing}
              title={!hasPreview ? 'Preview the letter first' : hasMissing ? 'Fill in all missing fields first' : ''}
            >
              {generating ? 'Generating…' : '◈ Generate Relieving Letter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Root — role router ───────────────────────────────────────────────────────

export default function ExitPage() {
  const { user } = useAuth();
  const role = user?.role || 'employee';

  if (role === 'employee') return <EmployeeExitView />;
  if (role === 'manager') return <ManagerExitView />;
  if (['hr_head', 'admin'].includes(role)) return <HRExitView />;
  return <EmployeeExitView />;
}