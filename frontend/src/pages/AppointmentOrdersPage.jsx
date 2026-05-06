// import { useState, useEffect } from 'react';
// import axios from 'axios';
// import { useAuth } from '../context/AuthContext';

// const STATUS_CFG = {
//   draft:           { label: 'Draft',           cls: 'badge-gray'  },
//   pending_hr_head: { label: 'Pending HR Head', cls: 'badge-amber' },
//   approved:        { label: 'Approved',        cls: 'badge-green' },
//   rejected:        { label: 'Rejected',        cls: 'badge-red'   },
// };

// // ─── Create Appointment Order (2-step wizard) ────────────────────────────────

// function CreateOrderModal({ employees, templates, onClose, onDone }) {
//   const [step,    setStep]    = useState(1);
//   const [empId,   setEmpId]   = useState('');
//   const [tmplId,  setTmplId]  = useState('');
//   const [ctx,     setCtx]     = useState({
//     employment_type:          'Permanent',
//     work_location:            '',
//     reporting_manager:        '',
//     company_name:             'Acme Corp',
//     hr_signatory_name:        '',
//     hr_signatory_designation: 'HR Manager',
//   });
//   const [loading, setLoading] = useState(false);
//   const [error,   setError]   = useState('');

//   const selectedEmployee = employees.find(e => e._id === empId);
//   const selectedTemplate = templates.find(t => t._id === tmplId);

//   const AUTO = new Set(['employee_name','employee_id','designation','department','joining_date','date',
//     'company_name','hr_signatory_name','hr_signatory_designation','employment_type','work_location','reporting_manager']);
//   const extraPlaceholders = (selectedTemplate?.placeholders || []).filter(p => !AUTO.has(p));

//   const create = async () => {
//     setError(''); setLoading(true);
//     try {
//       await axios.post('/api/offer/appointment-orders', {
//         employee_id: empId, template_id: tmplId, context_fields: ctx,
//       });
//       onDone('Appointment order created as draft');
//     } catch (e) {
//       setError(e.response?.data?.error || 'Creation failed');
//       setLoading(false);
//     }
//   };

//   const setField = (key, val) => setCtx(c => ({ ...c, [key]: val }));

//   return (
//     <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
//       <div className="modal" style={{ maxWidth: 600 }}>
//         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
//           <h2 className="modal-title" style={{ margin: 0 }}>📄 Create Appointment Order</h2>
//           <div style={{ display: 'flex', gap: 6 }}>
//             {[1, 2].map(s => (
//               <div key={s} className="step-dot" style={{
//                 background: step === s ? 'var(--accent)' : step > s ? 'var(--green-dim)' : 'var(--surface-2)',
//                 color: step === s ? 'white' : step > s ? 'var(--green)' : 'var(--text-dim)',
//                 border: `1.5px solid ${step === s ? 'var(--accent)' : step > s ? 'var(--green)' : 'var(--border)'}`,
//               }}>{step > s ? '✓' : s}</div>
//             ))}
//           </div>
//         </div>

//         {error && <div className="alert alert-error">{error}</div>}

//         {step === 1 && (
//           <>
//             <div className="form-group">
//               <label className="form-label">Employee *</label>
//               <select value={empId} onChange={e => setEmpId(e.target.value)}>
//                 <option value="">Select employee…</option>
//                 {employees.map(emp => (
//                   <option key={emp._id} value={emp._id}>{emp.name} — {emp.employee_id} — {emp.designation}</option>
//                 ))}
//               </select>
//             </div>
//             <div className="form-group">
//               <label className="form-label">Template *</label>
//               <select value={tmplId} onChange={e => setTmplId(e.target.value)}>
//                 <option value="">Select template…</option>
//                 {templates.map(t => (
//                   <option key={t._id} value={t._id}>{t.name} (v{t.version})</option>
//                 ))}
//               </select>
//             </div>

//             {selectedEmployee && (
//               <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 4, fontSize: 12 }}>
//                 <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>Employee Details</div>
//                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
//                   {[['Name', selectedEmployee.name], ['ID', selectedEmployee.employee_id], ['Role', selectedEmployee.designation], ['Dept', selectedEmployee.department], ['Joining', selectedEmployee.joining_date]].filter(([,v]) => v).map(([k, v]) => (
//                     <div key={k}><span style={{ color: 'var(--text-dim)' }}>{k}: </span><span style={{ fontWeight: 500 }}>{v}</span></div>
//                   ))}
//                 </div>
//               </div>
//             )}

