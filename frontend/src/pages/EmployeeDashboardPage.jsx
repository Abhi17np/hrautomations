import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

/**
 * EmployeeDashboardPage
 * ─────────────────────
 * Shown exclusively to users with role = 'employee'.
 * Replaces the full HR Layout — employees only see their own documents.
 *
 * Left sidebar navigation:
 *   ◈  Offer Letters
 *   📄  Appointment Order
 *   ○  Exit / Relieving Letter
 */

const SECTIONS = [
  {
    key:   'offer',
    icon:  '◈',
    label: 'Offer Letters',
    desc:  'View and download your offer letters',
  },
  {
    key:   'appointment',
    icon:  '📄',
    label: 'Appointment Order',
    desc:  'Your appointment confirmation from HR',
  },
  {
    key:   'relieving',
    icon:  '○',
    label: 'Exit / Relieving Letter',
    desc:  'Issued upon completion of exit formalities',
  },
];

const STATUS_CFG = {
  draft:           { label: 'Draft',           cls: 'badge-gray'  },
  pending_manager: { label: 'Pending Manager', cls: 'badge-amber' },
  pending_hr_head: { label: 'Pending HR Head', cls: 'badge-amber' },
  approved:        { label: 'Approved',        cls: 'badge-green' },
  issued:          { label: 'Issued',          cls: 'badge-green' },
  rejected:        { label: 'Rejected',        cls: 'badge-red'   },
};

const fmtINR = (n) => n != null && n !== '' ? `₹${Number(n).toLocaleString('en-IN')}` : null;

// ── Empty state per section ───────────────────────────────────────────────────

const EMPTY_COPY = {
  offer: {
    icon: '◈',
    title: 'No offer letters available yet',
    sub: 'Your HR team will share your approved offer letter here once the approval process is complete.',
  },
  appointment: {
    icon: '📄',
    title: 'No appointment order yet',
    sub: 'Your appointment order will appear here after HR creates and approves it for you.',
  },
  relieving: {
    icon: '○',
    title: 'No exit / relieving letter',
    sub: 'Your relieving letter will be generated here once your exit clearance process is fully completed.',
  },
};

// ── Document Card ─────────────────────────────────────────────────────────────

