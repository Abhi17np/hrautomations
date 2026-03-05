import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
// FIX #6: removed useAuth import — user variable was imported but never used

// ─── Constants ────────────────────────────────────────────────────────────────

const CLEARANCE_ITEMS = [
  { key: 'it_assets',    label: 'IT Assets',    icon: '⬡', desc: 'Laptop, access cards, equipment returned'    },
  { key: 'finance',      label: 'Finance',      icon: '◈', desc: 'Dues settled, expense claims cleared'        },
  { key: 'admin',        label: 'Admin',        icon: '▦', desc: 'Office keys, ID cards, parking returned'     },
  { key: 'hr_docs',      label: 'HR Docs',      icon: '◉', desc: 'Signed docs, NDAs, policy acknowledgements'  },
  { key: 'access_cards', label: 'Access Cards', icon: '◎', desc: 'Building and system access revoked'          },
];

const EXIT_STATUS_CFG = {
  notice_period:      { label: 'Notice Period',      cls: 'badge-amber' },
  clearance_pending:  { label: 'Clearance Pending',  cls: 'badge-amber' },
  clearance_complete: { label: 'Clearance Complete', cls: 'badge-blue'  },
  exited:             { label: 'Exited',             cls: 'badge-gray'  },
};

const EXIT_STATUSES = ['notice_period', 'clearance_pending', 'clearance_complete', 'exited'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function allCleared(emp) {
  const c = emp.clearances || {};
  return CLEARANCE_ITEMS.every(item => c[item.key] === true);
}

function clearedCount(emp) {
  const c = emp.clearances || {};
  return CLEARANCE_ITEMS.filter(item => c[item.key] === true).length;
}

// FIX #19: normalise both dates to local midnight to avoid UTC/IST off-by-one
function daysUntilLWD(lwd) {
  if (!lwd) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Parse as local midnight by appending T00:00:00 (avoids UTC parse)
  const lwdDate = new Date(lwd + 'T00:00:00');
  return Math.round((lwdDate - today) / (1000 * 60 * 60 * 24));
}

// ─── ClearanceProgress (table cell mini-bar) ──────────────────────────────────

function ClearanceProgress({ emp }) {
  const done  = clearedCount(emp);
  const total = CLEARANCE_ITEMS.length;
  const pct   = Math.round((done / total) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99, width: `${pct}%`,
          background: pct === 100 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : 'var(--red)',
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: pct === 100 ? 'var(--green)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {done}/{total}
      </span>
    </div>
  );
}

// ─── Record Resignation Modal ─────────────────────────────────────────────────

function ResignationModal({ employees, onClose, onDone }) {
  const [form, setForm] = useState({
    employee_id: '', resignation_date: '', exit_reason: '', last_working_day: '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const activeEmployees = employees.filter(e => e.status === 'active');

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await axios.post(`/api/employees/${form.employee_id}/exit`, {
        resignation_date: form.resignation_date,
        exit_reason:      form.exit_reason,
        last_working_day: form.last_working_day || undefined,
      });
      onDone('Resignation recorded. Employee moved to notice period.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record resignation');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <h2 className="modal-title">Record Resignation</h2>
        <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--amber)' }}>
          Last Working Day is auto-computed from the employee's notice period. You can override it below.
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Employee *</label>
            <select required value={form.employee_id}
              onChange={e => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">Select active employee...</option>
              {activeEmployees.map(emp => (
                <option key={emp._id} value={emp._id}>
                  {emp.name} — {emp.employee_id} — {emp.designation}
                </option>
              ))}
            </select>
            {activeEmployees.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>
                No active employees found.
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Resignation Date *</label>
              <input type="date" required value={form.resignation_date}
                onChange={e => setForm({ ...form, resignation_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">LWD Override <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span></label>
              <input type="date" value={form.last_working_day}
                onChange={e => setForm({ ...form, last_working_day: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Exit Reason</label>
            <select value={form.exit_reason}
              onChange={e => setForm({ ...form, exit_reason: e.target.value })}>
              <option value="">Select reason...</option>
              <option value="Better Opportunity">Better Opportunity</option>
              <option value="Personal Reasons">Personal Reasons</option>
              <option value="Higher Education">Higher Education</option>
              <option value="Relocation">Relocation</option>
              <option value="Health Reasons">Health Reasons</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Recording...' : 'Record Resignation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Clearance Panel ──────────────────────────────────────────────────────────

function ClearancePanel({ emp, onUpdate, onClose }) {
  const [clearances, setClearances] = useState(emp.clearances || {});
  const [saving,     setSaving]     = useState(null);
  const [error,      setError]      = useState('');
  const days = daysUntilLWD(emp.last_working_day);

  const toggle = async (key, newVal) => {
    setSaving(key); setError('');
    try {
      const res = await axios.post(`/api/employees/${emp._id}/clearance`, { [key]: newVal });
      setClearances(prev => ({ ...prev, [key]: newVal }));
      if (res.data.all_cleared) onUpdate('all_cleared');
      else onUpdate('updated');
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    } finally { setSaving(null); }
  };

  const done  = CLEARANCE_ITEMS.filter(i => clearances[i.key]).length;
  const total = CLEARANCE_ITEMS.length;
  const pct   = Math.round((done / total) * 100);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 className="modal-title" style={{ margin: 0 }}>Clearance Checklist</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{emp.name} — {emp.employee_id}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--display)', color: pct === 100 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : 'var(--red)' }}>{pct}%</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{done}/{total} cleared</div>
          </div>
        </div>

        {emp.last_working_day && (
          <div style={{
            background: days !== null && days <= 3 ? 'var(--red-dim)' : 'var(--surface-2)',
            border: `1px solid ${days !== null && days <= 3 ? 'rgba(240,82,82,0.3)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)', padding: '10px 14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
          }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>Last Working Day</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{emp.last_working_day}</div>
            </div>
            {days !== null && (
              <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: days <= 3 ? 'var(--red)' : days <= 7 ? 'var(--amber)' : 'var(--text-muted)' }}>
                {days > 0 ? `${days} days left` : days === 0 ? 'Today' : `${Math.abs(days)} days overdue`}
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: pct === 100 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : 'var(--red)', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {CLEARANCE_ITEMS.map(item => {
            const isCleared = clearances[item.key] === true;
            const isSaving  = saving === item.key;
            return (
              <div key={item.key}
                onClick={() => !isSaving && toggle(item.key, !isCleared)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px', borderRadius: 'var(--radius)',
                  background: isCleared ? 'var(--green-dim)' : 'var(--surface-2)',
                  border: `1px solid ${isCleared ? 'rgba(63,207,142,0.25)' : 'var(--border)'}`,
                  cursor: isSaving ? 'wait' : 'pointer',
                  transition: 'all 0.2s', opacity: isSaving ? 0.6 : 1,
                }}
              >
                <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: isCleared ? 'var(--green)' : 'var(--surface)', border: `1.5px solid ${isCleared ? 'var(--green)' : 'var(--border-bright)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white', transition: 'all 0.2s' }}>
                  {isSaving ? '…' : isCleared ? '✓' : ''}
                </div>
                <span style={{ fontSize: 16, opacity: 0.7 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isCleared ? 'var(--green)' : 'var(--text)' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{item.desc}</div>
                </div>
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 99, flexShrink: 0, background: isCleared ? 'rgba(63,207,142,0.15)' : 'var(--border)', color: isCleared ? 'var(--green)' : 'var(--text-dim)' }}>
                  {isCleared ? 'CLEARED' : 'PENDING'}
                </span>
              </div>
            );
          })}
        </div>

        {pct === 100 ? (
          <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(63,207,142,0.3)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--green)', marginBottom: 16 }}>
            ✓ All clearances complete. Relieving letter generation is now unlocked.
          </div>
        ) : (
          <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(240,82,82,0.2)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--red)', marginBottom: 16 }}>
            ✕ Relieving letter is blocked until all {total} clearances are confirmed. {CLEARANCE_ITEMS.filter(i => !clearances[i.key]).length} remaining.
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Relieving Letter Modal ───────────────────────────────────────────────────

function RelievingModal({ emp, templates, onClose, onDone }) {
  const [form, setForm] = useState({
    company_name: 'Acme Corp', hr_signatory_name: '', hr_signatory_designation: 'HR Manager',
    template_id: '', extra_fields: {},
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // templates prop already contains only relieving type (filtered in load())
  const relievingTemplates = templates.filter(t => t.is_active);

  const generate = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await axios.post('/api/exit/relieving/generate', {
        employee_id:              emp._id,
        template_id:              form.template_id,
        company_name:             form.company_name,
        hr_signatory_name:        form.hr_signatory_name,
        hr_signatory_designation: form.hr_signatory_designation,
        extra_fields:             form.extra_fields,
      });
      onDone('Relieving letter generated. Employee status updated to Exited.');
    } catch (err) {
      const d = err.response?.data;
      if (d?.missing_clearances) {
        setError(`Clearance gate blocked: missing — ${d.missing_clearances.join(', ')}`);
      } else {
        setError(d?.error || 'Generation failed');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <h2 className="modal-title">Generate Relieving Letter</h2>

        <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['Employee', emp.name], ['ID', emp.employee_id], ['Designation', emp.designation], ['Department', emp.department], ['Joined', emp.joining_date], ['LWD', emp.last_working_day]].map(([k, v]) => v ? (
              <div key={k}>
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{v}</div>
              </div>
            ) : null)}
          </div>
        </div>

        <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(63,207,142,0.25)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✓</span> All clearances confirmed. Letter generation unlocked.
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={generate}>
          <div className="form-group">
            <label className="form-label">Relieving Letter Template *</label>
            <select required value={form.template_id}
              onChange={e => setForm({ ...form, template_id: e.target.value })}>
              <option value="">Select template...</option>
              {relievingTemplates.map(t => (
                <option key={t._id} value={t._id}>{t.name} (v{t.version})</option>
              ))}
            </select>
            {relievingTemplates.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 6 }}>
                No relieving templates found. Go to Templates and upload a relieving letter template.
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Signatory Name</label>
              <input value={form.hr_signatory_name} onChange={e => setForm({ ...form, hr_signatory_name: e.target.value })} placeholder="e.g. Priya Sharma" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Signatory Designation</label>
            <input value={form.hr_signatory_designation} onChange={e => setForm({ ...form, hr_signatory_designation: e.target.value })} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !form.template_id}>
              {loading ? 'Generating...' : '◈ Generate Relieving Letter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main ExitPage ────────────────────────────────────────────────────────────

export default function ExitPage() {
  // FIX #6: removed unused `user` from useAuth
  const [allEmployees,    setAllEmployees]    = useState([]);
  const [exitEmployees,   setExitEmployees]   = useState([]);
  const [relievingTmpls,  setRelievingTmpls]  = useState([]); // FIX #3: separate relieving templates state
  const [loading,         setLoading]         = useState(true);
  const [success,         setSuccess]         = useState('');

  const [showResignModal,  setShowResignModal]  = useState(false);
  const [clearanceTarget,  setClearanceTarget]  = useState(null);
  const [relievingTarget,  setRelievingTarget]  = useState(null);

  const [filterStatus, setFilterStatus] = useState('');
  const [search,       setSearch]       = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      axios.get('/api/employees/'),
      // FIX #3/#4: fetch relieving templates specifically, not all templates
      axios.get('/api/templates/?type=relieving'),
    ]).then(([empRes, tmplRes]) => {
      const all = empRes.data;
      setAllEmployees(all);
      setExitEmployees(all.filter(e => EXIT_STATUSES.includes(e.status)));
      setRelievingTmpls(tmplRes.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const notify = (msg) => {
    setSuccess(msg);
    load();
    setTimeout(() => setSuccess(''), 5000);
  };

  // FIX #20: use single-pass reduce instead of 4 separate filter calls
  const counts = useMemo(() =>
    exitEmployees.reduce((acc, e) => {
      if (acc[e.status] !== undefined) acc[e.status]++;
      return acc;
    }, { notice_period: 0, clearance_pending: 0, clearance_complete: 0, exited: 0 }),
    [exitEmployees]
  );

  // FIX #20: useMemo so filtering only recomputes when deps change
  const displayed = useMemo(() =>
    exitEmployees
      .filter(e => !filterStatus || e.status === filterStatus)
      .filter(e => !search ||
        e.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.employee_id?.toLowerCase().includes(search.toLowerCase())),
    [exitEmployees, filterStatus, search]
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Exit & Relieving</h1>
          <p className="page-subtitle">Resignation tracking, clearance validation, and relieving letter issuance</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowResignModal(true)}>
          + Record Resignation
        </button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}

      {/* Workflow pipeline */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          Exit Workflow — Compliance Gate Active
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
          {[
            { label: 'Resignation', sub: 'Recorded', count: Object.values(counts).reduce((a, b) => a + b, 0), color: 'var(--text-muted)' },
            { label: 'Notice Period', sub: 'Serving', count: counts.notice_period, color: 'var(--amber)' },
            { label: 'Clearance', sub: 'In Progress', count: counts.clearance_pending, color: 'var(--amber)' },
            { label: 'All Cleared', sub: 'Gate Passed', count: counts.clearance_complete, color: 'var(--accent)' },
            { label: 'Exited', sub: 'Letter Issued', count: counts.exited, color: 'var(--green)' },
          ].map((step, i, arr) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ flex: 1, padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--display)', color: step.color }}>{step.count}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: step.color, marginTop: 2 }}>{step.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{step.sub}</div>
              </div>
              {i < arr.length - 1 && (
                <div style={{ padding: '0 6px', color: 'var(--border-bright)', fontSize: 16, flexShrink: 0 }}>→</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Compliance gate notice */}
      <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(240,82,82,0.2)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16 }}>⊘</span>
        <div style={{ fontSize: 12, color: 'var(--red)', lineHeight: 1.5 }}>
          <strong>Compliance Gate:</strong> Relieving letters cannot be generated until all 5 department clearances are confirmed.
          This is system-enforced and cannot be bypassed.
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Search by name or ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 260 }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['', 'All'], ['notice_period', 'Notice Period'], ['clearance_pending', 'Clearance Pending'], ['clearance_complete', 'Clearance Complete'], ['exited', 'Exited']].map(([val, lbl]) => (
            <button key={val}
              className={`btn btn-sm ${filterStatus === val ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterStatus(val)}
              style={{ fontSize: 11 }}>
              {lbl} {val === '' ? `(${exitEmployees.length})` : `(${counts[val] || 0})`}
            </button>
          ))}
        </div>
      </div>

      {/* Main table */}
      <div className="card">
        {loading ? (
          <div className="page-loading"><div className="spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Designation</th>
                  <th>Resigned On</th>
                  <th>Last Working Day</th>
                  <th>Clearance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-icon">⇥</div>
                        <p>{exitEmployees.length === 0
                          ? 'No employees in exit process. Record a resignation to start.'
                          : 'No employees match this filter.'}</p>
                      </div>
                    </td>
                  </tr>
                ) : displayed.map(emp => {
                  const cfg       = EXIT_STATUS_CFG[emp.status] || { label: emp.status, cls: 'badge-gray' };
                  const cleared   = allCleared(emp);
                  const days      = daysUntilLWD(emp.last_working_day);
                  const isOverdue = days !== null && days < 0;

                  return (
                    <tr key={emp._id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{emp.name}</div>
                        <div className="mono text-muted text-sm">{emp.employee_id}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{emp.designation}</div>
                        <div className="text-sm text-muted">{emp.department}</div>
                      </td>
                      <td className="mono text-muted text-sm">{emp.resignation_date || '—'}</td>
                      <td>
                        {emp.last_working_day ? (
                          <>
                            <div className="mono" style={{ fontSize: 13, color: isOverdue ? 'var(--red)' : days !== null && days <= 5 ? 'var(--amber)' : 'var(--text)' }}>
                              {emp.last_working_day}
                            </div>
                            {days !== null && emp.status !== 'exited' && (
                              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: isOverdue ? 'var(--red)' : days <= 5 ? 'var(--amber)' : 'var(--text-dim)' }}>
                                {days > 0 ? `${days}d left` : days === 0 ? 'Today' : `${Math.abs(days)}d overdue`}
                              </div>
                            )}
                          </>
                        ) : '—'}
                      </td>
                      <td style={{ minWidth: 140 }}>
                        {emp.status !== 'notice_period'
                          ? <ClearanceProgress emp={emp} />
                          : <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Not started</span>}
                      </td>
                      <td>
                        <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {['notice_period', 'clearance_pending', 'clearance_complete'].includes(emp.status) && (
                            <button className="btn btn-sm btn-secondary"
                              onClick={() => setClearanceTarget(emp)}>
                              ◉ Clearances
                            </button>
                          )}
                          {cleared && emp.status !== 'exited' && (
                            <button className="btn btn-sm btn-primary"
                              style={{ background: 'var(--green)', borderColor: 'var(--green)' }}
                              onClick={() => setRelievingTarget(emp)}>
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

      {/* Modals */}
      {showResignModal && (
        <ResignationModal
          employees={allEmployees}
          onClose={() => setShowResignModal(false)}
          onDone={(msg) => { setShowResignModal(false); notify(msg); }}
        />
      )}

      {clearanceTarget && (
        <ClearancePanel
          emp={clearanceTarget}
          onUpdate={(type) => {
            // FIX #21: refresh list data when clearance panel updates
            load();
            if (type === 'all_cleared') {
              setSuccess('All clearances complete! Relieving letter is now unlocked.');
              setTimeout(() => setSuccess(''), 5000);
            }
          }}
          onClose={() => { setClearanceTarget(null); load(); }}
        />
      )}

      {relievingTarget && (
        <RelievingModal
          emp={relievingTarget}
          templates={relievingTmpls}
          onClose={() => setRelievingTarget(null)}
          onDone={(msg) => { setRelievingTarget(null); notify(msg); }}
        />
      )}
    </div>
  );
}