//             <div className="modal-footer">
//               <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
//               <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!empId || !tmplId}>Next →</button>
//             </div>
//           </>
//         )}

//         {step === 2 && (
//           <div style={{ maxHeight: '68vh', overflowY: 'auto', paddingRight: 4 }}>
//             <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 16, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
//               Fill in the appointment order details. Employee basic info (name, ID, designation, department, joining date) is auto-populated from the employee record.
//             </div>

//             <div className="form-row">
//               <div className="form-group">
//                 <label className="form-label">Employment Type</label>
//                 <select value={ctx.employment_type} onChange={e => setField('employment_type', e.target.value)}>
//                   <option>Permanent</option>
//                   <option>Contract</option>
//                   <option>Probationary</option>
//                   <option>Part-time</option>
//                   <option>Intern</option>
//                 </select>
//               </div>
//               <div className="form-group">
//                 <label className="form-label">Work Location</label>
//                 <input value={ctx.work_location} onChange={e => setField('work_location', e.target.value)} placeholder="e.g. Bengaluru HQ, Mumbai Office" />
//               </div>
//             </div>

//             <div className="form-group">
//               <label className="form-label">Reporting Manager</label>
//               <input value={ctx.reporting_manager} onChange={e => setField('reporting_manager', e.target.value)} placeholder="Direct reporting manager's name" />
//             </div>

//             <div className="form-row">
//               <div className="form-group">
//                 <label className="form-label">Company Name</label>
//                 <input value={ctx.company_name} onChange={e => setField('company_name', e.target.value)} />
//               </div>
//               <div className="form-group">
//                 <label className="form-label">HR Signatory Name</label>
//                 <input value={ctx.hr_signatory_name} onChange={e => setField('hr_signatory_name', e.target.value)} placeholder="e.g. Priya Sharma" />
//               </div>
//             </div>

//             <div className="form-group">
//               <label className="form-label">HR Signatory Designation</label>
//               <input value={ctx.hr_signatory_designation} onChange={e => setField('hr_signatory_designation', e.target.value)} />
//             </div>

//             {/* Extra template placeholders */}
//             {extraPlaceholders.length > 0 && (
//               <div style={{ marginTop: 4 }}>
//                 <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
//                   Additional Template Fields
//                 </div>
//                 {extraPlaceholders.map(p => (
//                   <div className="form-group" key={p}>
//                     <label className="form-label">{p.replace(/_/g, ' ')}</label>
//                     <input value={ctx[p] || ''} onChange={e => setField(p, e.target.value)} placeholder={`{{${p}}}`} />
//                   </div>
//                 ))}
//               </div>
//             )}

//             <div className="modal-footer">
//               <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
//               <button className="btn btn-primary" onClick={create} disabled={loading}>
//                 {loading ? 'Creating…' : '📄 Create Order'}
//               </button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// // ─── HR Head Review Modal ────────────────────────────────────────────────────

// function ReviewOrderModal({ order, onClose, onDone }) {
//   const [remarks, setRemarks] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [error,   setError]   = useState('');

//   const act = async (action) => {
//     if (action === 'reject' && !remarks.trim()) { setError('Rejection reason is required'); return; }
//     setLoading(true); setError('');
//     try {
//       await axios.post(`/api/offer/appointment-orders/${order._id}/action`, { action, remarks });
//       onDone(`Appointment order ${action}d`);
//     } catch (e) {
//       setError(e.response?.data?.error || 'Action failed');
//       setLoading(false);
//     }
//   };

//   const download = (fmt) => {
//     axios.get(`/api/offer/appointment-orders/${order._id}/download?format=${fmt}`, { responseType: 'blob' })
//       .then(r => {
//         const url = URL.createObjectURL(r.data);
//         const a = document.createElement('a'); a.href = url; a.download = `appointment.${fmt}`; a.click();
//         setTimeout(() => URL.revokeObjectURL(url), 1000);
//       });
//   };

//   return (
//     <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
//       <div className="modal" style={{ maxWidth: 540 }}>
//         <h2 className="modal-title">Review Appointment Order</h2>

//         <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
//           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 13 }}>
//             {[
//               ['Employee',       order.employee_name],
//               ['Employee ID',    order.employee_code],
//               ['Status',         order.status],
//               ['Emp. Type',      order.context?.employment_type],
//               ['Location',       order.context?.work_location],
//               ['Reports To',     order.context?.reporting_manager],
//             ].map(([k, v]) => v ? (
//               <div key={k}>
//                 <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>{k}</div>
//                 <div style={{ fontWeight: 500 }}>{v}</div>
//               </div>
//             ) : null)}
//           </div>
//         </div>

