import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const DOC_TYPES = [
  { key: 'photo', label: 'Passport Photo', accept: 'image/*', required: true },
  { key: 'aadhaar', label: 'Aadhaar Card', accept: '.pdf,image/*', required: true },
  { key: 'pan', label: 'PAN Card', accept: '.pdf,image/*', required: true },
  { key: 'resume', label: 'Resume / CV', accept: '.pdf,.doc,.docx', required: true },
  { key: 'degree', label: '10th Marks Card', accept: '.pdf,image/*', required: true },
  { key: 'degree_12', label: '12th Marks Card', accept: '.pdf,image/*', required: true },
  { key: 'graduation', label: 'Graduation Marks Card', accept: '.pdf,image/*', required: false },
  { key: 'postgrad', label: 'Post Graduation Marks Card', accept: '.pdf,image/*', required: false },
  { key: 'experience', label: 'Experience / Relieving Letter', accept: '.pdf,image/*', required: false },
  { key: 'bank_passbook', label: 'Bank Details', accept: '.pdf,image/*', required: true },
  { key: 'offer_letter', label: 'Previous Offer Letter', accept: '.pdf,image/*', required: false },
];

const REQUIRED_KEYS = DOC_TYPES.filter(d => d.required).map(d => d.key);

// ─────────────────────────────────────────────────────────────────────────────
// Status banner config
// ─────────────────────────────────────────────────────────────────────────────

const SUB_STATUS = {
  pending_hr: {
    color: 'var(--amber)', bg: 'rgba(245,166,35,.08)', border: 'rgba(245,166,35,.25)',
    icon: '🕐', title: 'Under HR Review',
    desc: 'Your documents have been submitted and are being reviewed by HR. You cannot make changes until a decision is made.',
  },
  approved: {
    color: 'var(--green)', bg: 'rgba(63,207,142,.08)', border: 'rgba(63,207,142,.25)',
    icon: '✅', title: 'Documents Approved',
    desc: 'HR has approved all your documents. No further changes are allowed.',
  },
  rejected: {
    color: 'var(--red)', bg: 'rgba(240,82,82,.08)', border: 'rgba(240,82,82,.25)',
    icon: '❌', title: 'Documents Rejected',
    desc: 'HR has reviewed your documents and requested changes. See the remarks below, update the highlighted documents, and resubmit.',
  },
};

