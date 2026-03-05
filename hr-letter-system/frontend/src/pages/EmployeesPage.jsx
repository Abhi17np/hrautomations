import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = {
  name: '', designation: '', department: '', ctc: '',
  joining_date: '', status: 'active', email: '', phone: '',
  notice_period: '30', probation_period: '6',
};

const STATUS_BADGE = {
  active:             'badge-green',
  notice_period:      'badge-amber',
  clearance_pending:  'badge-amber',
  clearance_complete: 'badge-blue',
  exited:             'badge-gray',
};

// Per the workflow doc:
//   - admin/hr_head can delete active employees (if no letters) and exited employees
//   - nobody can delete mid-exit employees
const DELETE_ROLES        = new Set(['admin', 'hr_head']);
// These statuses are mid-process and blocked from deletion
const BLOCKED_DELETE_STATUSES = new Set(['notice_period', 'clearance_pending', 'clearance_complete']);

// ── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteEmployeeModal({ emp, onClose, onDone }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const isExited = emp.status === 'exited';

  const confirm = async () => {
    setLoading(true); setError('');
    try {
      await axios.delete(`/api/employees/${emp._id}`);
      onDone(`Employee "${emp.name}" deleted.`);
    } catch (e) {
      setError(e.response?.data?.error || 'Delete failed');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <h2 className="modal-title" style={{ color: 'var(--red)' }}>⚠ Delete Employee Record</h2>

        <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
            {[['Name', emp.name], ['ID', emp.employee_id], ['Designation', emp.designation], ['Status', emp.status?.replace(/_/g, ' ')]].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>{k}</div>
                <div style={{ fontWeight: 500 }}>
                  {k === 'Status'
                    ? <span className={`badge ${STATUS_BADGE[emp.status] || 'badge-gray'}`}>{v}</span>
                    : v}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(240,82,82,0.25)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--red)', lineHeight: 1.6 }}>
          <strong>This action is permanent.</strong> The employee record will be removed.
          {isExited
            ? ' This employee has completed the exit process. Their offer and relieving letters remain in the system.'
            : ' Active employees with existing offer letters cannot be deleted — delete or archive their letters first.'}
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

// ── Main EmployeesPage ───────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { user }                                  = useAuth();
  const [employees,    setEmployees]              = useState([]);
  const [loading,      setLoading]                = useState(true);
  const [showModal,    setShowModal]              = useState(false);
  const [editing,      setEditing]                = useState(null);
  const [deleteTarget, setDeleteTarget]           = useState(null);
  const [search,       setSearch]                 = useState('');
  const [error,        setError]                  = useState('');
  const [success,      setSuccess]                = useState('');
  const [form,         setForm]                   = useState(EMPTY_FORM);

  const canDelete = DELETE_ROLES.has(user?.role);
  const isPrivileged = DELETE_ROLES.has(user?.role); // hr_head + admin see all incl. pending

  const load = () => {
    setLoading(true);
    // hr_head and admin fetch all employees (including hidden pending ones)
    // so they can manage the Revised Letter flow and see the full picture
    const qs = isPrivileged ? '?show_all=true' : '';
    axios.get(`/api/employees/${qs}`).then(r => setEmployees(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setShowModal(true); setError(''); };
  const openEdit   = (emp) => { setForm({ ...emp }); setEditing(emp._id); setShowModal(true); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      if (editing) {
        await axios.put(`/api/employees/${editing}`, form);
        setSuccess('Employee updated');
      } else {
        await axios.post('/api/employees/', form);
        setSuccess('Employee created');
      }
      setShowModal(false); load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving');
    }
  };

  const onDeleteDone = (msg) => {
    setDeleteTarget(null);
    load();
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  // Determine if an employee row should show a Delete button
  const canDeleteEmployee = (emp) => {
    if (!canDelete) return false;
    // Block mid-exit employees
    if (BLOCKED_DELETE_STATUSES.has(emp.status)) return false;
    // Active and exited both allowed (backend will enforce letter-link check for active)
    return emp.status === 'active' || emp.status === 'exited';
  };

  const filtered = useMemo(() =>
    employees.filter(e =>
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
      e.designation?.toLowerCase().includes(search.toLowerCase())
    ),
    [employees, search]
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">
            {employees.filter(e => e.visible !== false).length} visible
            {isPrivileged && employees.filter(e => e.visible === false).length > 0
              ? ` · ${employees.filter(e => e.visible === false).length} pending lifecycle completion`
              : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Employee</button>
      </div>

      {isPrivileged && employees.some(e => e.visible === false) && (
        <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 'var(--radius)', padding: '8px 14px', marginBottom: 14, fontSize: 12, color: 'var(--amber)' }}>
          <strong>⚠ Pending employees shown (HR Head / Admin view only):</strong> These candidates have an active offer letter but haven't completed all 4 lifecycle stages (Review → Issue → Joining → Create ID). They won't appear here for other roles until the lifecycle is complete.
        </div>
      )}

      {success && <div className="alert alert-success">{success}</div>}
      {error   && <div className="alert alert-error">{error}</div>}

      {/* Permission notice */}
      {canDelete && (
        <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 'var(--radius)', padding: '8px 14px', marginBottom: 16, fontSize: 12, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠</span>
          <div>
            <strong>{user.role === 'admin' ? 'Admin' : 'HR Head'} deletion rights:</strong>
            {' '}Active employees (no linked letters) and Exited employees can be deleted.
            Employees in notice period or clearance stages are <strong>protected</strong> until the exit workflow completes.
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <input placeholder="Search by name, ID, or designation..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
        </div>

        {loading ? <div className="page-loading"><div className="spinner" /></div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee ID</th><th>Name</th><th>Designation</th><th>Department</th><th>CTC</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">◉</div><p>No employees found</p></div></td></tr>
                ) : filtered.map(emp => (
                  <tr key={emp._id} style={emp.visible === false ? { opacity: 0.65, background: 'var(--amber-dim)' } : {}}>
                    <td><span className="mono">{emp.employee_id}</span></td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{emp.name}</div>
                      {emp.email && <div className="text-sm text-muted">{emp.email}</div>}
                      {emp.visible === false && (
                        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--amber)', marginTop: 2 }}>
                          ⏳ Pending lifecycle — hidden from other roles
                        </div>
                      )}
                    </td>
                    <td>{emp.designation}</td>
                    <td>{emp.department || '—'}</td>
                    <td><span className="mono">₹{emp.ctc || '—'}</span></td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[emp.status] || 'badge-gray'}`}>
                        {emp.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(emp)}>Edit</button>
                        {/* Delete button: admin/hr_head, active (no letters) or exited only */}
                        {canDeleteEmployee(emp) && (
                          <button className="btn btn-sm btn-danger"
                            style={{ background: 'var(--red)', borderColor: 'var(--red)', color: 'white' }}
                            onClick={() => setDeleteTarget(emp)}
                            title={`Delete employee (${user.role === 'admin' ? 'Admin' : 'HR Head'} only)`}>
                            ✕ Delete
                          </button>
                        )}
                        {/* Tooltip for mid-exit employees */}
                        {canDelete && BLOCKED_DELETE_STATUSES.has(emp.status) && (
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', alignSelf: 'center' }}
                            title="Cannot delete: employee is mid-exit-process">
                            ⊘ Protected
                          </span>
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

      {/* Add/Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2 className="modal-title">{editing ? 'Edit Employee' : 'Add Employee'}</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@company.com" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Designation *</label>
                  <input required value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} placeholder="Software Engineer" />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input value={form.department || ''} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="Engineering" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">CTC</label>
                  <input value={form.ctc || ''} onChange={e => setForm({ ...form, ctc: e.target.value })} placeholder="8,00,000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Joining Date</label>
                  <input type="date" value={form.joining_date || ''} onChange={e => setForm({ ...form, joining_date: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Notice Period (days)</label>
                  <input type="number" value={form.notice_period || '30'} onChange={e => setForm({ ...form, notice_period: e.target.value })} placeholder="30" />
                </div>
                <div className="form-group">
                  <label className="form-label">Probation Period (months)</label>
                  <input type="number" value={form.probation_period || '6'} onChange={e => setForm({ ...form, probation_period: e.target.value })} placeholder="6" />
                </div>
              </div>
              {editing && (
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    disabled={form.status !== 'active'}>
                    <option value="active">Active</option>
                    <option value="notice_period">Notice Period</option>
                    <option value="clearance_pending">Clearance Pending</option>
                    <option value="clearance_complete">Clearance Complete</option>
                    <option value="exited">Exited</option>
                  </select>
                  {form.status !== 'active' && (
                    <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>
                      Status is managed by the Exit & Relieving module
                    </div>
                  )}
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteEmployeeModal emp={deleteTarget} onClose={() => setDeleteTarget(null)} onDone={onDeleteDone} />
      )}
    </div>
  );
}