import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { HRHeadPanel } from './LettersPage';

const STATUS_CFG = {
  pending_manager: { label: 'Pending Manager', cls: 'badge-amber' },
  pending_hr_head: { label: 'Pending HR Head', cls: 'badge-amber' },
  approved: { label: 'Approved', cls: 'badge-green' },
  rejected: { label: 'Rejected', cls: 'badge-red' },
  issued: { label: 'Issued', cls: 'badge-green' },
  withdrawn: { label: 'Withdrawn', cls: 'badge-red' },
};

const DOC_TYPES = [
  { key: 'photo', label: 'Passport Photo', required: true },
  { key: 'aadhaar', label: 'Aadhaar Card', required: true },
  { key: 'pan', label: 'PAN Card', required: true },
  { key: 'resume', label: 'Resume / CV', required: true },
  { key: 'degree', label: '10th Certificate', required: true },
  { key: 'degree_12', label: '12th Certificate', required: true },
  { key: 'graduation', label: 'Graduation Certificate', required: false },
  { key: 'postgrad', label: 'Post Graduation', required: false },
  { key: 'experience', label: 'Experience Letter', required: false },
  { key: 'relieving', label: 'Relieving Letter', required: false },
  { key: 'bank_passbook', label: 'Bank Passbook / Cheque', required: true },
  { key: 'offer_letter', label: 'Previous Offer Letter', required: false },
];

// ─── Offer Letter Row ─────────────────────────────────────────────────────────

function LetterRow({ l, onReview, onPreview, canAct }) {
  const cfg = STATUS_CFG[l.status] || {};
  const [downloading, setDownloading] = useState(false);

  const downloadDocx = async () => {
    setDownloading(true);
    try {
      const res = await axios.get(`/api/letters/${l._id}/download?format=docx`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${l.employee_code || l.employee_name}_offer_v${l.version || 1}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Could not download DOCX.'); }
    finally { setDownloading(false); }
  };

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
              {h.user_name || h.role}{" → "}{h.action}
            </div>
          ))}
          {!(l.approval_history?.length) && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>No history</span>}
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-secondary"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: 11 }}
            onClick={() => onPreview(l)}>
            ◈ Preview
          </button>
          <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }}
            onClick={downloadDocx} disabled={downloading}>
            {downloading ? '…' : '↓ DOCX'}
          </button>
          {canAct
            ? <button className="btn btn-sm btn-primary" style={{ fontSize: 11 }} onClick={() => onReview(l)}>◎ Review</button>
            : <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Not your stage</span>
          }
        </div>
      </td>
    </tr>
  );
}

// ─── Letter Preview Modal ──────────────────────────────────────────────────────