function StatusBanner({ submission, onResubmit, submitting }) {
  if (!submission) return null;
  const cfg = SUB_STATUS[submission.status];
  if (!cfg) return null;

  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 20 }}>{cfg.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: cfg.color, marginBottom: 4 }}>{cfg.title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>{cfg.desc}</div>

          {submission.status === 'rejected' && submission.remarks && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(240,82,82,.06)', borderRadius: 8, border: '1px solid rgba(240,82,82,.2)' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--red)', textTransform: 'uppercase', marginBottom: 4 }}>HR Remarks</div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{submission.remarks}</div>
            </div>
          )}

          {submission.status === 'rejected' && (
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={onResubmit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Resubmit for Review'}
            </button>
          )}

          {submission.reviewed_at && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10 }}>
              Reviewed on {new Date(submission.reviewed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DocCard
// ─────────────────────────────────────────────────────────────────────────────

function DocCard({ doc, uploaded, isLoading, err, isLocked, isPending, onUpload, onView, onDelete, isOptional }) {
  const fileRef = useRef();
  const u = uploaded;

  const borderColor = u
    ? (isLocked ? 'rgba(63,207,142,0.5)' : 'rgba(63,207,142,0.4)')
    : err ? 'rgba(240,82,82,0.4)' : 'var(--border)';

  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius)', padding: 14,
      display: 'flex', flexDirection: 'column', gap: 8,
      opacity: isPending && !u ? 0.7 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {doc.label}
            {doc.required && <span style={{ color: 'var(--red)', marginLeft: 4, fontSize: 11 }}>*</span>}
          </div>
          {u && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>✓ {u.filename}</div>}
          {err && !isOptional && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2 }}>{err}</div>}
          {err && isOptional && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2 }}>{err}</div>}
        </div>
        {u && <span style={{ fontSize: 18 }}>✅</span>}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={doc.accept}
        style={{ display: 'none' }}
        onChange={e => onUpload(doc.key, e.target.files[0])}
      />

      <div style={{ display: 'flex', gap: 6 }}>
        {!isPending && (!isLocked || (isOptional && !u)) && (
          <button
            className={`btn btn-sm ${u ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => fileRef.current?.click()}
            disabled={isLoading}
            style={{ flex: 1 }}
          >
            {isLoading ? 'Uploading…' : u ? '↻ Replace' : '⬆ Upload'}
          </button>
        )}

        {u?.url && (
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onView(u.url)}
            style={{ flex: isLocked || isPending ? 1 : 'unset' }}
          >
            View
          </button>
        )}

        {!isLocked && !isPending && u && (
          <button
            className="btn btn-sm btn-secondary"
            style={{ color: 'var(--red)', borderColor: 'rgba(240,82,82,.3)' }}
            onClick={() => onDelete(doc.key)}
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page root
// ─────────────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { user } = useAuth();
  const role = user?.role;
  if (['hr_head', 'admin', 'hr'].includes(role)) return <HRDocumentsView />;
  return <EmployeeDocumentsView />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Personal Info Form
// ─────────────────────────────────────────────────────────────────────────────

const STEP1_FIELDS = [
  { key: 'full_name', label: 'Full Name', type: 'text', placeholder: 'As per Aadhaar', required: true, pattern: null },
  { key: 'dob', label: 'Date of Birth', type: 'date', placeholder: '', required: true, pattern: null },
  { key: 'aadhaar_number', label: 'Aadhaar Number', type: 'text', placeholder: 'XXXX XXXX XXXX', required: true, pattern: /^\d{4}\s?\d{4}\s?\d{4}$/ },
  { key: 'pan_number', label: 'PAN Number', type: 'text', placeholder: 'ABCDE1234F', required: true, pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/ },
  { key: 'phone', label: 'Mobile Number', type: 'tel', placeholder: '10-digit number', required: true, pattern: /^\d{10}$/ },
  { key: 'bank_name', label: 'Bank Name', type: 'text', placeholder: 'e.g. State Bank of India', required: true, pattern: null },
  { key: 'account_number', label: 'Bank Account Number', type: 'text', placeholder: 'Enter account number', required: true, pattern: null },
  { key: 'ifsc_code', label: 'IFSC Code', type: 'text', placeholder: 'e.g. SBIN0001234', required: true, pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/ },
  { key: 'degree_10_marks', label: '10th Marks / Percentage', type: 'text', placeholder: 'e.g. 85% or 520/600', required: true, pattern: null },
  { key: 'degree_12_marks', label: '12th Marks / Percentage', type: 'text', placeholder: 'e.g. 78% or 460/600', required: true, pattern: null },
  { key: 'graduation_marks', label: 'Graduation Marks / CGPA', type: 'text', placeholder: 'e.g. 8.5 CGPA or 75%', required: true, pattern: null },
  { key: 'postgrad_marks', label: 'Post Graduation Marks / CGPA', type: 'text', placeholder: 'e.g. 8.0 CGPA or 72% (if applicable)', required: false, pattern: null },
  { key: 'address', label: 'Permanent Address', type: 'textarea', placeholder: 'Enter your full address here', required: true, pattern: null },
];

const getStep1Key = (uid) => `hr_step1_data_${uid}`;

function Step1Form({ onComplete, userId, readOnly = false, onBack }) {
  const STEP1_KEY = getStep1Key(userId);
  const saved = (() => { try { return JSON.parse(localStorage.getItem(STEP1_KEY) || '{}'); } catch { return {}; } })();
  const [form, setForm] = useState(saved);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const errs = {};
    const isRepetitive = (s) => /^(.)\1+$/.test(s);
    const isConsecutive = (s) => {
      for (let i = 0; i < s.length - 1; i++) {
        if (Math.abs(s.charCodeAt(i + 1) - s.charCodeAt(i)) !== 1) return false;
      }
      return true;
    };

    STEP1_FIELDS.forEach(f => {
      const v = (form[f.key] || '').trim();
      if (f.required && !v) { errs[f.key] = 'Required'; return; }
      if (!v) return;
      const stripped = v.replace(/\s/g, '');
      if (f.pattern && !f.pattern.test(stripped)) { errs[f.key] = 'Invalid format'; return; }
      if (f.key === 'aadhaar_number') {
        const digits = stripped;
        if (!/^\d{12}$/.test(digits)) { errs[f.key] = 'Must be exactly 12 digits'; return; }
        if (isRepetitive(digits)) { errs[f.key] = 'Invalid Aadhaar number'; return; }
        if (isConsecutive(digits)) { errs[f.key] = 'Invalid Aadhaar number'; return; }
        if (/^[01]/.test(digits)) { errs[f.key] = 'Aadhaar cannot start with 0 or 1'; return; }
      }
      if (f.key === 'phone') {
        if (!/^[6-9]\d{9}$/.test(stripped)) { errs[f.key] = 'Enter a valid 10-digit mobile number'; return; }
        if (isRepetitive(stripped)) { errs[f.key] = 'Invalid mobile number'; return; }
        if (isConsecutive(stripped)) { errs[f.key] = 'Invalid mobile number'; return; }
      }
      if (f.key === 'pan_number') {
        if (isRepetitive(stripped.slice(0, 5))) { errs[f.key] = 'Invalid PAN number'; return; }
      }
      if (f.key === 'account_number') {
        if (!/^\d{9,18}$/.test(stripped)) { errs[f.key] = 'Account number must be 9–18 digits'; return; }
        if (isRepetitive(stripped)) { errs[f.key] = 'Invalid account number'; return; }
      }
      if (f.key === 'full_name') {
        if (!/^[A-Za-z\s\.]{2,}$/.test(v)) { errs[f.key] = 'Only letters allowed'; return; }
        if (v.trim().split(/\s+/).length < 2) { errs[f.key] = 'Enter full name (first + last)'; return; }
      }
      if (f.key === 'dob' && v) {
        const dob = new Date(v);
        const today = new Date();
        const age = (today - dob) / (365.25 * 24 * 3600 * 1000);
        if (isNaN(dob.getTime())) { errs[f.key] = 'Invalid date'; return; }
        if (age < 16) { errs[f.key] = 'Age must be at least 16'; return; }
        if (age > 75) { errs[f.key] = 'Check date of birth'; return; }
      }
      if (['degree_10_marks', 'degree_12_marks', 'graduation_marks', 'postgrad_marks'].includes(f.key)) {
        if (!/^\d{1,3}(\.\d{1,2})?(%|\/\d{2,4})?(\s*CGPA)?$/i.test(v)) {
          errs[f.key] = 'e.g. 85%, 520/600, or 8.5 CGPA'; return;
        }
      }
      if (f.key === 'address' && v.length < 20) {
        errs[f.key] = 'Enter complete address (min 20 characters)'; return;
      }
    });
    return errs;
  };

  const submit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    localStorage.setItem(STEP1_KEY, JSON.stringify(form));
    axios.post('/api/employees/me/step1', form).catch(() => { });
    onComplete(form);
  };

  const fieldErr = (k) => submitted && errors[k];

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 800, margin: 0 }}>
            📋 Step 1 — Personal Information
          </h1>
          {readOnly && (
            <button type="button" className="btn btn-secondary" onClick={() => onBack?.()} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
              ← Back to Documents
            </button>
          )}
        </div>
        {readOnly ? (
          <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(63,207,142,.08)', border: '1px solid rgba(63,207,142,.25)', borderRadius: 8, fontSize: 13, color: 'var(--green)' }}>
            ✅ Your documents have been approved. This information is locked and cannot be edited.
          </div>
        ) : (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>
            Fill in your details accurately before uploading documents. These will be cross-verified with your uploaded files.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
        {['Personal Info', 'Upload Documents'].map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0,
                background: i === 0 ? 'var(--accent)' : 'var(--surface-2)',
                color: i === 0 ? '#fff' : 'var(--text-dim)',
              }}>{i + 1}</div>
              <span style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? 'var(--text)' : 'var(--text-dim)' }}>{label}</span>
            </div>
            {i === 0 && <div style={{ flex: 1, height: 2, background: 'var(--border)', margin: '0 12px' }} />}
          </div>
        ))}
      </div>

      <form onSubmit={submit} noValidate>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {STEP1_FIELDS.map(f => (
            <div key={f.key} className="form-group" style={{ margin: 0, gridColumn: f.type === 'textarea' ? '1 / -1' : 'auto' }}>
              <label className="form-label">
                {f.label}{f.required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
              </label>
              {f.type === 'textarea' ? (
                <textarea
                  rows={3} value={form[f.key] || ''} onChange={e => !readOnly && set(f.key, e.target.value)}
                  placeholder={f.placeholder} disabled={readOnly}
                  style={{ borderColor: fieldErr(f.key) ? 'var(--red)' : undefined, opacity: readOnly ? 0.75 : 1 }}
                />
              ) : (
                <input
                  type={f.type} value={form[f.key] || ''}
                  onChange={e => {
                    if (readOnly) return;
                    const UPPER_KEYS = ['pan_number', 'aadhaar_number', 'ifsc_code'];
                    const val = e.target.value;
                    set(f.key, UPPER_KEYS.includes(f.key) ? val.toUpperCase() : val);
                  }}
                  placeholder={f.placeholder} disabled={readOnly}
                  style={{ borderColor: fieldErr(f.key) ? 'var(--red)' : undefined, opacity: readOnly ? 0.75 : 1 }}
                />
              )}
              {fieldErr(f.key) && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{errors[f.key]}</div>}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          {!readOnly && (
            <button type="submit" className="btn btn-primary" style={{ minWidth: 200, padding: '12px 0' }}>Save & Continue to Step 2 →</button>
          )}
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmployeeDocumentsView
// ─────────────────────────────────────────────────────────────────────────────

function EmployeeDocumentsView() {
  const { user } = useAuth();
  const STEP1_KEY = getStep1Key(user?.id || user?._id || user?.email || 'default');
  const [step, setStep] = useState(() => {
    try { const d = JSON.parse(localStorage.getItem(STEP1_KEY) || '{}'); return Object.keys(d).length > 0 ? 2 : 1; }
    catch { return 1; }
  });
  const [step1Data, setStep1Data] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STEP1_KEY) || '{}'); } catch { return {}; }
  });

  const [uploads, setUploads] = useState({});
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [pageLoading, setPageLoad] = useState(true);
  const [toast, setToast] = useState('');

  const load = () => {
    setPageLoad(true);
    axios.get('/api/documents/my').then(r => {
      const map = {};
      (r.data.docs || []).forEach(d => { map[d.doc_type] = d; });
      setUploads(map);
      setSubmission(r.data.submission || null);
      if (r.data.step1_data && Object.keys(r.data.step1_data).length > 0) {
        const key = getStep1Key(user?.id || user?._id || user?.email || 'default');
        const local = (() => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } })();
        if (Object.keys(local).length === 0) {
          localStorage.setItem(key, JSON.stringify(r.data.step1_data));
          setStep1Data(r.data.step1_data);
          setStep(2);
        }
      }
    }).catch(() => { }).finally(() => setPageLoad(false));
  };

  useEffect(() => { load(); }, []);

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const isLocked = submission?.status === 'approved';
  const isPending = submission?.status === 'pending_hr';

  const upload = async (key, file) => {
    if (!file) return;
    setLoading(p => ({ ...p, [key]: true }));
    setErrors(p => ({ ...p, [key]: '' }));
    const fd = new FormData();
    fd.append('file', file);
    fd.append('doc_type', key);
    try {
      const r = await axios.post('/api/documents/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploads(p => ({ ...p, [key]: r.data }));
      notify('Document uploaded successfully.');
    } catch (e) {
      setErrors(p => ({ ...p, [key]: e.response?.data?.error || 'Upload failed' }));
    } finally {
      setLoading(p => ({ ...p, [key]: false }));
    }
  };

  const deleteDoc = async (key) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await axios.delete(`/api/documents/${key}`);
      setUploads(p => { const n = { ...p }; delete n[key]; return n; });
      notify('Document removed.');
    } catch (e) {
      alert(e.response?.data?.error || 'Delete failed');
    }
  };

  const viewDoc = async (url) => {
    try {
      const r = await axios.get(url, { responseType: 'blob' });
      window.open(URL.createObjectURL(r.data), '_blank');
    } catch { alert('Could not open file.'); }
  };

  const submitForReview = async () => {
    setSubmitting(true);
    try {
      await axios.post('/api/documents/submit');
      notify('Documents submitted for HR review!');
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  const requiredDone = REQUIRED_KEYS.every(k => uploads[k]);
  const totalUploaded = DOC_TYPES.filter(d => uploads[d.key]).length;
  const requiredSection = DOC_TYPES.filter(d => d.required);
  const optionalSection = DOC_TYPES.filter(d => !d.required);

  if (pageLoading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)' }}>Loading…</div>;

  if (step === 1) {
    return <Step1Form onComplete={(data) => { setStep1Data(data); setStep(2); }} onBack={() => setStep(2)} userId={user?.id || user?._id || user?.email} readOnly={isLocked} />;
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: 'var(--green)', color: '#fff', borderRadius: 8,
          padding: '10px 18px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.3)',
        }}>{toast}</div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 800, margin: 0 }}>
            📁 Step 2 — Upload Documents
          </h1>
          <button className="btn btn-sm btn-secondary" onClick={() => setStep(1)} style={{ fontSize: 11 }}>
            {isLocked ? '👁 View Personal Info' : '← Edit Personal Info'}
          </button>
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          Upload your documents for HR verification. All required documents must be submitted before joining is confirmed.
        </div>
      </div>

      {/* Step 1 summary pill */}
      <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(63,207,142,.25)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: 'var(--green)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>✓ Step 1 Complete —</span>
        {step1Data.full_name && <span><strong>Name:</strong> {step1Data.full_name}</span>}
        {step1Data.pan_number && <span><strong>PAN:</strong> {step1Data.pan_number}</span>}
        {step1Data.aadhaar_number && <span><strong>Aadhaar:</strong> {'*'.repeat(8) + step1Data.aadhaar_number.replace(/\s/g, '').slice(-4)}</span>}
      </div>

      <StatusBanner submission={submission} onResubmit={submitForReview} submitting={submitting} />

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20 }}>
        {['Personal Info', 'Upload Documents'].map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0,
                background: i === 0 ? 'var(--green)' : 'var(--accent)', color: '#fff',
              }}>{i === 0 ? '✓' : '2'}</div>
              <span style={{ fontSize: 13, fontWeight: i === 1 ? 700 : 400, color: i === 1 ? 'var(--text)' : 'var(--green)' }}>{label}</span>
            </div>
            {i === 0 && <div style={{ flex: 1, height: 2, background: 'var(--green)', margin: '0 12px' }} />}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--text-dim)' }}>Documents uploaded</span>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: totalUploaded === DOC_TYPES.length ? 'var(--green)' : 'var(--accent)' }}>
              {totalUploaded} / {DOC_TYPES.length}
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${Math.round((totalUploaded / DOC_TYPES.length) * 100)}%`,
              background: totalUploaded === DOC_TYPES.length ? 'var(--green)' : 'var(--accent)',
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
        {totalUploaded === DOC_TYPES.length && (
          <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>All uploaded ✓</div>
        )}
      </div>

      {/* Doc sections */}
      {[
        { title: 'Required Documents', docs: requiredSection, color: 'var(--accent)' },
        { title: 'Optional Documents', docs: optionalSection, color: 'var(--text-dim)' },
      ].map(section => (
        <div key={section.title} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: section.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            {section.title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {section.docs.map(doc => (
              <DocCard
                key={doc.key}
                doc={doc}
                uploaded={uploads[doc.key]}
                isLoading={loading[doc.key]}
                err={errors[doc.key]}
                isLocked={isLocked}
                isPending={isPending}
                isOptional={!doc.required}
                onUpload={upload}
                onView={viewDoc}
                onDelete={deleteDoc}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Optional docs resubmit when approved */}
      {isLocked && (
        <div style={{
          marginTop: 8, padding: '16px 20px',
          background: 'rgba(37,99,235,.05)',
          border: '1px solid rgba(37,99,235,.2)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>📎 Optional Documents</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
              You can still upload optional documents. They will be sent to HR for review.
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={submitForReview}
            disabled={submitting}
            style={{ minWidth: 160 }}
          >
            {submitting ? 'Submitting…' : '📤 Submit for Review'}
          </button>
        </div>
      )}

      {/* Submit for review */}
      {!isLocked && !isPending && (
        <div style={{
          marginTop: 8, padding: '20px 24px',
          background: requiredDone ? 'rgba(63,207,142,.06)' : 'var(--surface)',
          border: `1px solid ${requiredDone ? 'rgba(63,207,142,.3)' : 'var(--border)'}`,
          borderRadius: 10,
        }}>
          {!requiredDone ? (
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              📋 Upload all required documents to enable submission.
              <div style={{ marginTop: 6, fontSize: 12 }}>
                Missing: {REQUIRED_KEYS.filter(k => !uploads[k]).map(k => DOC_TYPES.find(d => d.key === k)?.label).join(', ')}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)' }}>✓ All required documents uploaded</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                  Submit your documents for HR review to proceed with onboarding.
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={submitForReview}
                disabled={submitting}
                style={{ background: 'var(--green)', borderColor: 'var(--green)', minWidth: 180 }}
              >
                {submitting ? 'Submitting…' : 'Submit for HR Review →'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HRDocumentsView
// ─────────────────────────────────────────────────────────────────────────────

const DOC_LABEL = Object.fromEntries(DOC_TYPES.map(d => [d.key, d.label]));

function HRDocumentsView() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [tab, setTab] = useState('pending_hr');
  const [success, setSuccess] = useState('');

  const load = () => {
    setLoading(true);
    axios.get(`/api/documents/submissions${tab !== 'all' ? `?status=${tab}` : ''}`)
      .then(r => setSubmissions(r.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tab]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Employee Documents</h1>
          <p className="page-subtitle">Review and approve employee document submissions</p>
        </div>
      </div>

      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {[['pending_hr', '🕐 Pending'], ['approved', '✅ Approved'], ['rejected', '❌ Rejected']].map(([key, label]) => (
          <button key={key}
            className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(key)} style={{ fontSize: 12 }}>{label}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)' }}>Loading…</div>
        ) : submissions.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
            <div style={{ fontWeight: 600 }}>No submissions found</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th><th>Submitted</th><th>Docs</th>
                  <th>Status</th><th>Remarks</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(sub => (
                  <tr key={sub._id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{sub.employee_name}</div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>{sub.employee_code}</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {new Date(sub.submitted_at).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ fontSize: 12 }}>{(sub.docs || []).length} docs</td>
                    <td>
                      <span className={`badge ${sub.status === 'approved' ? 'badge-green' : sub.status === 'rejected' ? 'badge-red' : 'badge-amber'}`}>
                        {sub.status === 'pending_hr' ? 'Pending Review' : sub.status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-dim)', maxWidth: 200 }}>
                      {sub.remarks ? (
                        <span style={{ color: 'var(--red)' }} title={sub.remarks}>
                          {sub.remarks.length > 50 ? sub.remarks.slice(0, 50) + '…' : sub.remarks}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-primary" onClick={() => setReviewing(sub)}>
                        {sub.status === 'pending_hr' ? 'Review' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {reviewing && (
        <HRReviewModal
          submission={reviewing}
          onClose={() => setReviewing(null)}
          onDone={(msg) => { setReviewing(null); load(); notify(msg); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HRReviewModal
// ─────────────────────────────────────────────────────────────────────────────

function HRReviewModal({ submission, onClose, onDone }) {
  const [fullSub, setFullSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSub] = useState(false);
  const [error, setError] = useState('');
  const docs = fullSub?.docs || [];

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

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 740, width: '96%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
              Document Review
            </div>
            <h2 style={{ margin: 0, fontSize: 20 }}>{submission.employee_name}</h2>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
              {submission.employee_code} · Submitted {new Date(submission.submitted_at).toLocaleDateString('en-IN')}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Loading documents…</div>
          ) : (
            <>
              {/* ── Step 1: Personal Info (read-only snapshot) ── */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Step 1 — Personal Information
                </div>
                {(!fullSub?.step1_data || Object.keys(fullSub.step1_data).length === 0) ? (
                  <div style={{ padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                    Employee has not submitted personal info yet.
                  </div>
                ) : (
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                      {[
                        { key: 'full_name', label: 'Full Name' },
                        { key: 'dob', label: 'Date of Birth' },
                        { key: 'aadhaar_number', label: 'Aadhaar Number' },
                        { key: 'pan_number', label: 'PAN Number' },
                        { key: 'phone', label: 'Mobile Number' },
                        { key: 'bank_name', label: 'Bank Name' },
                        { key: 'account_number', label: 'Account Number' },
                        { key: 'ifsc_code', label: 'IFSC Code' },
                        { key: 'degree_10_marks', label: '10th Marks' },
                        { key: 'degree_12_marks', label: '12th Marks' },
                        { key: 'graduation_marks', label: 'Graduation Marks' },
                        { key: 'postgrad_marks', label: 'Post Graduation Marks' },
                      ].map(({ key, label }) => {
                        const val = fullSub.step1_data[key];
                        if (!val) return null;
                        return (
                          <div key={key}>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: key === 'pan_number' || key === 'ifsc_code' || key === 'account_number' || key === 'aadhaar_number' ? 'var(--mono)' : undefined }}>
                              {key === 'aadhaar_number' ? ('*'.repeat(8) + String(val).replace(/\s/g, '').slice(-4)) : String(val)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Address — full width */}
                    {fullSub.step1_data.address && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 2 }}>Permanent Address</div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.5 }}>{fullSub.step1_data.address}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Step 2: Uploaded Documents ── */}
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 10 }}>
                Step 2 — Uploaded Documents ({docs.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {DOC_TYPES.map(dt => {
                  const doc = docs.find(d => d.doc_type === dt.key);
                  return (
                    <div key={dt.key} style={{
                      padding: '10px 14px', borderRadius: 8,
                      background: doc ? 'var(--green-dim, rgba(63,207,142,.06))' : 'var(--surface-2)',
                      border: `1px solid ${doc ? 'rgba(63,207,142,.25)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: doc ? 'var(--text)' : 'var(--text-dim)' }}>
                          {dt.label}
                          {dt.required && <span style={{ color: 'var(--red)', marginLeft: 3, fontSize: 10 }}>*</span>}
                        </div>
                        {doc ? (
                          <div style={{ fontSize: 11, color: 'var(--green)' }}>✓ Uploaded</div>
                        ) : (
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>Not uploaded</div>
                        )}
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

              {submission.status === 'rejected' && submission.remarks && (
                <div style={{ padding: '12px 16px', background: 'rgba(240,82,82,.06)', border: '1px solid rgba(240,82,82,.2)', borderRadius: 8, marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--red)', textTransform: 'uppercase', marginBottom: 4 }}>Previous Rejection Remarks</div>
                  <div style={{ fontSize: 13, lineHeight: 1.55 }}>{submission.remarks}</div>
                </div>
              )}

              {!isReadOnly && (
                <>
                  {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}

                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 10 }}>Decision</div>

                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    {['approve', 'reject'].map(a => (
                      <button key={a}
                        className={`btn ${action === a ? (a === 'approve' ? 'btn-primary' : 'btn-danger') : 'btn-secondary'}`}
                        onClick={() => setAction(a)}
                        style={{ flex: 1, padding: '11px 0', ...(action === a && a === 'approve' ? { background: 'var(--green)', borderColor: 'var(--green)' } : {}) }}>
                        {a === 'approve' ? '✅ Approve' : '❌ Reject'}
                      </button>
                    ))}
                  </div>

                  {action && (
                    <>
                      <div className="form-group" style={{ marginBottom: 14 }}>
                        <label className="form-label">
                          {action === 'approve' ? 'Remarks (optional)' : 'What needs to be fixed?'}
                          {action === 'reject' && <span style={{ color: 'var(--red)', fontSize: 10, marginLeft: 4 }}>(required)</span>}
                        </label>
                        <textarea
                          value={remarks} onChange={e => setRemarks(e.target.value)} rows={3}
                          placeholder={action === 'approve' ? 'Optional notes for the employee…' : 'Describe exactly which documents need to be replaced or corrected…'}
                        />
                      </div>
                      <button
                        className={`btn ${action === 'approve' ? 'btn-primary' : 'btn-danger'}`}
                        onClick={submit} disabled={submitting}
                        style={{ width: '100%', padding: '12px 0', ...(action === 'approve' ? { background: 'var(--green)', borderColor: 'var(--green)' } : {}) }}
                      >
                        {submitting ? 'Processing…' : action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
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
                    {submission.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                  </div>
                  {submission.remarks && (
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>{submission.remarks}</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}