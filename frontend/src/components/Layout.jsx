import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const NAV_HR = [
  { to: '/', icon: '⊞', label: 'Dashboard' },
  { to: '/employees', icon: '◎', label: 'Employees' },
  { to: '/templates', icon: '⌘', label: 'Templates' },
  { to: '/letters', icon: '⧉', label: 'Offer Letters' },
  { to: '/appointment', icon: '◈', label: 'Appointment Orders' },
  { to: '/approvals', icon: '✓', label: 'Approvals' },
  { to: '/exit', icon: '⇥', label: 'Exit & Relieving' },
];
const NAV_EMPLOYEE = [
  { to: '/', icon: '▦', label: 'Dashboard' },
  { to: '/letters', icon: '◎', label: 'My Offer Letters' },
  { to: '/appointment', icon: '◈', label: 'Appointment Order' },
  { to: '/documents', icon: '⬡', label: 'My Documents' },
  { to: '/exit', icon: '⇥', label: 'Exit & Relieving' },
];

const NAV_MANAGER = [
  { to: '/', icon: '▦', label: 'Dashboard' },
  { to: '/letters', icon: '◎', label: 'My Offer Letters' },
  { to: '/appointment', icon: '◈', label: 'Appointment Order' },
  { to: '/documents', icon: '⬡', label: 'My Documents' },
  { to: '/exit', icon: '⇥', label: 'Exit & Relieving' },
  { to: '/approvals', icon: '✓', label: 'Approvals' },
];

const ROLE_COLOR = {
  admin: '#2563eb',
  hr_head: '#2563eb',
  hr: '#059669',
  manager: '#7c3aed',
  employee: '#0891b2',
};

const ROLE_BG = {
  admin: 'rgba(37,99,235,.10)',
  hr_head: 'rgba(37,99,235,.10)',
  hr: 'rgba(5,150,105,.10)',
  manager: 'rgba(124,58,237,.10)',
  employee: 'rgba(8,145,178,.10)',
};

const TABS = ['Personal', 'Corporate', 'Emergency'];

// ─── NavLink — logic identical, styles updated ────────────────────────────
function NavLink({ to, icon, label, currentPath }) {
  const isActive = currentPath === to;
  return (
    <button
      onClick={() => { window.location.hash = to; }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '8px 12px', borderRadius: 8, marginBottom: 1,
        fontSize: 13.5, fontWeight: isActive ? 600 : 500,
        color: isActive ? '#2563eb' : '#64748b',
        background: isActive ? '#eff6ff' : 'transparent',
        border: `1px solid ${isActive ? '#bfdbfe' : 'transparent'}`,
        transition: 'all .13s', cursor: 'pointer', textAlign: 'left',
        letterSpacing: '-0.1px',
      }}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.color = '#1e293b';
          e.currentTarget.style.background = '#f8fafc';
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.color = '#64748b';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span style={{
        width: 20, height: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, flexShrink: 0,
        opacity: isActive ? 1 : 0.6,
      }}>
        {icon}
      </span>
      {label}
    </button>
  );
}