function LetterPreviewModal({ letter, onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true); setError('');
    axios.get(`/api/letters/${letter._id}/preview-pdf`, { responseType: 'blob' })
      .then(r => {
        const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
        setPdfUrl(url);
      })
      .catch(() => setError('Could not load document preview.'))
      .finally(() => setLoading(false));
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  }, [letter._id]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 780, width: '96%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Offer Letter Preview</div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{letter.employee_name}</h2>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
              {letter.employee_code} · v{letter.version || 1} · <span className={`badge ${STATUS_CFG[letter.status]?.cls}`}>{STATUS_CFG[letter.status]?.label}</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {loading && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: 'var(--text-dim)', fontSize: 13 }}><div className="spinner" style={{ marginRight: 10 }} /> Generating preview…</div>}
          {error && !loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--red)', fontSize: 13 }}>⚠ {error}</div>}
          {pdfUrl && !loading && <iframe src={pdfUrl} style={{ width: '100%', height: '560px', border: 'none', borderRadius: 8 }} title="Offer Letter Preview" />}
        </div>
        <div style={{ flexShrink: 0, marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Appointment Order Row ────────────────────────────────────────────────────

function AORow({ ao, onReview, canAct }) {
  const d = ao.details || {};
  return (
    <tr>
      <td>
        <div style={{ fontWeight: 500 }}>{ao.employee_name || d.employee_name || '—'}</div>
        <div className="mono text-muted text-sm">{d.register_serial_no || ao.employee_code}</div>
      </td>
      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.designation || '—'}</td>
      <td><span className="badge badge-amber">Pending HR Head</span></td>
      <td className="mono text-muted text-sm">{new Date(ao.created_at).toLocaleDateString('en-IN')}</td>
      <td style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>{ao.reference_number}</td>
      <td>
        {canAct
          ? <button className="btn btn-sm btn-primary" onClick={() => onReview(ao)}>Review</button>
          : <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Not your stage</span>
        }
      </td>
    </tr>
  );
}

// ─── Form Q Preview ───────────────────────────────────────────────────────────

const FORM_Q_ROWS = [
  { sl: '1', part: 'Name And Address of The Establishment', key: 'establishment_name' },
  { sl: '2', part: 'Name And Address of The Employer', key: 'employer_name' },
  { sl: '3', part: 'Name of The Employee', key: 'employee_name' },
  { sl: '4', part: 'Postal Address of The Employee', key: 'postal_address' },
  { sl: '5', part: 'Permanent Address of The Employee', key: 'permanent_address' },
  { sl: '6', part: "Father's / Husband's Name", key: 'guardian_name' },
  { sl: '7', part: 'Date of Birth', key: 'date_of_birth', date: true },
  { sl: '8', part: 'Date of Entry into Employment', key: 'date_of_joining', date: true },
  { sl: '9', part: 'Designation', key: 'designation' },
  { sl: '10', part: 'Nature of Work Entrusted', key: 'nature_of_work' },
  { sl: '11', part: 'Serial Number in The Register of Employment', key: 'register_serial_no' },
  { sl: '12', part: 'Rates of Wages Payable', key: '__wages__', wages: true },
];

const AO_CSS = `
  .fq-tbl { width:100%; border-collapse:collapse; font-size:13px; }
  .fq-tbl td { padding:9px 13px; border:1px solid var(--border); vertical-align:top; line-height:1.55; }
  .fq-tbl .fq-h td { background:var(--surface-2); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:var(--text-dim); }
  .fq-tbl .fq-sl { width:34px; text-align:center; font-family:monospace; font-size:11px; color:var(--text-dim); }
  .fq-tbl .fq-p  { width:36%; font-size:12px; color:var(--text-dim); }
  .fq-tbl .fq-v  { font-weight:500; white-space:pre-wrap; word-break:break-word; }
  .fq-tbl .fq-empty { color:var(--text-dim); font-style:italic; font-weight:400; opacity:.5; }
`;

function fmtD(d) {
  if (!d) return '—';
  try { const [y, m, day] = d.split('-'); return `${day}-${m}-${y}`; } catch { return d; }
}

function FormQPreview({ fields }) {
  const d = fields || {};
  const wages = [
    d.wage_basic && `I) Basic: ₹${d.wage_basic}`,
    d.wage_vda && `II) VDA: ₹${d.wage_vda}`,
    d.wage_other_allowances && `III) Other Allowances: ₹${d.wage_other_allowances}`,
    d.wage_total && `Total: ₹${d.wage_total}`,
  ].filter(Boolean).join('\n');

  return (
    <>
      <style>{AO_CSS}</style>
      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ textAlign: 'center', padding: '12px 16px 8px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: .5 }}>Form 'Q'</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>[See Rule 24(9-A)] · Appointment Order</div>
        </div>
        <table className="fq-tbl"><tbody>
          <tr className="fq-h"><td className="fq-sl">Sl.</td><td className="fq-p">Particulars</td><td>Details</td></tr>
          {FORM_Q_ROWS.map(row => {
            let val = row.wages ? wages : (row.date ? fmtD(d[row.key]) : d[row.key] || '');
            return (
              <tr key={row.sl}>
                <td className="fq-sl">{row.sl}</td>
                <td className="fq-p">{row.part}</td>
                <td className={`fq-v${!val ? ' fq-empty' : ''}`}>{val || '—'}</td>
              </tr>
            );
          })}
        </tbody></table>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid var(--border)', fontSize: 13 }}>
          <div style={{ padding: '9px 13px', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 3 }}>Place</div>
            <div style={{ fontWeight: 500 }}>{d.place || '—'}</div>
          </div>
          <div style={{ padding: '9px 13px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 3 }}>Date</div>
            <div style={{ fontWeight: 500 }}>{d.date ? fmtD(d.date) : new Date().toLocaleDateString('en-IN')}</div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Appointment Order Review Modal ──────────────────────────────────────────

function AOReviewModal({ ao, onClose, onDone }) {
  const [tab, setTab] = useState('preview');
  const [action, setAction] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoad] = useState(true);
  const [pdfError, setPdfError] = useState('');
  const d = ao.details || {};

  useEffect(() => {
    setPdfLoad(true); setPdfError('');
    axios.get(`/api/appointment-orders/${ao._id}/preview`, { responseType: 'blob' })
      .then(r => { const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' })); setPdfUrl(url); })
      .catch(() => setPdfError('Could not load document preview.'))
      .finally(() => setPdfLoad(false));
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  }, [ao._id]);

  const submit = async () => {
    if (action === 'reject' && !remarks.trim()) { setError('Rejection reason is required'); return; }
    setLoading(true); setError('');
    try {
      await axios.post(`/api/appointment-orders/${ao._id}/hr-action`, { action, remarks });
      onDone(action);
    } catch (e) {
      setError(e.response?.data?.error || 'Action failed');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700, width: '96%', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Form Q · HR Head Review</div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Appointment Order</h2>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{ao.employee_name || d.employee_name || '—'}</span>
              <span>·</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{ao.reference_number}</span>
              <span>·</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 20, background: 'rgba(245,166,35,.15)', color: 'var(--amber)' }}>Pending HR Head</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, width: 'fit-content' }}>
          {[['preview', '📋 Form Preview'], ['action', '⚖ Approve / Reject']].map(([k, lbl]) => (
            <button key={k} className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab(k)} style={{ fontSize: 12 }}>{lbl}</button>
          ))}
        </div>

        {tab === 'preview' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {pdfLoading && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13 }}><div className="spinner" style={{ marginRight: 10 }} /> Generating document preview…</div>}
            {pdfError && !pdfLoading && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--red)', fontSize: 13 }}>
                ⚠ {pdfError}
                <div style={{ marginTop: 12 }}><button className="btn btn-secondary btn-sm" onClick={() => setTab('action')}>Continue to Approve / Reject</button></div>
              </div>
            )}
            {pdfUrl && !pdfLoading && (
              <>
                <iframe src={pdfUrl} style={{ flex: 1, width: '100%', border: 'none', borderRadius: 8, minHeight: 520 }} title="Appointment Order Preview" />
                <div style={{ marginTop: 12, flexShrink: 0 }}>
                  <button className="btn btn-primary" onClick={() => setTab('action')} style={{ width: '100%' }}>Proceed to Approve / Reject →</button>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'action' && (
          <div style={{ overflowY: 'auto' }}>
            <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px 18px', marginBottom: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 20px', fontSize: 13 }}>
                {[
                  ['Employee', ao.employee_name || d.employee_name],
                  ['Designation', d.designation],
                  ['Joining', d.date_of_joining ? fmtD(d.date_of_joining) : '—'],
                  ['Employee ID', d.register_serial_no],
                  ['Reference', ao.reference_number],
                  ['Submitted', ao.created_at ? new Date(ao.created_at).toLocaleDateString('en-IN') : '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'var(--mono)', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontWeight: 500 }}>{v || '—'}</div>
                  </div>
                ))}
              </div>
              {(d.wage_basic || d.wage_total) && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', fontFamily: 'var(--mono)', color: 'var(--text-dim)', marginBottom: 8 }}>Wages</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, fontSize: 13 }}>
                    {[['Basic', d.wage_basic], ['VDA', d.wage_vda], ['Other', d.wage_other_allowances], ['Total', d.wage_total]].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{k}</div>
                        <div style={{ fontWeight: 600 }}>₹{v || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {['approve', 'reject'].map(a => (
                <button key={a}
                  className={`btn ${action === a ? (a === 'approve' ? 'btn-primary' : 'btn-danger') : 'btn-secondary'}`}
                  onClick={() => setAction(a)} style={{ flex: 1, padding: '11px 0' }}>
                  {a === 'approve' ? '✓ Approve' : '✗ Reject'}
                </button>
              ))}
            </div>

            {action && (
              <>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">
                    Remarks{action === 'reject' && <span style={{ color: 'var(--red)', fontSize: 10, marginLeft: 4 }}>(required)</span>}
                  </label>
                  <textarea className="form-input" value={remarks} onChange={e => setRemarks(e.target.value)} rows={3}
                    placeholder={action === 'reject' ? 'Explain why this is being rejected…' : 'Optional comments…'} />
                </div>
                <button
                  className={`btn ${action === 'approve' ? 'btn-primary' : 'btn-danger'}`}
                  onClick={submit} disabled={loading}
                  style={{ width: '100%', padding: '11px 0', ...(action === 'approve' ? { background: 'var(--green)', borderColor: 'var(--green)' } : {}) }}>
                  {loading ? 'Processing…' : action === 'approve' ? '✓ Confirm Approval' : '✗ Confirm Rejection'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Document Submission Review Modal ────────────────────────────────────────

function HRReviewModal({ submission, onClose, onDone }) {
  const [fullSub, setFullSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSub] = useState(false);
  const [error, setError] = useState('');
  const decisionRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/documents/submissions/${submission._id}`)
      .then(r => setFullSub(r.data))
      .catch(() => setError('Failed to load submission details.'))
      .finally(() => setLoading(false));
  }, [submission._id]);

  const viewDoc = async (url) => {
    try {
      const r = await axios.get(url, { responseType: 'blob' });
      window.open(URL.createObjectURL(r.data), '_blank');
    } catch { alert('Could not open file.'); }
  };

  const submit = async () => {
    if (action === 'reject' && !remarks.trim()) { setError('Remarks are required for rejection.'); return; }
    setSub(true); setError('');
    try {
      await axios.post(`/api/documents/submissions/${submission._id}/action`, { action, remarks });
      onDone(`Documents ${action === 'approve' ? 'approved' : 'rejected'} successfully.`);
    } catch (e) {
      setError(e.response?.data?.error || 'Action failed.');
      setSub(false);
    }
  };

  const isReadOnly = submission.status !== 'pending_hr';
  const docs = fullSub?.docs || [];
  const s = fullSub?.step1_data || {};
  const hasStep1 = Object.keys(s).length > 0;

  const step1Rows = [
    ['Full Name', s.full_name],
    ['Date of Birth', s.dob],
    ['Aadhaar Number', s.aadhaar_number ? '••••••••' + s.aadhaar_number.replace(/\s/g, '').slice(-4) : null],
    ['PAN Number', s.pan_number],
    ['Mobile Number', s.phone],
    ['Bank Name', s.bank_name],
    ['Account Number', s.account_number],
    ['IFSC Code', s.ifsc_code],
    ['10th Marks', s.degree_10_marks],
    ['12th Marks', s.degree_12_marks],
    ['Graduation Marks', s.graduation_marks],
    ['PG Marks', s.postgrad_marks],
  ].filter(([, v]) => v);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 760, width: '96%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Document Review</div>
            <h2 style={{ margin: 0, fontSize: 20 }}>{submission.employee_name}</h2>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
              {submission.employee_code} · Submitted {new Date(submission.submitted_at).toLocaleDateString('en-IN')}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Loading…</div>
          ) : (
            <>
              {/* ── Step 1: Personal Info — ALWAYS FIRST ── */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Step 1 — Personal Information
                </div>
                {!hasStep1 ? (
                  <div style={{ padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                    Employee has not submitted personal info yet.
                  </div>
                ) : (
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                      {step1Rows.map(([label, value]) => (
                        <div key={label}>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: ['PAN Number', 'IFSC Code', 'Account Number', 'Aadhaar Number'].includes(label) ? 'var(--mono)' : undefined }}>
                            {String(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                    {s.address && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 2 }}>Permanent Address</div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.5 }}>{s.address}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Step 2: Uploaded Documents ── */}
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Step 2 — Uploaded Documents ({docs.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {DOC_TYPES.map(dt => {
                  const doc = docs.find(d => d.doc_type === dt.key);
                  return (
                    <div key={dt.key} style={{
                      padding: '10px 14px', borderRadius: 8,
                      background: doc ? 'rgba(63,207,142,.06)' : 'var(--surface-2)',
                      border: `1px solid ${doc ? 'rgba(63,207,142,.25)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: doc ? 'var(--text)' : 'var(--text-dim)' }}>
                          {dt.label}
                          {dt.required && <span style={{ color: 'var(--red)', marginLeft: 3, fontSize: 10 }}>*</span>}
                        </div>
                        {doc
                          ? <div style={{ fontSize: 11, color: 'var(--green)' }}>✓ {doc.filename}</div>
                          : <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>Not uploaded</div>
                        }
                      </div>
                      {doc?.url && (
                        <button className="btn btn-sm btn-secondary" onClick={() => viewDoc(doc.url)} style={{ flexShrink: 0, fontSize: 11 }}>
                          Preview
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Previous rejection remarks */}
              {submission.status === 'rejected' && submission.remarks && (
                <div style={{ padding: '12px 16px', background: 'rgba(240,82,82,.06)', border: '1px solid rgba(240,82,82,.2)', borderRadius: 8, marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--red)', textTransform: 'uppercase', marginBottom: 4 }}>Previous Rejection Remarks</div>
                  <div style={{ fontSize: 13, lineHeight: 1.55 }}>{submission.remarks}</div>
                </div>
              )}

              {/* Decision */}
              {!isReadOnly && (
                <>
                  {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 10 }}>Decision</div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    {['approve', 'reject'].map(a => (
                      <button key={a}
                        className={`btn ${action === a ? (a === 'approve' ? 'btn-primary' : 'btn-danger') : 'btn-secondary'}`}
                        onClick={() => { setAction(a); setTimeout(() => decisionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
                        style={{ flex: 1, padding: '11px 0', ...(action === a && a === 'approve' ? { background: 'var(--green)', borderColor: 'var(--green)' } : {}) }}>
                        {a === 'approve' ? '✓ Approve All' : '✗ Reject & Request Changes'}
                      </button>
                    ))}
                  </div>
                  {action && (
                    <>
                      <div ref={decisionRef} className="form-group" style={{ marginBottom: 14 }}>
                        <label className="form-label">
                          {action === 'approve' ? 'Remarks (optional)' : 'What needs to be fixed?'}
                          {action === 'reject' && <span style={{ color: 'var(--red)', fontSize: 10, marginLeft: 4 }}>(required)</span>}
                        </label>
                        <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3}
                          placeholder={action === 'approve' ? 'Optional notes for the employee…' : 'Describe exactly which documents need to be replaced or corrected…'} />
                      </div>
                      <button
                        className={`btn ${action === 'approve' ? 'btn-primary' : 'btn-danger'}`}
                        onClick={submit} disabled={submitting}
                        style={{ width: '100%', padding: '12px 0', ...(action === 'approve' ? { background: 'var(--green)', borderColor: 'var(--green)' } : {}) }}>
                        {submitting ? 'Processing…' : action === 'approve' ? '✓ Confirm Approval' : '✗ Confirm Rejection'}
                      </button>
                    </>
                  )}
                </>
              )}

              {isReadOnly && (
                <div style={{
                  padding: '14px 18px', borderRadius: 8,
                  background: submission.status === 'approved' ? 'rgba(63,207,142,.06)' : 'rgba(240,82,82,.06)',
                  border: `1px solid ${submission.status === 'approved' ? 'rgba(63,207,142,.25)' : 'rgba(240,82,82,.25)'}`,
                }}>
                  <div style={{ fontWeight: 600, color: submission.status === 'approved' ? 'var(--green)' : 'var(--red)', marginBottom: 4 }}>
                    {submission.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                  </div>
                  {submission.remarks && <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>{submission.remarks}</div>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Resignation Modal ────────────────────────────────────────────────────────

function ResignationModal({ emp, onClose, onDone }) {
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const approve = async () => {
    setLoading(true); setError('');
    try { await axios.post(`/api/exit/${emp._id}/approve-resignation`); onDone('approved'); }
    catch (e) { setError(e.response?.data?.error || 'Failed'); setLoading(false); }
  };

  const reject = async () => {
    setLoading(true); setError('');
    try { await axios.post(`/api/exit/${emp._id}/reject-resignation`, { reason }); onDone('rejected'); }
    catch (e) { setError(e.response?.data?.error || 'Failed'); setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Resignation Approval</div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Review Resignation</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px 18px', marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: 13 }}>
            {[
              ['Employee', emp.name], ['Employee ID', emp.employee_id],
              ['Designation', emp.designation], ['Department', emp.department],
              ['Resignation Date', emp.resignation_date], ['Last Working Day', emp.last_working_day || 'Auto-calculated'],
              ['Exit Reason', emp.exit_reason || '—'],
            ].map(([k, v]) => v && (
              <div key={k} style={{ gridColumn: k === 'Exit Reason' ? '1 / -1' : undefined }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'var(--mono)', marginBottom: 2 }}>{k}</div>
                <div style={{ fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}
        {!rejectMode ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setRejectMode(true)}>✗ Reject</button>
            <button className="btn btn-primary" style={{ flex: 1, background: 'var(--green)', borderColor: 'var(--green)' }}
              onClick={approve} disabled={loading}>
              {loading ? 'Approving…' : '✓ Approve Resignation'}
            </button>
          </div>
        ) : (
          <>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Rejection Reason <span style={{ color: 'var(--red)', fontSize: 10 }}>(optional)</span></label>
              <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Explain the reason for rejection…" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setRejectMode(false)} disabled={loading}>← Back</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={reject} disabled={loading}>
                {loading ? 'Rejecting…' : '✗ Confirm Rejection'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main ApprovalsPage ───────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { user } = useAuth();
  const role = user?.role || '';
  const isHR = ['hr_head', 'admin', 'hr'].includes(role);
  const isMgr = ['manager', 'hr_head', 'admin'].includes(role);

  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [pendingAO, setPendingAO] = useState([]);
  const [pendingResign, setPendingResign] = useState([]);
  const [pendingDocs, setPendingDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [reviewingLetter, setReviewingLetter] = useState(null);
  const [previewingLetter, setPreviewingLetter] = useState(null);
  const [reviewingAO, setReviewingAO] = useState(null);
  const [reviewingResign, setReviewingResign] = useState(null);
  const [reviewingDoc, setReviewingDoc] = useState(null);
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState(isMgr && !isHR ? 'resignations' : role === 'hr' ? 'documents' : 'offer_pending');

  const load = () => {
    setLoading(true);
    Promise.all([
      axios.get('/api/approvals/pending').catch(() => ({ data: [] })),
      axios.get('/api/approvals/history').catch(() => ({ data: [] })),
      axios.get('/api/appointment-orders/').catch(() => ({ data: [] })),
      isMgr ? axios.get('/api/exit/pending-approvals').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      isHR ? axios.get('/api/documents/submissions?status=pending_hr').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    ]).then(([p, h, ao, resign, docs]) => {
      setPending(p.data || []);
      setHistory(h.data || []);
      setPendingAO((ao.data || []).filter(o => o.status === 'pending_hr_head'));
      setPendingResign(resign.data || []);
      setPendingDocs(docs.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const notify = (msg) => { setSuccess(msg); load(); setTimeout(() => setSuccess(''), 4000); };

  const canActOnLetter = (letter) => {
    const flow = { pending_manager: ['manager', 'admin'], pending_hr_head: ['hr_head', 'admin', 'hr'] };
    return !!flow[letter.status]?.includes(role);
  };

  const isHRHead = ['hr_head', 'admin'].includes(role);
  const isHROnly = role === 'hr';

  const TABS = [
    ...(isHRHead ? [
      { key: 'offer_pending', label: 'Pending', sub: 'Offer Letters', count: pending.length, alert: pending.length > 0 },
      { key: 'offer_history', label: 'History', sub: 'Offer Letters', count: history.length, alert: false },
      { key: 'appointments', label: 'Appointment Orders', sub: 'Pending Approval', count: pendingAO.length, alert: pendingAO.length > 0 },
      { key: 'documents', label: 'Document Approvals', sub: 'Pending Approval', count: pendingDocs.length, alert: pendingDocs.length > 0 },
    ] : []),
    ...(isHROnly ? [
      { key: 'documents', label: 'Document Approvals', sub: 'Pending Approval', count: pendingDocs.length, alert: pendingDocs.length > 0 },
    ] : []),
    ...(isMgr ? [
      { key: 'resignations', label: 'Resignations', sub: 'Pending Approval', count: pendingResign.length, alert: pendingResign.length > 0 },
    ] : []),
  ];

  const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-subtitle">{isHR ? 'Offer letters, appointment orders & resignations' : 'Resignation approvals for your team'}</p>
        </div>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '6px 14px', borderRadius: 'var(--radius)', color: 'var(--text-muted)' }}>
          Logged in as <span style={{ color: 'var(--accent)' }}>{role}</span>
        </div>
      </div>

      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
              border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              background: active ? 'var(--accent)' : 'var(--surface)',
              color: active ? '#fff' : 'var(--text)',
              fontWeight: 600, fontSize: 13, transition: 'all .15s',
              boxShadow: active ? '0 0 0 3px rgba(99,102,241,.18)' : 'none',
            }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{t.label}</div>
                <div style={{ fontSize: 10, opacity: active ? .8 : .5, fontWeight: 400, marginTop: 1 }}>{t.sub}</div>
              </div>
              <span style={{
                minWidth: 26, height: 26, borderRadius: 13, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 7px', fontSize: 12, fontWeight: 800,
                background: active ? 'rgba(255,255,255,.25)' : t.alert ? 'var(--amber)' : 'var(--surface-2)',
                color: active ? '#fff' : t.alert ? '#000' : 'var(--text-dim)',
              }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      <div className="card">
        {loading ? <div className="page-loading"><div className="spinner" /></div> : (
          <div className="table-wrap">

            {tab === 'offer_pending' && (
              <table>
                <thead><tr><th>Employee</th><th>Designation</th><th>Status</th><th>Submitted</th><th>Trail</th><th>Action</th></tr></thead>
                <tbody>
                  {pending.length === 0
                    ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">◎</div><p>No offer letters pending approval</p></div></td></tr>
                    : pending.map(l => <LetterRow key={l._id} l={l} onReview={setReviewingLetter} onPreview={setPreviewingLetter} canAct={canActOnLetter(l)} />)
                  }
                </tbody>
              </table>
            )}

            {tab === 'offer_history' && (
              <table>
                <thead><tr><th>Employee</th><th>Designation</th><th>Status</th><th>Submitted</th><th>Trail</th><th>Action</th></tr></thead>
                <tbody>
                  {history.length === 0
                    ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">◎</div><p>No approval history yet</p></div></td></tr>
                    : history.map(l => <LetterRow key={l._id} l={l} onReview={setReviewingLetter} onPreview={setPreviewingLetter} canAct={false} />)
                  }
                </tbody>
              </table>
            )}

            {tab === 'appointments' && (
              <table>
                <thead><tr><th>Employee</th><th>Designation</th><th>Status</th><th>Submitted</th><th>Reference</th><th>Action</th></tr></thead>
                <tbody>
                  {pendingAO.length === 0
                    ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">📋</div><p>No appointment orders pending approval</p></div></td></tr>
                    : pendingAO.map(ao => <AORow key={ao._id} ao={ao} onReview={setReviewingAO} canAct={isHR} />)
                  }
                </tbody>
              </table>
            )}

            {tab === 'documents' && (
              <table>
                <thead><tr><th>Employee</th><th>Submitted</th><th>Docs</th><th>Status</th><th>Remarks</th><th>Action</th></tr></thead>
                <tbody>
                  {pendingDocs.length === 0
                    ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">📄</div><p>No document submissions pending approval</p></div></td></tr>
                    : pendingDocs.map(sub => (
                      <tr key={sub._id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{sub.employee_name || '—'}</div>
                          <div className="mono text-muted text-sm">{sub.employee_code || ''}</div>
                        </td>
                        <td className="mono text-muted text-sm">{fmtDate(sub.submitted_at)}</td>
                        <td>{sub.docs?.length || 0} docs</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: 'rgba(245,166,35,.15)', color: 'var(--amber)', fontFamily: 'var(--mono)' }}>
                            Pending Review
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{sub.remarks || '—'}</td>
                        <td><button className="btn btn-sm btn-primary" onClick={() => setReviewingDoc(sub)}>Review</button></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            )}

            {tab === 'resignations' && (
              <table>
                <thead><tr><th>Employee</th><th>Designation</th><th>Resignation Date</th><th>Last Working Day</th><th>Reason</th><th>Action</th></tr></thead>
                <tbody>
                  {pendingResign.length === 0
                    ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">✓</div><p>No pending resignation approvals</p><p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>All resignation requests from your team have been reviewed.</p></div></td></tr>
                    : pendingResign.map(emp => (
                      <tr key={emp._id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{emp.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{emp.employee_id}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13 }}>{emp.designation}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{emp.department}</div>
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtDate(emp.resignation_date)}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--amber)' }}>{fmtDate(emp.last_working_day) || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{emp.exit_reason || '—'}</td>
                        <td><button className="btn btn-sm btn-primary" onClick={() => setReviewingResign(emp)} style={{ fontSize: 12 }}>Review →</button></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            )}

          </div>
        )}
      </div>

      {/* Modals */}
      {reviewingDoc && <HRReviewModal submission={reviewingDoc} onClose={() => setReviewingDoc(null)} onDone={notify} />}
      {previewingLetter && <LetterPreviewModal letter={previewingLetter} onClose={() => setPreviewingLetter(null)} />}
      {reviewingLetter && <HRHeadPanel letter={reviewingLetter} onClose={() => setReviewingLetter(null)} onDone={(action) => { setReviewingLetter(null); notify(`Letter ${action}d successfully.`); }} />}
      {reviewingAO && <AOReviewModal ao={reviewingAO} onClose={() => setReviewingAO(null)} onDone={(action) => { setReviewingAO(null); notify(`Appointment order ${action}d successfully.`); }} />}
      {reviewingResign && <ResignationModal emp={reviewingResign} onClose={() => setReviewingResign(null)} onDone={(action) => { setReviewingResign(null); notify(`Resignation ${action}d successfully.`); }} />}
    </div>
  );
}