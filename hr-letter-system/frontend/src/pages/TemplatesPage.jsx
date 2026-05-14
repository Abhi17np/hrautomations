import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const ALL_PLACEHOLDERS = [
  ['employee_name','Full name'],['employee_id','Employee ID'],['designation','Job title'],
  ['department','Department'],['ctc','Annual CTC'],['basic','Basic salary'],
  ['hra','HRA'],['allowances','Other allowances'],['joining_date','Start date'],
  ['address','Home address'],['probation_period','Probation (months)'],
  ['notice_period','Notice (days)'],['company_name','Company'],
  ['hr_signatory_name','Signatory name'],['hr_signatory_designation','Signatory title'],
  ['date','Letter date'],
  ['resignation_date','Resignation date'],['last_working_day','Last working day'],['exit_reason','Exit reason'],
];

// ── Delete Confirm Modal ────────────────────────────────────────────────────

function DeleteTemplateModal({ template, onClose, onDone }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const confirm = async () => {
    setLoading(true); setError('');
    try {
      await axios.delete(`/api/templates/${template._id}`);
      onDone(`Template "${template.name}" deleted.`);
    } catch (e) {
      setError(e.response?.data?.error || 'Delete failed');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <h2 className="modal-title" style={{ color: 'var(--red)' }}>⚠ Delete Template</h2>

        <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
            {[['Name', template.name], ['Type', template.type], ['Version', `v${template.version}`], ['Status', template.is_active ? 'Active' : 'Inactive']].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>{k}</div>
                <div style={{ fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(240,82,82,0.25)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--red)', lineHeight: 1.6 }}>
          <strong>This action is permanent.</strong> The template record and its DOCX file will
          be deleted from disk. This will fail if any offer letters reference this template —
          in that case, <strong>Deactivate</strong> it instead to block new use while
          preserving the audit trail.
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-danger" onClick={confirm} disabled={loading}
            style={{ background: 'var(--red)', borderColor: 'var(--red)', color: 'white' }}>
            {loading ? 'Deleting...' : '✕ Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main TemplatesPage ───────────────────────────────────────────────────────

export default function TemplatesPage() {
  const { user }                                    = useAuth();
  const [templates,    setTemplates]                = useState([]);
  const [loading,      setLoading]                  = useState(true);
  const [showModal,    setShowModal]                = useState(false);
  const [deleteTarget, setDeleteTarget]             = useState(null);
  const [uploading,    setUploading]                = useState(false);
  const [error,        setError]                    = useState('');
  const [success,      setSuccess]                  = useState('');
  const [form,         setForm]                     = useState({ name: '', templateType: 'offer' });
  const [activeType,   setActiveType]               = useState('offer');
  const fileRef = useRef();

  const isAdmin   = user?.role === 'admin';
  const canDelete = user?.role === 'admin' || user?.role === 'hr_head';

  const load = (type = activeType) => {
    setLoading(true);
    axios.get(`/api/templates/?type=${type}`)
      .then(r => setTemplates(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(activeType); }, [activeType]);

  const handleUpload = async (e) => {
    e.preventDefault(); setError(''); setUploading(true);
    const file = fileRef.current.files[0];
    if (!file) { setError('Please select a .docx file'); setUploading(false); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', form.name || file.name);
    fd.append('type', form.templateType);
    try {
      const res = await axios.post('/api/templates/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess(`Uploaded v${res.data.version}. Found ${res.data.placeholders.length} placeholder(s).`);
      setShowModal(false);
      setActiveType(form.templateType);
      setTimeout(() => setSuccess(''), 6000);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  };

  const toggle = async (id) => {
    try {
      await axios.post(`/api/templates/${id}/toggle`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Toggle failed');
    }
  };

  const dlTemplate = (t) =>
    axios.get(`/api/templates/${t._id}/download`, { responseType: 'blob' })
      .then(r => {
        const url = URL.createObjectURL(r.data);
        const a = document.createElement('a');
        a.href = url; a.download = t.filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });

  const onDeleteDone = (msg) => {
    setDeleteTarget(null);
    load();
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 5000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Templates</h1>
          <p className="page-subtitle">Manage DOCX templates with &#123;&#123;placeholders&#125;&#125;</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary"
            onClick={() => { setShowModal(true); setError(''); setForm({ name: '', templateType: activeType }); }}>
            ↑ Upload Template
          </button>
        )}
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error   && <div className="alert alert-error">{error}</div>}

      {/* Permission notice */}
      {canDelete && (
        <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 'var(--radius)', padding: '8px 14px', marginBottom: 16, fontSize: 12, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠</span>
          <span>You have <strong>{user.role === 'admin' ? 'Admin' : 'HR Head'}</strong> privileges. Templates with no linked letters can be permanently deleted. Use <strong>Deactivate</strong> to soft-disable templates that have existing letters.</span>
        </div>
      )}

      {/* Type tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['offer', 'Offer Letter Templates'], ['relieving', 'Relieving Letter Templates'], ['appointment_order', 'Appointment Order Templates']].map(([type, label]) => (
          <button key={type}
            className={`btn btn-sm ${activeType === type ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveType(type)} style={{ fontSize: 12 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Placeholder reference */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Supported Placeholders — use these in your Word document
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
          {ALL_PLACEHOLDERS.map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ fontSize: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 4, color: 'var(--accent)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                {'{{'}{key}{'}}'}
              </code>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? <div className="page-loading"><div className="spinner" /></div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Version</th><th>Placeholders Found</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {templates.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state">
                    <div className="empty-icon">⬡</div>
                    <p>No {activeType} templates yet — upload a DOCX file to get started</p>
                  </div></td></tr>
                ) : templates.map(t => (
                  <tr key={t._id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{t.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 2 }}>{t.type}</div>
                    </td>
                    <td><span className="badge badge-gray mono">v{t.version}</span></td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(t.placeholders || []).map(p => (
                          <span key={p} style={{ fontSize: 10, background: 'var(--accent-dim)', color: 'var(--accent)', padding: '2px 7px', borderRadius: 4, fontFamily: 'var(--mono)', border: '1px solid rgba(79,142,247,0.2)' }}>
                            {'{{'}{p}{'}}'}
                          </span>
                        ))}
                        {!t.placeholders?.length && <span className="text-muted text-sm">none detected</span>}
                      </div>
                    </td>
                    <td><span className={`badge ${t.is_active ? 'badge-green' : 'badge-gray'}`}>{t.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => dlTemplate(t)}>↓ Download</button>
                        {/* Activate/Deactivate: admin only */}
                        {isAdmin && (
                          <button className="btn btn-sm btn-secondary" onClick={() => toggle(t._id)}>
                            {t.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                        {/* Delete: admin or hr_head */}
                        {canDelete && (
                          <button className="btn btn-sm btn-danger"
                            style={{ background: 'var(--red)', borderColor: 'var(--red)', color: 'white' }}
                            onClick={() => setDeleteTarget(t)}
                            title="Permanently delete this template (Admin / HR Head only)">
                            ✕ Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2 className="modal-title">Upload {{ offer: 'Offer Letter', relieving: 'Relieving Letter', appointment_order: 'Appointment Order' }[form.templateType]} Template</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 16, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Create a <strong style={{ color: 'var(--text)' }}>.docx</strong> Word document and use{' '}
              <code style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{'{{placeholder}}'}</code>{' '}
              syntax. Placeholders are auto-detected on upload.
            </div>
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label className="form-label">Template Type *</label>
                <select value={form.templateType} onChange={e => setForm({ ...form, templateType: e.target.value })}>
                <option value="offer">Offer Letter</option>
                <option value="relieving">Relieving Letter</option>
                <option value="appointment_order">Appointment Order</option>   {/* ← add this */}
              </select>
              </div>
              <div className="form-group">
                <label className="form-label">Template Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder={form.templateType === 'offer' ? 'e.g. Standard Offer Letter 2026' : 'e.g. Relieving Letter Template'} />
              </div>
              <div className="form-group">
                <label className="form-label">DOCX File *</label>
                <input type="file" accept=".docx" ref={fileRef} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete template confirmation */}
      {deleteTarget && (
        <DeleteTemplateModal template={deleteTarget} onClose={() => setDeleteTarget(null)} onDone={onDeleteDone} />
      )}
    </div>
  );
}