// ─── Field — logic identical ───────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text', half }) {
  return (
    <div className="form-group" style={{ margin: 0, gridColumn: half ? 'auto' : '1 / -1' }}>
      <label className="form-label">{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

// ─── ProfileModal — all logic identical, styles updated ───────────────────
function ProfileModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const REQUIRED_FIELDS = ['name', 'phone', 'personal_email', 'gender', 'blood_group', 'birthday', 'address'];

  const isProfileComplete = (u) => u && REQUIRED_FIELDS.every(k => u[k] && String(u[k]).trim() !== '');

  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    personal_email: user?.personal_email || '',
    gender: user?.gender || '',
    blood_group: user?.blood_group || '',
    birthday: user?.birthday || '',
    address: user?.address || '',
    emergency_contact_name: user?.emergency_contact_name || '',
    emergency_contact_phone: user?.emergency_contact_phone || '',
    emergency_contact_relation: user?.emergency_contact_relation || '',
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // const REQUIRED_FIELDS = ['name', 'phone', 'personal_email', 'gender', 'blood_group', 'birthday', 'address'];

  const missingFields = REQUIRED_FIELDS.filter(k => !form[k] || String(form[k]).trim() === '');

  const save = async () => {
    if (missingFields.length > 0) {
      setError(`Please fill all required fields: ${missingFields.map(k => ({
        name: 'Full Name', phone: 'Phone Number', personal_email: 'Personal Email',
        gender: 'Gender', blood_group: 'Blood Group', birthday: 'Date of Birth',
        address: 'Residential Address',
      }[k] || k)).join(', ')}`);
      return;
    }
    setError(''); setSuccess('');
    setSaving(true);
    try {
      await axios.put('/api/auth/profile', form);
      // Re-fetch full profile so gate re-evaluates with all fields including employee data
      const fresh = await axios.get('/api/auth/profile');
      const merged = { ...form, ...fresh.data };
      updateUser(merged);
      setForm(merged);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const rc = ROLE_COLOR[user?.role] || '#2563eb';
  const rbg = ROLE_BG[user?.role] || 'rgba(37,99,235,.10)';

  return (
    <div className="modal-overlay" onClick={e => {
      if (e.target !== e.currentTarget) return;
      // Block closing if profile is incomplete for employee/manager
      const isGated = ['employee', 'manager'].includes(user?.role) && missingFields.length > 0;
      if (!isGated) onClose();
    }}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 0 }}>

        {/* Header */}
        <div style={{ padding: '22px 24px 0', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>

            {/* Avatar */}
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: rbg, border: `2px solid ${rc}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, color: rc,
              fontFamily: 'var(--display)',
            }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>

            {/* Name + role */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--display)', fontWeight: 700,
                fontSize: 15.5, color: '#0f172a', letterSpacing: '-0.3px',
              }}>
                {user?.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                  textTransform: 'uppercase', color: rc,
                  background: rbg, padding: '2px 8px', borderRadius: 99,
                  border: `1px solid ${rc}30`,
                }}>
                  {user?.role}
                </span>
                {user?.emp_code && (
                  <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#94a3b8' }}>
                    {user.emp_code}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                {user?.email}
              </div>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 7,
                border: '1px solid #e2e8f0', background: 'transparent',
                color: '#64748b', cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .13s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
            >
              ✕
            </button>
          </div>

          {/* Tab strip */}
          <div style={{ display: 'flex' }}>
            {TABS.map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(i)}
                style={{
                  padding: '8px 18px', fontSize: 12.5, fontWeight: 600,
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: `2px solid ${tab === i ? '#2563eb' : 'transparent'}`,
                  color: tab === i ? '#2563eb' : '#64748b',
                  transition: 'all .13s', letterSpacing: '-0.1px',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts */}
        {error && <div className="alert alert-error" style={{ margin: '14px 24px 0' }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ margin: '14px 24px 0' }}>{success}</div>}

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>

          {/* Personal */}
          {tab === 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Full Name *" value={form.name} onChange={v => set('name', v)} half />
              <Field label="Phone Number *" value={form.phone} onChange={v => set('phone', v)} half />
              <Field label="Work Email *" value={form.personal_email} onChange={v => set('personal_email', v)} type="email" half />
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Gender *</label>
                <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">Select…</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                  <option>Prefer not to say</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Blood Group *</label>
                <select value={form.blood_group} onChange={e => set('blood_group', e.target.value)}>
                  <option value="">Select…</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <Field label="Date of Birth *" value={form.birthday} onChange={v => set('birthday', v)} type="date" half />
              {/* Joining Date — read only from employee record */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Joining Date</label>
                <input value={(() => {
                  const d = user?.joining_date;
                  if (!d || d === '—') return '—';
                  // Handle DD-MM-YYYY format from backend
                  const parts = d.split(/[-/]/);
                  if (parts.length === 3 && parts[0].length === 2) {
                    return `${parts[0]}-${parts[1]}-${parts[2]}`;
                  }
                  try {
                    const parsed = new Date(d);
                    if (!isNaN(parsed)) return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  } catch { }
                  return d;
                })()} readOnly
                  style={{ background: 'var(--surface-2)', color: 'var(--text-dim)', cursor: 'not-allowed' }} />
              </div>
              <Field label="Residential Address *" value={form.address} onChange={v => set('address', v)} />
            </div>
          )}

          {/* Corporate */}
          {tab === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['Personal Email', user?.email],
                ['Employee ID', user?.emp_code],
                ['Designation', user?.designation],
                ['Department', user?.department],
                ['Joining Date', user?.joining_date],
                ['Role', user?.role],
              ].map(([label, val]) => (
                <div key={label} className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{label}</label>
                  <input
                    value={val || '—'} readOnly
                    style={{ background: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed', border: '1.5px solid #e2e8f0' }}
                  />
                </div>
              ))}
              <div style={{
                gridColumn: '1 / -1', padding: '10px 14px',
                background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: 8, fontSize: 12, color: '#2563eb', fontWeight: 500,
              }}>
                Corporate details are managed by HR and cannot be edited here.
              </div>
            </div>
          )}

          {/* Emergency */}
          {tab === 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Contact Name" value={form.emergency_contact_name} onChange={v => set('emergency_contact_name', v)} half />
              <Field label="Contact Phone" value={form.emergency_contact_phone} onChange={v => set('emergency_contact_phone', v)} half />
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Relation</label>
                <select value={form.emergency_contact_relation}
                  onChange={e => set('emergency_contact_relation', e.target.value)}>
                  <option value="">Select…</option>
                  {['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Other'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div style={{
                gridColumn: '1 / -1', padding: '10px 14px',
                background: '#fffbeb', border: '1px solid #fde68a',
                borderRadius: 8, fontSize: 12, color: '#d97706', fontWeight: 500,
              }}>
                This information is used only in case of emergency and kept strictly confidential.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          background: '#f8fafc', position: 'sticky', bottom: 0,
        }}>
          {(!['employee', 'manager'].includes(user?.role) || missingFields.length === 0) && (
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          )}
          {tab !== 1 && (
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────
const REQUIRED_PROFILE_FIELDS = ['name', 'phone', 'personal_email', 'gender', 'blood_group', 'birthday', 'address'];

const isProfileComplete = (u) =>
  u && REQUIRED_PROFILE_FIELDS.every(k => u[k] && String(u[k]).trim() !== '');

export default function Layout({ children, currentPath }) {
  const { user, logout } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const rc = ROLE_COLOR[user?.role] || '#4f8ef7';

  const needsProfileGate = ['employee', 'manager'].includes(user?.role) && !isProfileComplete(user);
  const rbg = ROLE_BG[user?.role] || 'rgba(37,99,235,.10)';

  const NAV = user?.role === 'employee' ? NAV_EMPLOYEE
    : user?.role === 'manager' ? NAV_MANAGER
      : NAV_HR;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8fafc' }}>

      {/* ══ Sidebar ══ */}
      <aside style={{
        width: 228, flexShrink: 0,
        background: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Logo */}
        <div style={{
          padding: '18px 18px 16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <img
            src="/infopaceee.jpg"
            alt="Logo"
            style={{
              width: 60, height: 60, borderRadius: 6, flexShrink: 0,
              objectFit: 'contain'
            }}
          />
          <div>
            <div style={{
              fontFamily: 'var(--display)', fontWeight: 800,
              fontSize: 15, letterSpacing: '-0.4px', color: '#0f172a', lineHeight: 1,
            }}>
              HR Automation
            </div>
            <div style={{
              fontSize: 9.5, color: '#94a3b8',
              fontFamily: 'var(--mono)', marginTop: 2,
              textTransform: 'uppercase', letterSpacing: '1px',
            }}>
              {user?.role === 'employee' ? 'Employee Portal'
                : user?.role === 'manager' ? 'Manager Portal'
                  : 'Infopace '}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px', overflowY: 'auto' }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700, color: '#cbd5e1',
            textTransform: 'uppercase', letterSpacing: '1.2px',
            padding: '8px 12px 5px',
          }}>
            Menu
          </div>
          {NAV.map(item => (
            <NavLink key={item.to} {...item} currentPath={currentPath} />
          ))}
        </nav>

        {/* User block */}
        <div style={{ padding: '10px 10px 12px', borderTop: '1px solid #e2e8f0' }}>

          {/* Profile button — click handler unchanged */}
          <button
            onClick={() => setShowProfile(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', marginBottom: 7,
              padding: '8px 10px', borderRadius: 9,
              background: 'transparent', border: '1px solid transparent',
              cursor: 'pointer', transition: 'all .13s', textAlign: 'left',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: rbg, border: `1.5px solid ${rc}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, color: rc,
              fontFamily: 'var(--display)',
            }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>

            {/* Name / role */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 12.5, fontWeight: 600, color: '#0f172a',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                letterSpacing: '-0.1px',
              }}>
                {user?.name}
              </div>
              <div style={{
                fontSize: 10, color: rc, fontFamily: 'var(--mono)',
                textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 1,
              }}>
                {user?.role}
              </div>
            </div>

            <span style={{ fontSize: 12, color: '#cbd5e1', flexShrink: 0 }}>›</span>
          </button>

          {/* Sign out — click handler unchanged */}
          <button
            onClick={() => { logout(); window.location.hash = '/'; }}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 8,
              background: 'transparent', border: '1px solid #e2e8f0',
              color: '#94a3b8', fontSize: 12.5, fontWeight: 500,
              cursor: 'pointer', transition: 'all .13s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#fca5a5';
              e.currentTarget.style.color = '#dc2626';
              e.currentTarget.style.background = '#fef2f2';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: 11 }}>⇥</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* ══ Main ══ */}
      <main style={{
        flex: 1, overflow: 'auto',
        background: '#f8fafc',
        padding: '28px 32px',
      }}>
        {children}
      </main>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}

      {/* ── Mandatory profile gate ── */}
      {/* ── Mandatory profile gate ── */}
      {needsProfileGate && !showProfile && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16,
            padding: '32px 36px', maxWidth: 480, width: '92%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>👋</div>
              <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>
                Complete Your Profile
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                Please fill in all your personal details before continuing.
                This information is required to proceed.
              </p>
            </div>

            <div style={{
              background: 'var(--surface-2)', borderRadius: 10,
              padding: '14px 18px', marginBottom: 24,
            }}>
              <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 10 }}>
                Missing Fields
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {REQUIRED_PROFILE_FIELDS
                  .filter(k => !user?.[k] || String(user[k]).trim() === '')
                  .map(k => ({
                    name: 'Full Name', phone: 'Phone Number',
                    personal_email: 'Personal Email', gender: 'Gender',
                    blood_group: 'Blood Group', birthday: 'Date of Birth',
                    address: 'Residential Address',
                  }[k] || k))
                  .map(label => (
                    <span key={label} style={{
                      padding: '3px 10px', borderRadius: 20,
                      background: 'rgba(240,82,82,.1)',
                      border: '1px solid rgba(240,82,82,.25)',
                      fontSize: 12, color: 'var(--red)',
                    }}>
                      {label}
                    </span>
                  ))}
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '13px 0', fontSize: 14 }}
              onClick={() => setShowProfile(true)}
            >
              Fill in My Details →
            </button>
          </div>
        </div>
      )}

      {/* Profile modal renders on top of gate with higher z-index */}
      {needsProfileGate && showProfile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000 }}>
          <ProfileModal onClose={() => setShowProfile(false)} />
        </div>
      )}
    </div>
  );
}