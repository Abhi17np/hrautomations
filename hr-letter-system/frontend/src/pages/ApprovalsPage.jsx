import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// FIX #15: added issued and withdrawn statuses
const STATUS_CFG = {
  pending_manager:  { label: 'Pending Manager',  cls: 'badge-amber' },
  pending_hr_head:  { label: 'Pending HR Head',  cls: 'badge-amber' },
  approved:         { label: 'Approved',         cls: 'badge-green' },
  rejected:         { label: 'Rejected',         cls: 'badge-red'   },
  issued:           { label: 'Issued',           cls: 'badge-green' },
  withdrawn:        { label: 'Withdrawn',        cls: 'badge-red'   },
};

function LetterRow({ l, onReview, canAct }) {
  const cfg = STATUS_CFG[l.status] || {};
  return (
    <tr>
      <td>
        <div style={{ fontWeight: 500 }}>{l.employee_name}</div>
        <div className="mono text-muted text-sm">{l.employee_code}</div>
      </td>
      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.designation}</td>
      <td><span className={`badge ${cfg.cls}`}>{cfg.label}</span></td>
      <td className="mono text-muted text-sm">{new Date(l.created_at).toLocaleDateString('en-IN')}</td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(l.approval_history || []).map((h, i) => (
            <div key={i} style={{ fontSize: 11, color: h.action === 'approve' || h.action === 'submitted' ? 'var(--green)' : h.action === 'reject' ? 'var(--red)' : 'var(--text-dim)' }}>
              {h.user_name || h.role} → {h.action}
            </div>
          ))}
          {!(l.approval_history?.length) && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>No history</span>}
        </div>
      </td>
      <td>
        {canAct
          ? <button className="btn btn-sm btn-primary" onClick={() => onReview(l)}>Review</button>
          : <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Not your stage</span>
        }
      </td>
    </tr>
  );
}

function ReviewModal({ letter, onClose, onDone }) {
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const act = async (action) => {
    // FIX #10: enforce remarks client-side for rejection
    if (action === 'reject' && !remarks.trim()) {
      setError('Rejection reason is required');
      return;
    }
    setLoading(true); setError('');
    try {
      await axios.post(`/api/approvals/${letter._id}/action`, { action, remarks });
      onDone(action);
    } catch (e) {
      setError(e.response?.data?.error || 'Action failed');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <h2 className="modal-title">Review Offer Letter</h2>

        <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['Employee', letter.employee_name], ['ID', letter.employee_code], ['Status', letter.status], ['Version', `v${letter.version}`]].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {letter.approval_history?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Approval Trail</div>
            {letter.approval_history.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ fontFamily: 'var(--mono)', color: h.action === 'approve' ? 'var(--green)' : h.action === 'reject' ? 'var(--red)' : 'var(--accent)', minWidth: 70 }}>{h.action}</span>
                <span style={{ color: 'var(--text-muted)' }}>{h.user_name || h.role}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{h.timestamp?.slice(0, 10)}</span>
                {h.remarks && <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>"{h.remarks}"</span>}
              </div>
            ))}
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          {/* FIX #10: placeholder now indicates remarks are required for rejection */}
          <label className="form-label">Remarks <span style={{ color: 'var(--red)', fontSize: 10 }}>(required for rejection)</span></label>
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3}
            placeholder="Add notes... Required if rejecting." />
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-danger" onClick={() => act('reject')} disabled={loading}>✕ Reject</button>
          <button className="btn btn-primary" onClick={() => act('approve')} disabled={loading}
            style={{ background: 'var(--green)', borderColor: 'var(--green)' }}>
            ✓ Approve
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const { user }                    = useAuth();
  const [pending,  setPending]      = useState([]);
  const [history,  setHistory]      = useState([]);
  const [loading,  setLoading]      = useState(true);
  const [reviewing, setReview]      = useState(null);
  const [success,  setSuccess]      = useState('');
  const [tab,      setTab]          = useState('pending');

  const load = () => {
    setLoading(true);
    Promise.all([
      axios.get('/api/approvals/pending'),
      axios.get('/api/approvals/history'),
    ]).then(([p, h]) => { setPending(p.data); setHistory(h.data); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const canActOn = (letter) => {
    const flow = { pending_manager: ['manager', 'admin'], pending_hr_head: ['hr_head', 'admin'] };
    return !!flow[letter.status]?.includes(user?.role);
  };

  const onDone = (action) => {
    setReview(null);
    load();
    setSuccess(`Letter ${action}d successfully.`);
    setTimeout(() => setSuccess(''), 4000);
  };

  const displayList = tab === 'pending' ? pending : history;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-subtitle">Offer letter approval workflow</p>
        </div>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '6px 14px', borderRadius: 'var(--radius)', color: 'var(--text-muted)' }}>
          Logged in as <span style={{ color: 'var(--accent)' }}>{user?.role}</span>
        </div>
      </div>

      {success && <div className="alert alert-success">{success}</div>}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        {[
          { label: 'HR', desc: 'Generates & submits', color: 'var(--text-muted)' },
          { label: '→', color: 'var(--border-bright)' },
          { label: 'Manager', desc: 'First approval', color: 'var(--amber)', active: user?.role === 'manager' },
          { label: '→', color: 'var(--border-bright)' },
          { label: 'HR Head', desc: 'Final approval', color: 'var(--accent)', active: user?.role === 'hr_head' },
          { label: '→', color: 'var(--border-bright)' },
          { label: '✓ Approved', color: 'var(--green)' },
        ].map((s, i) => s.label === '→' ? (
          <span key={i} style={{ color: s.color, fontSize: 14 }}>→</span>
        ) : (
          <div key={i} style={{ padding: '4px 12px', borderRadius: 6, background: s.active ? `${s.color}22` : 'transparent', border: s.active ? `1px solid ${s.color}44` : '1px solid transparent' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.label}</div>
            {s.desc && <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{s.desc}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['pending', `Pending (${pending.length})`], ['history', `History (${history.length})`]].map(([key, label]) => (
          <button key={key} className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(key)} style={{ fontSize: 12 }}>{label}</button>
        ))}
      </div>

      <div className="card">
        {loading ? <div className="page-loading"><div className="spinner" /></div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Designation</th><th>Status</th><th>Submitted</th><th>Trail</th><th>Action</th></tr></thead>
              <tbody>
                {displayList.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state">
                    <div className="empty-icon">◎</div>
                    <p>{tab === 'pending' ? 'No letters pending your approval' : 'No approval history yet'}</p>
                  </div></td></tr>
                ) : displayList.map(l => (
                  <LetterRow key={l._id} l={l} onReview={setReview} canAct={tab === 'pending' && canActOn(l)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {reviewing && <ReviewModal letter={reviewing} onClose={() => setReview(null)} onDone={onDone} />}
    </div>
  );
}