function DocCard({ doc, section, onDownload }) {
  const cfg = STATUS_CFG[doc.status] || { label: doc.status, cls: 'badge-gray' };
  const canDownloadPDF = ['approved','issued'].includes(doc.status);

  const title = section === 'offer'
    ? `Offer Letter — Version ${doc.version}`
    : section === 'appointment'
    ? 'Appointment Order'
    : 'Relieving Letter';

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      marginBottom: 16,
      transition: 'border-color 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Title + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{title}</h3>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Generated {new Date(doc.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <span className={`badge ${cfg.cls}`} style={{ flexShrink: 0 }}>{cfg.label}</span>
      </div>

      {/* Key details grid */}
      {doc.context && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            ['Designation',   doc.context.designation],
            ['Department',    doc.context.department],
            ['Joining Date',  doc.context.joining_date],
            section === 'offer'        ? ['Annual CTC',     fmtINR(doc.context.ctc)]       : null,
            section === 'offer'        ? ['Basic Salary',   fmtINR(doc.context.basic)]     : null,
            section === 'offer'        ? ['HRA',            fmtINR(doc.context.hra)]       : null,
            section === 'relieving'    ? ['Last Working Day', doc.context.last_working_day] : null,
            section === 'appointment'  ? ['Employment Type', doc.context.employment_type]  : null,
            section === 'appointment'  ? ['Work Location',  doc.context.work_location]     : null,
            section === 'appointment'  ? ['Reports To',     doc.context.reporting_manager] : null,
          ].filter(Boolean).filter(([, v]) => v).map(([k, v]) => (
            <div key={k} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Salary breakdown for offer letters */}
      {section === 'offer' && doc.context && (doc.context.basic || doc.context.hra) && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Salary Breakdown
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              ['Basic',      doc.context.basic],
              ['HRA',        doc.context.hra],
              ['DA',         doc.context.da],
              ['Employer PF',doc.context.employer_pf],
              ['Allowances', doc.context.allowances],
            ].filter(([,v]) => v).map(([k, v]) => (
              <div key={k} style={{ background: 'var(--surface-2)', borderRadius: 6, padding: '6px 12px', fontSize: 12 }}>
                <span style={{ color: 'var(--text-dim)' }}>{k}: </span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--mono)' }}>{fmtINR(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" onClick={() => onDownload(doc._id, section, 'docx')}>
          ↓ Download DOCX
        </button>
        {canDownloadPDF && (
          <button className="btn btn-primary" onClick={() => onDownload(doc._id, section, 'pdf')}>
            ↓ Download PDF
          </button>
        )}
        {!canDownloadPDF && (
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text-dim)', gap: 6 }}>
            <span style={{ fontSize: 14 }}>⏳</span>
            PDF available after approval
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function EmployeeDashboardPage() {
  const { user, logout } = useAuth();
  const [activeSection, setSection] = useState('offer');
  const [docs,    setDocs]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    axios.get('/api/offer/my-documents')
      .then(r => setDocs(r.data))
      .catch(() => setError('Could not load your documents. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const download = async (id, section, fmt) => {
    const url = (section === 'appointment')
      ? `/api/offer/appointment-orders/${id}/download?format=${fmt}`
      : `/api/letters/${id}/download?format=${fmt}`;
    try {
      const r = await axios.get(url, { responseType: 'blob' });
      const burl = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = burl;
      a.download = `${section}_document.${fmt}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(burl), 1000);
    } catch {
      setError('File is not available for download yet. Please contact HR.');
    }
  };

  const sectionDocs = {
    offer:       docs?.offer_letters      || [],
    appointment: docs?.appointment_orders || [],
    relieving:   docs?.relieving_letters  || [],
  };

  const counts = {
    offer:       sectionDocs.offer.length,
    appointment: sectionDocs.appointment.length,
    relieving:   sectionDocs.relieving.length,
  };

  return (
    <div className="emp-portal">

      {/* ── Left Sidebar ── */}
      <div className="emp-portal-sidebar">
        {/* Logo + greeting */}
        <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--accent-dim)', border: '1px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: 'var(--accent)',
            }}>◈</div>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 14 }}>
              HR<span style={{ color: 'var(--accent)' }}>Letters</span>
            </div>
          </div>

          {/* Employee avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'var(--green-dim)', border: '2px solid var(--green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700, color: 'var(--green)', flexShrink: 0,
            }}>
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 1 }}>{user?.email}</div>
            </div>
          </div>
        </div>

        {/* Nav label */}
        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, paddingLeft: 4 }}>
          My Documents
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1 }}>
          {SECTIONS.map(sec => (
            <button key={sec.key}
              className={`emp-nav-btn ${activeSection === sec.key ? 'active' : ''}`}
              onClick={() => { setSection(sec.key); setError(''); }}
            >
              <span style={{ fontSize: 17, minWidth: 22, textAlign: 'center' }}>{sec.icon}</span>
              <div>
                <div style={{ lineHeight: 1.3 }}>{sec.label}</div>
                {counts[sec.key] > 0 && (
                  <div style={{ fontSize: 10, color: activeSection === sec.key ? 'rgba(79,142,247,0.7)' : 'var(--text-dim)', marginTop: 1 }}>
                    {counts[sec.key]} document{counts[sec.key] !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </button>
          ))}
        </nav>

        {/* Sign out */}
        <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={logout}>
            Sign out
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="emp-portal-main">
        {/* Section header */}
        {(() => {
          const sec = SECTIONS.find(s => s.key === activeSection);
          return (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28 }}>{sec.icon}</span>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 3 }}>{sec.label}</h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{sec.desc}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

        {loading ? (
          <div className="page-loading"><div className="spinner" /></div>
        ) : sectionDocs[activeSection].length === 0 ? (
          // Empty state
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>
              {EMPTY_COPY[activeSection].icon}
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
              {EMPTY_COPY[activeSection].title}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 380, margin: '0 auto' }}>
              {EMPTY_COPY[activeSection].sub}
            </p>
          </div>
        ) : (
          // Documents list
          sectionDocs[activeSection].map(doc => (
            <DocCard key={doc._id} doc={doc} section={activeSection} onDownload={download} />
          ))
        )}

        {/* Helpful info box at the bottom */}
        <div style={{ marginTop: 28, padding: '14px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>💡 Help</div>
          PDFs are available for download after your document is approved or issued by HR.
          For questions about your offer or appointment, please contact your HR team directly.
        </div>
      </div>
    </div>
  );
}