//         {/* Approval history */}
//         {(order.approval_history || []).length > 0 && (
//           <div style={{ marginBottom: 16 }}>
//             <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>Approval Trail</div>
//             {order.approval_history.map((h, i) => (
//               <div key={i} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
//                 <span style={{ fontFamily: 'var(--mono)', color: h.action === 'approve' || h.action === 'submitted' ? 'var(--green)' : 'var(--red)', minWidth: 70 }}>{h.action}</span>
//                 <span style={{ color: 'var(--text-muted)' }}>{h.user_name || h.role || 'System'}</span>
//                 <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{h.timestamp?.slice(0, 10)}</span>
//               </div>
//             ))}
//           </div>
//         )}

//         {/* Downloads */}
//         <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
//           <button className="btn btn-sm btn-secondary" onClick={() => download('docx')}>↓ Download DOCX</button>
//           {order.status === 'approved' && (
//             <button className="btn btn-sm btn-secondary" onClick={() => download('pdf')}>↓ Download PDF</button>
//           )}
//         </div>

//         {error && <div className="alert alert-error">{error}</div>}

//         <div className="form-group">
//           <label className="form-label">Remarks <span style={{ color: 'var(--red)', fontSize: 10, fontWeight: 400 }}>(required for rejection)</span></label>
//           <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} placeholder="Add notes or reason…" />
//         </div>

//         <div className="modal-footer">
//           <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
//           <button className="btn btn-danger" onClick={() => act('reject')} disabled={loading}>✕ Reject</button>
//           <button className="btn btn-primary" onClick={() => act('approve')} disabled={loading}
//             style={{ background: 'var(--green)', borderColor: 'var(--green)' }}>
//             ✓ Approve
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ─── Main Page ────────────────────────────────────────────────────────────────

// export default function AppointmentOrdersPage() {
//   const { user } = useAuth();
//   const [orders,     setOrders]     = useState([]);
//   const [employees,  setEmployees]  = useState([]);
//   const [templates,  setTemplates]  = useState([]);
//   const [loading,    setLoading]    = useState(true);
//   const [showCreate, setShowCreate] = useState(false);
//   const [reviewing,  setReviewing]  = useState(null);
//   const [success,    setSuccess]    = useState('');
//   const [error,      setError]      = useState('');

//   const isHR     = ['hr','admin'].includes(user?.role);
//   const isHRHead = ['hr_head','admin'].includes(user?.role);

//   const load = () => {
//     setLoading(true);
//     Promise.all([
//       axios.get('/api/offer/appointment-orders'),
//       axios.get('/api/employees/'),
//       axios.get('/api/templates/'),
//     ]).then(([o, e, t]) => {
//       setOrders(o.data);
//       setEmployees(e.data);
//       setTemplates(t.data.filter(x => x.is_active));
//     }).finally(() => setLoading(false));
//   };
//   useEffect(() => { load(); }, []);

//   const submitOrder = async (oid) => {
//     try {
//       await axios.post(`/api/offer/appointment-orders/${oid}/submit`);
//       load(); flash('Submitted for HR Head approval');
//     } catch (e) { setError(e.response?.data?.error || 'Submit failed'); }
//   };

//   const download = (oid, fmt) => {
//     axios.get(`/api/offer/appointment-orders/${oid}/download?format=${fmt}`, { responseType: 'blob' })
//       .then(r => {
//         const url = URL.createObjectURL(r.data);
//         const a = document.createElement('a'); a.href = url; a.download = `appointment.${fmt}`; a.click();
//         setTimeout(() => URL.revokeObjectURL(url), 1000);
//       }).catch(() => setError('Download failed'));
//   };

//   const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };
//   const onDone = (msg) => { setShowCreate(false); setReviewing(null); load(); flash(msg); };

//   const pendingCount = orders.filter(o => o.status === 'pending_hr_head').length;

//   return (
//     <div>
//       <div className="page-header">
//         <div>
//           <h1 className="page-title">Appointment Orders</h1>
//           <p className="page-subtitle">
//             {orders.length} order{orders.length !== 1 ? 's' : ''}
//             {pendingCount > 0 && isHRHead && (
//               <span style={{ marginLeft: 10, color: 'var(--amber)', fontSize: 12 }}>
//                 · {pendingCount} pending your review
//               </span>
//             )}
//           </p>
//         </div>
//         {isHR && (
//           <button className="btn btn-primary" onClick={() => { setShowCreate(true); setError(''); }}>
//             📄 Create Appointment Order
//           </button>
//         )}
//       </div>

