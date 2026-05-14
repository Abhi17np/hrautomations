/**
 * EmployeesPage.jsx — Complete employee directory with full profile view
 *
 * Layout:
 *  - Card grid (all employees, including exited with "LEFT" banner)
 *  - Click any card → full Employee Profile drawer/modal showing:
 *      Personal details · Offer letters · Appointment orders ·
 *      Documents · Exit / Relieving letters · Deactivate option
 *
 * Role permissions:
 *  - admin / hr_head / hr: can view all, add, edit, deactivate
 *  - deactivate only available after relieving letter is issued (status=exited)
 */

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_BADGE = {
  active: { cls: 'badge-green', label: 'Active' },
  inactive: { cls: 'badge-gray', label: 'Inactive' },
  resignation_pending: { cls: 'badge-amber', label: 'Pending Approval' },
  notice_period: { cls: 'badge-amber', label: 'Notice Period' },
  clearance_pending: { cls: 'badge-amber', label: 'Clearance Pending' },
  clearance_complete: { cls: 'badge-blue', label: 'All Cleared' },
  exited: { cls: 'badge-gray', label: 'Exited' },
};

const LETTER_STATUS = {
  draft: { cls: 'badge-gray', label: 'Draft' },
  pending_manager: { cls: 'badge-amber', label: 'Pending Manager' },
  pending_hr_head: { cls: 'badge-amber', label: 'Pending HR' },
  approved: { cls: 'badge-green', label: 'Approved' },
  rejected: { cls: 'badge-red', label: 'Rejected' },
  issued: { cls: 'badge-green', label: 'Issued' },
  exited: { cls: 'badge-gray', label: 'Exited' },
};

const EMPTY_FORM = {
  name: '', designation: '', department: '', ctc: '',
  joining_date: '', email: '', phone: '',
  notice_period: '60', probation_period: '6',
  address: '', father_name: '', date_of_birth: '', work_location: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Badge({ status, map = STATUS_BADGE }) {
  const c = map[status] || { cls: 'badge-gray', label: status?.replace(/_/g, ' ') || '—' };
  return <span className={`badge ${c.cls}`}>{c.label}</span>;
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'var(--mono)', letterSpacing: .8, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function SectionHeader({ title, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 12px', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>{title}</span>
      {count !== undefined && (
        <span style={{ fontSize: 11, background: 'var(--surface-2)', borderRadius: 20, padding: '1px 8px', color: 'var(--text-dim)' }}>{count}</span>
      )}
    </div>
  );
}

// ─── Employee Card ────────────────────────────────────────────────────────────
function EmployeeCard({ emp, onClick }) {
  const isGone = ['exited', 'inactive'].includes(emp.status);
  const isInExit = ['resignation_pending', 'notice_period', 'clearance_pending', 'clearance_complete'].includes(emp.status);
  const initials = emp.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const sb = STATUS_BADGE[emp.status] || { cls: 'badge-gray', label: emp.status };

  return (
    <div onClick={onClick}
      style={{
        background: 'var(--surface)', border: `1.5px solid ${isGone ? 'var(--border)' : 'var(--border)'}`,
        borderRadius: 12, padding: '18px 20px', cursor: 'pointer', position: 'relative',
        opacity: emp.status === 'inactive' ? .6 : 1,
        transition: 'all .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* LEFT / INACTIVE banner */}
      {emp.status === 'exited' && (
        <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 800, fontFamily: 'var(--mono)', letterSpacing: 1.5, color: 'var(--text-dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px' }}>LEFT</div>
      )}
      {emp.status === 'inactive' && (
        <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 800, fontFamily: 'var(--mono)', letterSpacing: 1.5, color: 'var(--red)', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 4, padding: '2px 6px' }}>INACTIVE</div>
      )}
      {isInExit && (
        <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 800, fontFamily: 'var(--mono)', letterSpacing: 1, color: 'var(--amber)', background: 'rgba(245,166,35,.08)', border: '1px solid rgba(245,166,35,.2)', borderRadius: 4, padding: '2px 6px' }}>EXITING</div>
      )}

      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: isGone ? 'var(--surface-2)' : 'var(--accent)',
          color: isGone ? 'var(--text-dim)' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 16, letterSpacing: .5,
        }}>{initials}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{emp.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 2 }}>{emp.employee_id}</div>
        </div>
      </div>

      {/* Details */}
      <div style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        {emp.designation && <div style={{ color: 'var(--text)', fontWeight: 500, fontSize: 12 }}>{emp.designation}</div>}
        {emp.department && <div>{emp.department}</div>}
        {emp.joining_date && <div>Joined {fmtDate(emp.joining_date)}</div>}
      </div>

      <span className={`badge ${sb.cls}`} style={{ fontSize: 10 }}>{sb.label}</span>
    </div>
  );
}