//       {success && <div className="alert alert-success">{success}</div>}
//       {error   && <div className="alert alert-error" onClick={() => setError('')} style={{ cursor: 'pointer' }}>{error} ✕</div>}

//       {/* Workflow pipeline */}
//       <div className="workflow-pipe">
//         {[
//           { label: 'HR Creates & Fills', color: 'var(--text-muted)', active: isHR && !isHRHead },
//           { arrow: true },
//           { label: 'HR Submits',         color: 'var(--accent)',     active: isHR && !isHRHead },
//           { arrow: true },
//           { label: 'HR Head Reviews',    color: 'var(--amber)',      active: isHRHead },
//           { arrow: true },
//           { label: '✓ Approved — Download PDF', color: 'var(--green)', active: false },
//         ].map((s, i) => s.arrow ? (
//           <span key={i} className="workflow-pipe-arrow">→</span>
//         ) : (
//           <div key={i} className="workflow-pipe-step" style={{
//             background: s.active ? `${s.color}18` : 'transparent',
//             border: s.active ? `1px solid ${s.color}44` : '1px solid transparent',
//             color: s.active ? s.color : 'var(--text-dim)',
//           }}>{s.label}</div>
//         ))}
//       </div>

//       <div className="card" style={{ padding: 0 }}>
//         {loading ? <div className="page-loading"><div className="spinner" /></div> : (
//           <div className="table-wrap">
//             <table>
//               <thead>
//                 <tr>
//                   <th>Employee</th><th>Emp. Type</th><th>Location</th>
//                   <th>Status</th><th>Created</th><th>Approval Trail</th><th>Actions</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {orders.length === 0 ? (
//                   <tr><td colSpan={7}>
//                     <div className="empty-state">
//                       <div className="empty-icon">📄</div>
//                       <p>No appointment orders yet — click Create to get started</p>
//                     </div>
//                   </td></tr>
//                 ) : orders.map(o => {
//                   const cfg = STATUS_CFG[o.status] || {};
//                   return (
//                     <tr key={o._id}>
//                       <td>
//                         <div style={{ fontWeight: 500 }}>{o.employee_name}</div>
//                         <div className="mono text-muted text-sm">{o.employee_code}</div>
//                       </td>
//                       <td style={{ fontSize: 12 }}>{o.context?.employment_type || '—'}</td>
//                       <td style={{ fontSize: 12 }}>{o.context?.work_location || '—'}</td>
//                       <td><span className={`badge ${cfg.cls}`}>{cfg.label}</span></td>
//                       <td className="mono text-muted text-sm">{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
//                       <td>
//                         <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
//                           {(o.approval_history || []).map((h, i) => (
//                             <div key={i} style={{ fontSize: 11, color: h.action === 'approve' || h.action === 'submitted' ? 'var(--green)' : h.action === 'reject' ? 'var(--red)' : 'var(--text-dim)' }}>
//                               {h.user_name || h.role || 'System'} → {h.action}
//                             </div>
//                           ))}
//                           {!o.approval_history?.length && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>No actions yet</span>}
//                         </div>
//                       </td>
//                       <td>
//                         <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
//                           <button className="btn btn-sm btn-secondary" onClick={() => download(o._id, 'docx')}>↓ DOCX</button>
//                           {o.status === 'approved' && (
//                             <button className="btn btn-sm btn-secondary" onClick={() => download(o._id, 'pdf')}>↓ PDF</button>
//                           )}
//                           {o.status === 'draft' && isHR && (
//                             <button className="btn btn-sm btn-primary" onClick={() => submitOrder(o._id)}>Submit →</button>
//                           )}
//                           {o.status === 'pending_hr_head' && isHRHead && (
//                             <button className="btn btn-sm btn-primary" onClick={() => setReviewing(o)}>Review</button>
//                           )}
//                         </div>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </div>

//       {showCreate && (
//         <CreateOrderModal employees={employees} templates={templates} onClose={() => setShowCreate(false)} onDone={onDone} />
//       )}
//       {reviewing && (
//         <ReviewOrderModal order={reviewing} onClose={() => setReviewing(null)} onDone={onDone} />
//       )}
//     </div>
//   );
// }