// ─── Employee Profile Modal ───────────────────────────────────────────────────
function EmployeeProfile({ emp, onClose, onRefresh, onEdit }) {
  const { user } = useAuth();
  const canManage = ['admin', 'hr_head'].includes(user?.role);
  const canAdmin = user?.role === 'admin';   // ← ADD THIS LINE

  const [letters, setLetters] = useState([]);
  const [aoOrders, setAoOrders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [exitStatus, setExitStatus] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  // const [showEdit, setShowEdit] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateConf, setDeactivateConf] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    setLoadingData(true);
    Promise.allSettled([
      axios.get(`/api/letters/?employee_id=${emp._id}&include_relieving=true`),
      axios.get(`/api/appointment-orders/?employee_id=${emp._id}`),
      axios.get(`/api/documents/by-employee/${emp._id}`).catch(() => ({ data: { docs: [], submission: null } })),
    ]).then(([lRes, aoRes, docRes]) => {
      setLetters(lRes.status === 'fulfilled' ? (lRes.value.data || []) : []);
      setAoOrders(aoRes.status === 'fulfilled' ? (aoRes.value.data || []) : []);
      // documents endpoint returns { docs: [...], submission: {...}, doc_count: N }
      const docData = docRes.status === 'fulfilled' ? (docRes.value.data || {}) : {};
      setDocuments(docData.docs || []);
    }).finally(() => setLoadingData(false));

    // Fetch exit status for employees in exit pipeline
    if (['exited', 'resignation_pending', 'notice_period', 'clearance_pending', 'clearance_complete'].includes(emp.status)) {
      axios.get('/api/exit/').then(r => {
        const found = (r.data || []).find(e => e._id === emp._id);
        if (found) setExitStatus(found);
      }).catch(() => { });
    }
  }, [emp._id]);

  const deactivate = async () => {
    setDeactivating(true); setError('');
    try {
      await axios.post(`/api/employees/${emp._id}/deactivate`);
      setSuccess('Employee deactivated successfully.');
      setDeactivateConf(false);
      onRefresh();
      setTimeout(() => onClose(), 1500);
    } catch (e) {
      setError(e.response?.data?.error || 'Deactivation failed');
    } finally { setDeactivating(false); }
  };

  const activate = async () => {
    setError(''); setSuccess('');
    try {
      await axios.post(`/api/employees/${emp._id}/activate`);
      setSuccess('Employee account activated successfully.');
      onRefresh();
      setTimeout(() => onClose(), 1500);
    } catch (e) {
      setError(e.response?.data?.error || 'Activation failed');
    }
  };

  const deleteEmp = async () => {
    setError('');
    try {
      await axios.delete(`/api/employees/${emp._id}`);
      onRefresh();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Delete failed');
      setShowDelete(false);
    }
  };

  const download = async (letterId, fmt, name) => {
    try {
      const r = await axios.get(`/api/letters/${letterId}/download?format=${fmt}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url; a.download = `${name}.${fmt}`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Download failed'); }
  };

  const preview = async (letterId) => {
    try {
      const r = await axios.get(`/api/letters/${letterId}/download?format=pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { alert('Preview failed'); }
  };

  const downloadAO = async (aoId, fmt, ref) => {
    try {
      const r = await axios.get(`/api/appointment-orders/${aoId}/download?format=${fmt}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url; a.download = `${ref}.${fmt}`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Download failed'); }
  };

  const previewLetter = async (letterId) => {
    try {
      const r = await axios.get(`/api/letters/${letterId}/download?format=pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch { alert('Preview failed'); }
  };

  const previewAO = async (aoId) => {
    try {
      const r = await axios.get(`/api/appointment-orders/${aoId}/download?format=pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch { alert('Preview failed'); }
  };

  const offerLetters = letters.filter(l => l.letter_type === 'offer');
  const relievingLetter = letters.find(l => l.letter_type === 'relieving');
  const isExited = emp.status === 'exited';
  const canDeactivate = canManage && isExited && relievingLetter;

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'letters', label: `Offer Letters (${offerLetters.length})` },
    { key: 'appointments', label: `Appointment (${aoOrders.length})` },
    { key: 'documents', label: `Documents (${documents.length})` },
    { key: 'exit', label: 'Exit & Relieving' },
  ];

  const sb = STATUS_BADGE[emp.status] || { cls: 'badge-gray', label: emp.status };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 820, width: '97%', maxHeight: '94vh', overflowY: 'auto', padding: 0 }}
        onClick={e => e.stopPropagation()}>

        {/* ── Profile Header ── */}
        <div style={{ padding: '24px 28px 0', borderBottom: '1px solid var(--border)', background: emp.status === 'inactive' ? 'rgba(239,68,68,.04)' : 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
              {/* Avatar */}
              <div style={{ width: 60, height: 60, borderRadius: '50%', flexShrink: 0, background: isExited ? 'var(--surface-2)' : 'var(--accent)', color: isExited ? 'var(--text-dim)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22 }}>
                {emp.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{emp.name}</h2>
                  <span className={`badge ${sb.cls}`}>{sb.label}</span>
                  {emp.status === 'exited' && (
                    <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px' }}>LEFT</span>
                  )}
                  {emp.status === 'inactive' && (
                    <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, letterSpacing: 1.5, color: 'var(--red)', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 4, padding: '2px 6px' }}>DEACTIVATED</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
                  {emp.designation}{emp.department ? ` · ${emp.department}` : ''}
                  <span style={{ fontFamily: 'var(--mono)', marginLeft: 8, fontSize: 12 }}>{emp.employee_id}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {canAdmin && (
                <button className="btn btn-secondary btn-sm" style={{ fontSize: 12 }} onClick={async () => {
                  try {
                    const { data } = await axios.get(`/api/employees/${emp._id}`);
                    onEdit(data);
                  } catch {
                    onEdit(emp);
                  }
                }}>✎ Edit</button>
              )}

              {canAdmin && (
                <button
                  className="btn btn-sm"
                  style={{ fontSize: 12, color: 'var(--red)', borderColor: 'rgba(239,68,68,.3)', background: 'transparent' }}
                  onClick={() => setShowDelete(true)}
                >
                  🗑 Delete
                </button>
              )}
              {canDeactivate && !deactivateConf && (
                <button className="btn btn-sm" style={{ fontSize: 12, background: 'var(--red)', borderColor: 'var(--red)', color: '#fff' }}
                  onClick={() => setDeactivateConf(true)}>
                  ⊘ Deactivate Account
                </button>
              )}

              {emp.status === 'inactive' && canManage && (
                <button
                  className="btn btn-sm btn-primary"
                  style={{ fontSize: 11 }}
                  onClick={activate}
                >
                  ✓ Activate Account
                </button>
              )}
              <button className="btn-icon" onClick={onClose} style={{ fontSize: 18 }}>✕</button>
            </div>

          </div>
          {showDelete && (
            <div style={{ width: '100%', marginTop: 12, padding: '12px 16px', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: error ? 10 : 0 }}>
                <span style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>⚠ Delete this employee record permanently?</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setShowDelete(false); setError(''); }}>Cancel</button>
                  <button className="btn btn-sm" style={{ background: 'var(--red)', color: '#fff', borderColor: 'var(--red)' }} onClick={deleteEmp}>Confirm Delete</button>
                </div>
              </div>
              {error && <div className="alert alert-error" style={{ marginBottom: 0, fontSize: 12 }}>{error}</div>}
            </div>
          )}
          {/* Deactivate confirm inline banner */}
          {deactivateConf && (
            <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>⚠ Deactivate this employee account?</div>
              <div style={{ color: 'var(--text-dim)', marginBottom: 12 }}>
                The employee's login access will be disabled. All records (letters, documents, appointment orders) are retained permanently.
              </div>
              {error && <div className="alert alert-error" style={{ marginBottom: 10 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setDeactivateConf(false)}>Cancel</button>
                <button className="btn btn-sm" style={{ background: 'var(--red)', borderColor: 'var(--red)', color: '#fff', fontSize: 12 }}
                  onClick={deactivate} disabled={deactivating}>
                  {deactivating ? 'Deactivating…' : '⊘ Confirm Deactivation'}
                </button>
              </div>
            </div>
          )}

          {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success}</div>}

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 0 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                style={{ padding: '8px 14px', fontSize: 12, fontWeight: activeTab === t.key ? 700 : 500, color: activeTab === t.key ? 'var(--accent)' : 'var(--text-dim)', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === t.key ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {/* {emp.assigned_manager && (
          <>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Assigned Manager</div>
              <div style={{ fontSize: 14 }}>{emp.assigned_manager}</div>
            </div>
            {emp.manager_email && (
              <div>
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Manager Email</div>
                <div style={{ fontSize: 14 }}>{emp.manager_email}</div>
              </div>
            )}
          </>
        )} */}

        {/* ── Tab Content ── */}
        <div style={{ padding: '20px 28px 28px' }}>

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 28px' }}>
                <InfoRow label="Full Name" value={emp.name} />
                <InfoRow label="Employee ID" value={emp.employee_id} />
                <InfoRow label="Designation" value={emp.designation} />
                <InfoRow label="Department" value={emp.department} />
                <InfoRow label="Email" value={emp.email} />
                <InfoRow label="Phone" value={emp.phone} />
                <InfoRow label="CTC" value={emp.ctc ? `₹${emp.ctc}` : null} />
                <InfoRow label="Joining Date" value={fmtDate(emp.joining_date)} />
                <InfoRow label="Notice Period" value={emp.notice_period ? `${emp.notice_period} days` : null} />
                <InfoRow label="Probation" value={emp.probation_period ? `${emp.probation_period} months` : null} />
                <InfoRow label="Date of Birth" value={emp.date_of_birth ? fmtDate(emp.date_of_birth) : null} />
                <InfoRow label="Father's Name" value={emp.father_name} />
                <InfoRow label="Address" value={emp.address} />
                <InfoRow label="Work Location" value={emp.work_location} />
                <InfoRow label="Assigned Manager" value={emp.assigned_manager} />
                <InfoRow label="Manager Email" value={emp.manager_email} />
              </div>

              {/* Step 1 self-reported data */}
              {emp.step1_data && Object.keys(emp.step1_data).length > 0 && (() => {
                const s = emp.step1_data;
                const rows = [
                  ['Aadhaar Number', s.aadhaar_number ? '****' + s.aadhaar_number.replace(/\s/g, '').slice(-4) : null],
                  ['PAN Number', s.pan_number],
                  ['Mobile Number', s.phone],
                  ['Date of Birth', s.dob ? fmtDate(s.dob) : null],
                  ['10th Marks / Percentage', s.degree_10_marks],
                  ['12th Marks / Percentage', s.degree_12_marks],
                  ['Graduation Marks / CGPA', s.graduation_marks],
                  ['Post Graduation Marks / CGPA', s.postgrad_marks],
                  ['Bank Name', s.bank_name],
                  ['Bank Account Number', s.account_number],
                  ['IFSC Code', s.ifsc_code],
                  ['Permanent Address', s.address],
                ].filter(([, v]) => v);
                return (
                  <>
                    <SectionHeader title="Personal Details (Self-Reported)" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 28px' }}>
                      {rows.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}
                    </div>
                  </>
                );
              })()}

              {/* Quick stats */}
              <SectionHeader title="Record Summary" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {[
                  ['Offer Letters', offerLetters.length, 'var(--accent)'],
                  ['Appointment Ord.', aoOrders.length, 'var(--amber)'],
                  ['Documents', documents.length, 'var(--green)'],
                  ['Relieving Letter', relievingLetter ? 1 : 0, 'var(--text-dim)'],
                ].map(([label, count, color]) => (
                  <div key={label} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color }}>{count}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── OFFER LETTERS ── */}
          {activeTab === 'letters' && (
            <div>
              {loadingData ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Loading…</div>
                : offerLetters.length === 0 ? (
                  <div className="empty-state"><div style={{ fontSize: 36 }}>📄</div><div>No offer letters found</div></div>
                ) : offerLetters.map(l => (
                  <div key={l._id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>
                            {l.letter_subtype === 'revised' ? 'Revised Offer Letter' : 'Offer Letter'}
                          </span>
                          <Badge status={l.status} map={LETTER_STATUS} />
                          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>v{l.version}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                          {l.context?.designation && <span>{l.context.designation}</span>}
                          {l.context?.ctc && <span>CTC: ₹{l.context.ctc}</span>}
                          {l.context?.joining_date && <span>Joining: {fmtDate(l.context.joining_date)}</span>}
                          <span>Created: {fmtDate(l.created_at)}</span>
                        </div>
                      </div>
                      {!['rejected', 'withdrawn'].includes(l.status) && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }} onClick={() => previewLetter(l._id)}>⬡ Preview</button>
                          <button className="btn btn-sm btn-primary" style={{ fontSize: 11 }} onClick={() => download(l._id, 'pdf', `${emp.employee_id}_offer_v${l.version}`)}>↓ PDF</button>
                          <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }} onClick={() => download(l._id, 'docx', `${emp.employee_id}_offer_v${l.version}`)}>↓ DOCX</button>
                        </div>

                      )}
                    </div>
                    {/* Wage breakdown if available */}
                    {l.breakdown && Object.keys(l.breakdown).length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, fontSize: 12 }}>
                        {[['Basic', l.breakdown.basic], ['HRA', l.breakdown.hra], ['DA', l.breakdown.da], ['PF', l.breakdown.employer_pf]].map(([k, v]) => v ? (
                          <div key={k}>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{k}</div>
                            <div style={{ fontWeight: 500 }}>₹{v}</div>
                          </div>
                        ) : null)}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* ── APPOINTMENT ORDERS ── */}
          {activeTab === 'appointments' && (
            <div>
              {loadingData ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Loading…</div>
                : aoOrders.length === 0 ? (
                  <div className="empty-state"><div style={{ fontSize: 36 }}>📋</div><div>No appointment orders found</div></div>
                ) : aoOrders.map(ao => {
                  const d = ao.details || {};
                  return (
                    <div key={ao._id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>Form Q — Appointment Order</span>
                            <Badge status={ao.status} map={LETTER_STATUS} />
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>{ao.reference_number}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                            {d.designation && <span>{d.designation}</span>}
                            {d.date_of_joining && <span>Joining: {fmtDate(d.date_of_joining)}</span>}
                            {d.wage_total && <span>Total Wage: ₹{d.wage_total}</span>}
                            <span>Submitted: {fmtDate(ao.created_at)}</span>
                          </div>
                          {/* Rejection reason */}
                          {ao.status === 'rejected' && (() => {
                            const r = (ao.approval_history || []).slice().reverse().find(h => h.action === 'reject');
                            return r?.remarks ? (
                              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)', background: 'rgba(239,68,68,.07)', padding: '6px 10px', borderRadius: 6 }}>✗ {r.remarks}</div>
                            ) : null;
                          })()}
                        </div>
                        {ao.status === 'approved' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }} onClick={() => previewAO(ao._id)}>⬡ Preview</button>
                            <button className="btn btn-sm btn-primary" style={{ fontSize: 11 }} onClick={() => downloadAO(ao._id, 'pdf', ao.reference_number)}>↓ PDF</button>
                            <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }} onClick={() => downloadAO(ao._id, 'docx', ao.reference_number)}>↓ DOCX</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {activeTab === 'documents' && (
            <div>
              {loadingData ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Loading…</div>
                : documents.length === 0 ? (
                  <div className="empty-state"><div style={{ fontSize: 36 }}>🗂</div><div>No documents uploaded yet</div></div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {documents.map(doc => {
                        const DOC_LABELS = {
                          photo: 'Passport Photo', aadhaar: 'Aadhaar Card', pan: 'PAN Card',
                          resume: 'Resume / CV', degree: '10th Certificate', degree_12: '12th Certificate',
                          graduation: 'Graduation Certificate', postgrad: 'Post Graduation',
                          experience: 'Experience Letter', relieving: 'Relieving Letter',
                          bank_passbook: 'Bank Passbook', offer_letter: 'Previous Offer Letter',
                        };
                        return (
                          <div key={doc._id} style={{ background: 'var(--surface-2)', border: '1px solid rgba(63,207,142,0.3)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>
                                {DOC_LABELS[doc.doc_type] || doc.doc_type || 'Document'}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--green)' }}>✓ {doc.filename || 'Uploaded'}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                                {fmtDate(doc.uploaded_at)}
                              </div>
                            </div>
                            {doc.url && (
                              <button className="btn btn-sm btn-secondary" style={{ fontSize: 11, flexShrink: 0 }}
                                onClick={async () => {
                                  try {
                                    const r = await axios.get(doc.url, { responseType: 'blob' });
                                    window.open(URL.createObjectURL(r.data), '_blank');
                                  } catch { alert('Could not open file.'); }
                                }}>View</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
            </div>
          )}

          {/* ── EXIT & RELIEVING ── */}
          {activeTab === 'exit' && (
            <div>
              {!['resignation_pending', 'notice_period', 'clearance_pending', 'clearance_complete', 'exited'].includes(emp.status) ? (
                <div className="empty-state"><div style={{ fontSize: 36 }}>📋</div><div>No exit process started</div><div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>Employee is currently active.</div></div>
              ) : (
                <>
                  {/* Exit details */}
                  <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 24px' }}>
                      <InfoRow label="Exit Status" value={STATUS_BADGE[emp.status]?.label} />
                      <InfoRow label="Resignation Date" value={fmtDate(emp.resignation_date)} />
                      <InfoRow label="Last Working Day" value={fmtDate(emp.last_working_day)} />
                      <InfoRow label="Exit Reason" value={emp.exit_reason} />
                    </div>
                  </div>

                  {/* Clearances */}
                  {emp.clearances && (
                    <>
                      <SectionHeader title="Department Clearances" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                        {[
                          { key: 'it_assets', label: 'IT Assets', icon: '⬡' },
                          { key: 'finance', label: 'Finance', icon: '◈' },
                          { key: 'admin', label: 'Admin', icon: '▦' },
                          { key: 'hr_docs', label: 'HR Docs', icon: '◉' },
                          { key: 'access_cards', label: 'Access Cards', icon: '◎' },
                        ].map(item => {
                          const ok = emp.clearances[item.key];
                          return (
                            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: ok ? 'var(--green-dim)' : 'var(--surface-2)', border: `1px solid ${ok ? 'rgba(63,207,142,.2)' : 'var(--border)'}` }}>
                              <span style={{ fontSize: 14, opacity: .6 }}>{item.icon}</span>
                              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: ok ? 'var(--green)' : 'var(--text)' }}>{item.label}</span>
                              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 20, background: ok ? 'rgba(63,207,142,.15)' : 'var(--border)', color: ok ? 'var(--green)' : 'var(--text-dim)' }}>
                                {ok ? 'CLEARED' : 'PENDING'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Relieving letter */}
                  <SectionHeader title="Relieving Letter" />
                  {relievingLetter ? (
                    <div style={{ background: 'rgba(63,207,142,.07)', border: '1px solid rgba(63,207,142,.2)', borderRadius: 10, padding: '16px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>✓ Relieving Letter Issued</div>
                          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Generated: {fmtDate(relievingLetter.created_at)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }}
                            onClick={() => preview(relievingLetter._id)}>👁 Preview</button>
                          <button className="btn btn-sm btn-primary" style={{ fontSize: 11 }}
                            onClick={() => download(relievingLetter._id, 'pdf', `${emp.employee_id}_relieving`)}>⬇ PDF</button>
                          <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }}
                            onClick={() => download(relievingLetter._id, 'docx', `${emp.employee_id}_relieving`)}>⬇ DOCX</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px 18px', fontSize: 13, color: 'var(--text-dim)' }}>
                      {emp.status === 'exited'
                        ? 'Relieving letter not found in system.'
                        : 'Relieving letter will be generated once all clearances are confirmed.'}
                    </div>
                  )}

                  {/* Deactivate section */}
                  {canDeactivate && (
                    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                      <SectionHeader title="Account Management" />
                      <div style={{ background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 10, padding: '16px 18px' }}>
                        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
                          The relieving letter has been issued. You can now deactivate this employee's login account.
                          All historical records are permanently retained.
                        </div>
                        {!deactivateConf ? (
                          <button className="btn btn-sm" style={{ background: 'var(--red)', borderColor: 'var(--red)', color: '#fff', fontSize: 12 }}
                            onClick={() => setDeactivateConf(true)}>⊘ Deactivate Employee Account</button>
                        ) : (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--red)', marginBottom: 8, fontSize: 13 }}>Are you sure? This cannot be undone.</div>
                            {error && <div className="alert alert-error" style={{ marginBottom: 8 }}>{error}</div>}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => setDeactivateConf(false)}>Cancel</button>
                              <button className="btn btn-sm" style={{ background: 'var(--red)', borderColor: 'var(--red)', color: '#fff', fontSize: 12 }} onClick={deactivate} disabled={deactivating}>
                                {deactivating ? 'Deactivating…' : '⊘ Confirm Deactivation'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {emp.status === 'inactive' && canManage && (
                    <div style={{ marginTop: 24 }}>
                      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                        Account Management
                      </div>
                      <div style={{ padding: '16px 20px', background: 'rgba(37,99,235,.05)', border: '1px solid rgba(37,99,235,.2)', borderRadius: 10 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
                          This employee's account is deactivated. You can restore login access by activating their account.
                        </div>
                        {error && <div className="alert alert-error" style={{ marginBottom: 8 }}>{error}</div>}
                        {success && <div className="alert alert-success" style={{ marginBottom: 8 }}>{success}</div>}
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: 12 }}
                          onClick={activate}
                        >
                          ✓ Activate Employee Account
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Employee Modal ──────────────────────────────────────────────────────

/** Normalise any date value to YYYY-MM-DD so <input type="date"> shows it.
 *  Handles: "2026-05-06", "2026-05-06T00:00:00.000Z", "06-05-2026", "06/05/2026" */
function toInputDate(val) {
  if (!val) return '';
  const s = String(val).trim();
  // Already ISO date string YYYY-MM-DD (with optional time)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD-MM-YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // Fallback: let Date parse it
  try {
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  } catch { /* */ }
  return '';
}

function EditModal({ emp, onClose, onDone }) {
  const step1 = emp.step1_data || {};
  // letter_context is populated by the Edit button's fresh GET /api/employees/:id
  // which now returns the latest letter context via serialize()
  const ctx = emp.letter_context || {};
  const merged = {
    ...emp,
    email: emp.email || ctx.email || step1.email || step1.personal_email || emp.login_email || emp.work_email || '',
    department: emp.department || ctx.department || '',
    ctc: emp.ctc || ctx.ctc || '',
    joining_date: toInputDate(emp.joining_date || ctx.joining_date || step1.date_of_joining || ''),
    phone: emp.phone || step1.phone || '',
    date_of_birth: toInputDate(emp.date_of_birth || step1.dob || step1.date_of_birth || ''),
    address: emp.address || step1.address || step1.postal_address || step1.permanent_address || '',
  };
  const [form, setForm] = useState(merged);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [managers, setManagers] = useState([]);

  useEffect(() => {
    axios.get('/api/auth/users?role=manager')
      .then(r => setManagers(r.data))
      .catch(() => setManagers([]));
  }, []);

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await axios.put(`/api/employees/${emp._id}`, form);
      onDone('Employee updated.');
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="modal-title" style={{ margin: 0 }}>Edit Employee</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Designation *</label>
              <input required value={form.designation || ''} onChange={e => setForm({ ...form, designation: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input value={form.department || ''} onChange={e => setForm({ ...form, department: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">CTC</label>
              <input value={form.ctc || ''} onChange={e => setForm({ ...form, ctc: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Joining Date</label>
              <input type="date" value={form.joining_date || ''} onChange={e => setForm({ ...form, joining_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input type="date" value={form.date_of_birth || ''} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea rows={2} value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Notice Period (days)</label>
              <input type="number" value={form.notice_period || '60'} onChange={e => setForm({ ...form, notice_period: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Probation (months)</label>
              <input type="number" value={form.probation_period || '6'} onChange={e => setForm({ ...form, probation_period: e.target.value })} />
            </div>
          </div>

          {/* Manager assignment */}
          <div className="form-group">
            <label className="form-label">Assigned Manager</label>
            {managers.length > 0 ? (
              <select
                value={form.assigned_manager_id || ''}
                onChange={e => {
                  const selected = managers.find(m => m._id === e.target.value);
                  setForm({
                    ...form,
                    assigned_manager_id: e.target.value,
                    assigned_manager: selected?.name || '',
                    manager_email: selected?.email || '',
                  });
                }}
              >
                <option value="">— No Manager —</option>
                {managers.map(m => (
                  <option key={m._id} value={m._id}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={form.assigned_manager || ''}
                onChange={e => setForm({ ...form, assigned_manager: e.target.value })}
                placeholder="Manager name"
              />
            )}
            {form.assigned_manager && (
              <small style={{ color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Current: {form.assigned_manager} {form.manager_email && `(${form.manager_email})`}
              </small>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Employee Modal ───────────────────────────────────────────────────────
function AddModal({ onClose, onDone }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await axios.post('/api/employees/', form);
      onDone('Employee created.');
    } catch (err) {
      setError(err.response?.data?.error || 'Creation failed');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="modal-title" style={{ margin: 0 }}>Add Employee</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Designation *</label>
              <input required value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">CTC</label>
              <input value={form.ctc} onChange={e => setForm({ ...form, ctc: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Joining Date</label>
              <input type="date" value={form.joining_date} onChange={e => setForm({ ...form, joining_date: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Notice Period (days)</label>
              <input type="number" value={form.notice_period} onChange={e => setForm({ ...form, notice_period: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Probation (months)</label>
              <input type="number" value={form.probation_period} onChange={e => setForm({ ...form, probation_period: e.target.value })} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create Employee'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main EmployeesPage ───────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { user } = useAuth();
  const canManage = ['admin', 'hr_head'].includes(user?.role);
  const canAdmin = user?.role === 'admin';   // ADD THIS

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilter] = useState('all');
  const [profileEmp, setProfileEmp] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [success, setSuccess] = useState('');

  const load = () => {
    setLoading(true);
    axios.get('/api/employees/').then(r => setEmployees(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const notify = (msg) => { setSuccess(msg); load(); setTimeout(() => setSuccess(''), 3000); };

  const counts = useMemo(() => ({
    all: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    exiting: employees.filter(e => ['resignation_pending', 'notice_period', 'clearance_pending', 'clearance_complete'].includes(e.status)).length,
    exited: employees.filter(e => e.status === 'exited').length,
    inactive: employees.filter(e => e.status === 'inactive').length,
  }), [employees]);

  const filtered = useMemo(() => {
    let list = employees;
    if (filterStatus !== 'all') {
      if (filterStatus === 'exiting') {
        list = list.filter(e => ['resignation_pending', 'notice_period', 'clearance_pending', 'clearance_complete'].includes(e.status));
      } else {
        list = list.filter(e => e.status === filterStatus);
      }
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.name?.toLowerCase().includes(q) ||
        e.employee_id?.toLowerCase().includes(q) ||
        e.designation?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [employees, filterStatus, search]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">{counts.all} total · {counts.active} active{counts.exiting > 0 ? ` · ${counts.exiting} exiting` : ''}{counts.exited > 0 ? ` · ${counts.exited} left` : ''}</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Employee</button>
        )}
      </div>

      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search name, ID, designation…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            ['all', `All (${counts.all})`],
            ['active', `Active (${counts.active})`],
            ['exiting', `Exiting (${counts.exiting})`],
            ['exited', `Exited (${counts.exited})`],
            ['inactive', `Inactive (${counts.inactive})`],
          ].map(([key, label]) => (
            <button key={key}
              className={`btn btn-sm ${filterStatus === key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(key)} style={{ fontSize: 12 }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 44, marginBottom: 10 }}>👥</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No employees found</div>
          {canManage && filterStatus === 'all' && !search && (
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>Click <strong>+ Add Employee</strong> to get started.</div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {filtered.map(emp => (
            <EmployeeCard key={emp._id} emp={emp} onClick={() => setProfileEmp(emp)} />
          ))}
        </div>
      )}

      {/* Modals */}
      {profileEmp && (
        <EmployeeProfile
          emp={profileEmp}
          onClose={() => setProfileEmp(null)}
          onRefresh={() => { load(); setProfileEmp(null); }}
          onEdit={(emp) => { setProfileEmp(null); setEditEmp(emp); }}
        />
      )}

      {showAdd && (
        <AddModal onClose={() => setShowAdd(false)} onDone={(msg) => { setShowAdd(false); notify(msg); }} />
      )}

      {editEmp && (
        <EditModal emp={editEmp} onClose={() => setEditEmp(null)} onDone={(msg) => { setEditEmp(null); notify(msg); }} />
      )}
    </div>
  );
}