/**
 * DashboardPage.jsx — Role-specific dashboards (Redesigned)
 *
 * admin / hr_head  → HR Command Centre
 * manager          → Team Dashboard
 * employee         → My Portal
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const nav = (path) => { window.location.hash = path; };

const TODAY = new Date().toLocaleDateString('en-IN', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—';
  try {
    const parts = d.split(/[-/]/);
    let date;
    if (parts.length === 3 && parts[0].length === 2) {
      date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
      date = new Date(d);
    }
    if (isNaN(date)) return d;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

const STATUS_CONFIG = {
  active: { label: 'Active', bg: '#dcfce7', color: '#16a34a', dot: '#22c55e' },
  approved: { label: 'Approved', bg: '#dcfce7', color: '#16a34a', dot: '#22c55e' },
  issued: { label: 'Issued', bg: '#dcfce7', color: '#16a34a', dot: '#22c55e' },
  pending_hr_head: { label: 'Pending HR', bg: '#fef9c3', color: '#a16207', dot: '#eab308' },
  pending_manager: { label: 'Pending Manager', bg: '#fef9c3', color: '#a16207', dot: '#eab308' },
  resignation_pending: { label: 'Resignation', bg: '#fef9c3', color: '#a16207', dot: '#eab308' },
  notice_period: { label: 'Notice Period', bg: '#fff7ed', color: '#c2410c', dot: '#f97316' },
  clearance_pending: { label: 'Clearance', bg: '#fce7f3', color: '#be185d', dot: '#ec4899' },
  clearance_complete: { label: 'All Cleared', bg: '#eff6ff', color: '#1d4ed8', dot: '#3b82f6' },
  rejected: { label: 'Rejected', bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
  exited: { label: 'Exited', bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
  inactive: { label: 'Inactive', bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
  draft: { label: 'Draft', bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
};

function Badge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status?.replace(/_/g, ' ') || '—', bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
// gradient prop format: "linear-gradient(...)" — we extract the accent color from it
// for the light card style (tinted bg + colored text).
const ACCENT_COLORS = {
  blue: { bg: '#eff6ff', border: '#bfdbfe', num: '#1d4ed8', label: '#1e40af', sub: '#60a5fa' },
  green: { bg: '#f0fdf4', border: '#bbf7d0', num: '#15803d', label: '#166534', sub: '#4ade80' },
  amber: { bg: '#fffbeb', border: '#fde68a', num: '#b45309', label: '#92400e', sub: '#fbbf24' },
  purple: { bg: '#faf5ff', border: '#ddd6fe', num: '#6d28d9', label: '#5b21b6', sub: '#a78bfa' },
  orange: { bg: '#fff7ed', border: '#fed7aa', num: '#c2410c', label: '#9a3412', sub: '#fb923c' },
  pink: { bg: '#fdf2f8', border: '#fbcfe8', num: '#be185d', label: '#9d174d', sub: '#f472b6' },
  slate: { bg: '#f8fafc', border: '#e2e8f0', num: '#475569', label: '#334155', sub: '#94a3b8' },
  red: { bg: '#fef2f2', border: '#fecaca', num: '#dc2626', label: '#991b1b', sub: '#f87171' },
};

function getAccent(gradient) {
  if (!gradient) return ACCENT_COLORS.blue;
  if (gradient.includes('#8b5cf6') || gradient.includes('#7c3aed') || gradient.includes('#6366f1') || gradient.includes('#764ba2')) return ACCENT_COLORS.purple;
  if (gradient.includes('#10b981') || gradient.includes('#059669')) return ACCENT_COLORS.green;
  if (gradient.includes('#f59e0b') && !gradient.includes('#ef4444') && !gradient.includes('#dc2626')) return ACCENT_COLORS.amber;
  if (gradient.includes('#f97316') || gradient.includes('#ea580c')) return ACCENT_COLORS.orange;
  if (gradient.includes('#ec4899') || gradient.includes('#be185d')) return ACCENT_COLORS.pink;
  if (gradient.includes('#ef4444') || gradient.includes('#dc2626')) return ACCENT_COLORS.red;
  if (gradient.includes('#94a3b8') || gradient.includes('#64748b')) return ACCENT_COLORS.slate;
  return ACCENT_COLORS.blue;
}

// SVG icon set — clean, professional, no emojis
const ICONS = {
  users: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  check: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  clock: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  target: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
  file: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  clipboard: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>,
  mail: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
  bell: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  alert: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><triangle points="10.29 3.86 1.82 18 22.18 18" /><path d="M10.29 3.86 1.82 18 22.18 18H1.82" /><path d="M12 9v4" /><path d="M12 17h.01" /><polygon points="10.29 3.86 1.82 18 22.18 18" /></svg>,
  refresh: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>,
  folder: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  exit: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
};

// Map old emoji strings to icon keys
function resolveIcon(icon, accentColor) {
  const color = accentColor || '#64748b';
  const map = {
    '👥': ICONS.users, '✅': ICONS.check, '⏳': ICONS.clock, '🎯': ICONS.target,
    '📄': ICONS.file, '📋': ICONS.clipboard, '✉️': ICONS.mail, '🔔': ICONS.bell,
    '⚠️': ICONS.alert, '🔄': ICONS.refresh, '🗂': ICONS.folder,
  };
  const fn = map[icon] || ICONS.file;
  return fn(color);
}

function StatCard({ value, label, sub, gradient, icon, onClick, urgent }) {
  const ac = getAccent(gradient);
  return (
    <div onClick={onClick}
      style={{
        background: ac.bg,
        border: `1.5px solid ${ac.border}`,
        borderRadius: 16, padding: '20px 22px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .18s, box-shadow .18s',
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.09)'; } }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; }}
    >
      {urgent && (
        <div style={{ position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
      )}
      <div style={{ marginBottom: 12, opacity: 0.85 }}>{resolveIcon(icon, ac.num)}</div>
      <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, letterSpacing: -1, marginBottom: 6, color: ac.num }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: ac.label }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: ac.sub, marginTop: 3, fontFamily: 'monospace' }}>{sub}</div>}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionTitle({ children, action, actionLabel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 3, height: 18, background: 'linear-gradient(180deg, #4f8ef7, #a855f7)', borderRadius: 99 }} />
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: '#374151' }}>
          {children}
        </span>
      </div>
      {action && (
        <button onClick={action} style={{
          padding: '5px 14px', background: 'transparent', border: '1.5px solid #e2e8f0',
          borderRadius: 8, fontSize: 11, fontWeight: 600, color: '#4f8ef7', cursor: 'pointer',
          transition: 'all .15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#4f8ef7'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
        >
          {actionLabel || 'View all →'}
        </button>
      )}
    </div>
  );
}

// ─── Pipeline Bar ─────────────────────────────────────────────────────────────
function PipelineBar({ stages }) {
  const total = stages.reduce((a, s) => a + s.count, 0) || 1;
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {stages.map(s => (
        <div key={s.label} style={{ flex: 1, minWidth: 90 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{s.label}</span>
            <span style={{
              fontWeight: 800, fontSize: 13, fontFamily: 'monospace',
              background: s.count > 0 ? s.color + '20' : 'transparent',
              color: s.count > 0 ? s.color : '#9ca3af',
              padding: '1px 7px', borderRadius: 6,
            }}>{s.count}</span>
          </div>
          <div style={{ height: 7, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${Math.max((s.count / total) * 100, s.count > 0 ? 5 : 0)}%`,
              background: s.color, borderRadius: 99, transition: 'width .6s cubic-bezier(.4,0,.2,1)',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9',
      boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      transition: onClick ? 'box-shadow .15s, transform .15s' : undefined,
      cursor: onClick ? 'pointer' : 'default',
      overflow: 'hidden',
      ...style,
    }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
      onMouseLeave={e => { if (onClick) { e.currentTarget.style.boxShadow = '0 1px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none'; } }}
    >
      {children}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
function Table({ headers, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
            {headers.map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f9fafb', transition: 'background .1s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '11px 16px', verticalAlign: 'middle' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ padding: '36px 20px', textAlign: 'center' }}>
      <div style={{ marginBottom: 10, opacity: 0.35, display: 'flex', justifyContent: 'center' }}>
        <div style={{ transform: 'scale(1.8)' }}>{resolveIcon(icon, '#94a3b8')}</div>
      </div>
      <div style={{ fontWeight: 600, color: '#374151', fontSize: 14 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────
function AlertBanner({ icon, title, sub, color, btnLabel, btnColor, onBtn }) {
  return (
    <div style={{
      background: color + '10', border: `1.5px solid ${color}30`,
      borderRadius: 14, padding: '14px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ flexShrink: 0 }}>{resolveIcon(icon, color)}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: color }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{sub}</div>}
      </div>
      {btnLabel && (
        <button onClick={onBtn} style={{
          padding: '8px 16px', background: btnColor || color, border: 'none',
          borderRadius: 9, fontSize: 12, fontWeight: 700, color: '#fff',
          cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          boxShadow: `0 2px 8px ${color}40`,
        }}>
          {btnLabel}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HR HEAD / ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function HRDashboard({ user }) {
  const [data, setData] = useState({
    employees: [], letterStats: {}, aoOrders: [], exitEmployees: [],
    pendingResign: [], pendingLetters: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      axios.get('/api/employees/'),
      axios.get('/api/approvals/stats'),
      axios.get('/api/appointment-orders/'),
      axios.get('/api/exit/'),
      axios.get('/api/exit/pending-approvals'),
      axios.get('/api/approvals/pending'),
    ]).then(([emps, stats, ao, exit, resign, pending]) => {
      setData({
        employees: emps.value?.data || [],
        letterStats: stats.value?.data || {},
        aoOrders: ao.value?.data || [],
        exitEmployees: exit.value?.data || [],
        pendingResign: resign.value?.data || [],
        pendingLetters: pending.value?.data || [],
      });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#4f8ef7', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading dashboard…</div>
      </div>
    </div>
  );

  const { employees, letterStats, aoOrders, exitEmployees, pendingResign, pendingLetters } = data;

  const active = employees.filter(e => e.status === 'active').length;
  const exiting = employees.filter(e => ['resignation_pending', 'notice_period', 'clearance_pending', 'clearance_complete'].includes(e.status)).length;
  const exited = employees.filter(e => e.status === 'exited').length;
  const totalEmp = employees.length;
  const pendingAO = aoOrders.filter(o => o.status === 'pending_hr_head').length;
  const totalAO = aoOrders.length;
  const approvedAO = aoOrders.filter(o => o.status === 'approved').length;
  const pendingLetCount = pendingLetters.length;
  const totalPending = pendingLetCount + pendingAO + pendingResign.length;
  const allCleared = exitEmployees.filter(e => e.status === 'clearance_complete').length;
  const noticePeriod = exitEmployees.filter(e => e.status === 'notice_period').length;
  const recentLetters = [...(data.pendingLetters || [])].slice(0, 5);

  return (
    <div style={{ maxWidth: 1200 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
          HR Command Centre
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: '#111827', letterSpacing: -0.5 }}>
              Good morning, {user?.name?.split(' ')[0]}
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9ca3af' }}>{TODAY}</p>
          </div>
          {totalPending > 0 && (
            <AlertBanner
              icon="🔔"
              title={`${totalPending} items need your attention`}
              sub="Pending approvals across all modules"
              color="#ef4444"
              btnLabel="Review Now →"
              onBtn={() => nav('/approvals')}
            />
          )}
        </div>
      </div>

      {/* ── Org Snapshot ── */}
      <SectionTitle action={() => nav('/employees')} actionLabel="View employees →">Organisation Snapshot</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
        <StatCard value={totalEmp} label="Total Employees" sub="all records" gradient="linear-gradient(135deg, #4f8ef7 0%, #6366f1 100%)" icon="👥" onClick={() => nav('/employees')} />
        <StatCard value={active} label="Active" sub="currently employed" gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)" icon="✅" onClick={() => nav('/employees')} />
        <StatCard value={exiting} label="In Exit Pipeline" sub="notice to clearance" gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" icon="⏳" onClick={() => nav('/exit')} urgent={exiting > 0} />
        <StatCard value={allCleared} label="Ready to Relieve" sub="all clearances done" gradient="linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)" icon="🎯" onClick={() => nav('/exit')} urgent={allCleared > 0} />
      </div>

      {/* ── Pending Actions ── */}
      <SectionTitle action={() => nav('/approvals')} actionLabel="Go to Approvals →">Pending Actions</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 32 }}>
        <StatCard value={pendingLetCount} label="Offer Letters" sub="awaiting HR approval" gradient="linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)" icon="📄" onClick={() => nav('/approvals')} urgent={pendingLetCount > 0} />
        <StatCard value={pendingAO} label="Appointment Orders" sub="awaiting HR approval" gradient="linear-gradient(135deg, #f97316 0%, #dc2626 100%)" icon="📋" onClick={() => nav('/approvals')} urgent={pendingAO > 0} />
        <StatCard value={pendingResign.length} label="Resignations" sub="pending approval" gradient="linear-gradient(135deg, #ec4899 0%, #dc2626 100%)" icon="✉️" onClick={() => nav('/approvals')} urgent={pendingResign.length > 0} />
      </div>

      {/* ── Two column ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

        {/* Exit pipeline */}
        <Card style={{ padding: '22px 24px' }}>
          <SectionTitle action={() => nav('/exit')} actionLabel="Manage →">Exit Pipeline</SectionTitle>
          <PipelineBar stages={[
            { label: 'Notice Period', count: noticePeriod, color: '#f59e0b' },
            { label: 'Clearance', count: exitEmployees.filter(e => e.status === 'clearance_pending').length, color: '#ec4899' },
            { label: 'All Cleared', count: allCleared, color: '#10b981' },
            { label: 'Exited', count: exited, color: '#94a3b8' },
          ]} />
          {allCleared > 0 && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, fontSize: 12, color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              {allCleared} employee{allCleared !== 1 ? 's' : ''} cleared — generate relieving letter
            </div>
          )}
        </Card>

        {/* Letter pipeline */}
        <Card style={{ padding: '22px 24px' }}>
          <SectionTitle action={() => nav('/letters')} actionLabel="View letters →">Offer Letter Pipeline</SectionTitle>
          <PipelineBar stages={[
            { label: 'Draft', count: letterStats.draft || 0, color: '#94a3b8' },
            { label: 'Pending', count: letterStats.pending_hr_head || 0, color: '#f59e0b' },
            { label: 'Approved', count: letterStats.approved || 0, color: '#4f8ef7' },
            { label: 'Issued', count: letterStats.issued || 0, color: '#10b981' },
          ]} />
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Total Orders', value: totalAO, color: '#4f8ef7' },
              { label: 'Approved Orders', value: approvedAO, color: '#10b981' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: color + '0d', border: '1px solid ' + color + '30', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 4 }}>Appointment {label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Pending Resignations ── */}
      {pendingResign.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, background: '#fef2f2', borderRadius: '50%' }}>{ICONS.alert('#dc2626')}</span>
                Pending Resignations
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Requires your review and action</div>
            </div>
            <button onClick={() => nav('/approvals')} style={{ padding: '7px 16px', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 9, fontSize: 12, fontWeight: 700, color: '#dc2626', cursor: 'pointer' }}>
              Review All →
            </button>
          </div>
          <Table
            headers={['Employee', 'Designation', 'Resigned On', 'Last Working Day', 'Reason']}
            rows={pendingResign.slice(0, 5).map(e => [
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{e.name}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{e.employee_id}</div>
              </div>,
              <span style={{ color: '#374151', fontSize: 13 }}>{e.designation}</span>,
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#374151' }}>{fmtDate(e.resignation_date)}</span>,
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#d97706', fontWeight: 600 }}>{fmtDate(e.last_working_day)}</span>,
              <span style={{ fontSize: 12, color: '#6b7280' }}>{e.exit_reason || '—'}</span>,
            ])}
          />
        </Card>
      )}

      {/* ── Recent Offer Letters ── */}
      <Card>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Recent Pending Offer Letters</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Submitted for your review</div>
          </div>
          <button onClick={() => nav('/approvals')} style={{ padding: '7px 16px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 12, fontWeight: 600, color: '#4f8ef7', cursor: 'pointer' }}>
            View all →
          </button>
        </div>
        {recentLetters.length === 0 ? (
          <EmptyState icon="✅" title="No pending offer letters" sub="All caught up! Nothing needs your approval." />
        ) : (
          <Table
            headers={['Employee', 'Designation', 'Status', 'Submitted']}
            rows={recentLetters.map(l => [
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{l.employee_name}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{l.employee_code}</div>
              </div>,
              <span style={{ color: '#374151', fontSize: 13 }}>{l.designation || '—'}</span>,
              <Badge status={l.status} />,
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#9ca3af' }}>{fmtDate(l.created_at)}</span>,
            ])}
          />
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MANAGER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function ManagerDashboard({ user }) {
  const [data, setData] = useState({ pendingResign: [], exitPipeline: [], aoOrders: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      axios.get('/api/exit/pending-approvals'),
      axios.get('/api/exit/'),
      axios.get('/api/appointment-orders/'),
    ]).then(([resign, exit, ao]) => {
      setData({
        pendingResign: resign.value?.data || [],
        exitPipeline: exit.value?.data || [],
        aoOrders: ao.value?.data || [],
      });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#4f8ef7', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading dashboard…</div>
      </div>
    </div>
  );

  const { pendingResign, exitPipeline, aoOrders } = data;
  const inNotice = exitPipeline.filter(e => e.status === 'notice_period').length;
  const inClearance = exitPipeline.filter(e => ['clearance_pending', 'clearance_complete'].includes(e.status)).length;
  const aoMine = aoOrders.filter(o => o.status === 'approved').length;

  return (
    <div style={{ maxWidth: 1200 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Team Dashboard</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: '#111827', letterSpacing: -0.5 }}>
              Hi, {user?.name?.split(' ')[0]}
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9ca3af' }}>{TODAY}</p>
          </div>
          {pendingResign.length > 0 && (
            <AlertBanner
              icon="⚠️"
              title={`${pendingResign.length} resignation${pendingResign.length !== 1 ? 's' : ''} awaiting your approval`}
              sub="Action required from you as manager"
              color="#f59e0b"
              btnLabel="Review →"
              btnColor="#d97706"
              onBtn={() => nav('/approvals')}
            />
          )}
        </div>
      </div>

      {/* ── Metrics ── */}
      <SectionTitle>Team Overview</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
        <StatCard value={pendingResign.length} label="Pending Resignations" sub="need your approval" gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" icon="✉️" onClick={() => nav('/approvals')} urgent={pendingResign.length > 0} />
        <StatCard value={inNotice} label="Serving Notice" sub="in notice period" gradient="linear-gradient(135deg, #f97316 0%, #ea580c 100%)" icon="⏳" onClick={() => nav('/exit')} />
        <StatCard value={inClearance} label="In Clearance" sub="dept clearances" gradient="linear-gradient(135deg, #4f8ef7 0%, #6366f1 100%)" icon="🔄" onClick={() => nav('/exit')} />
        <StatCard value={aoMine} label="Orders Approved" sub="appointment orders" gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)" icon="✅" onClick={() => nav('/appointment')} />
      </div>

      {/* ── Pending Resignations Table ── */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Team Resignation Requests</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Approve or reject your team's resignation applications</div>
          </div>
          <button onClick={() => nav('/approvals')} style={{ padding: '7px 16px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 9, fontSize: 12, fontWeight: 700, color: '#1d4ed8', cursor: 'pointer' }}>
            Go to Approvals →
          </button>
        </div>
        {pendingResign.length === 0 ? (
          <EmptyState icon="✅" title="No pending resignations" sub="Your team has no pending resignation requests." />
        ) : (
          <Table
            headers={['Employee', 'Designation', 'Resignation Date', 'Last Working Day', 'Reason', 'Action']}
            rows={pendingResign.map(e => [
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{e.name}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{e.employee_id}</div>
              </div>,
              <span style={{ fontSize: 13, color: '#374151' }}>{e.designation}</span>,
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtDate(e.resignation_date)}</span>,
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#d97706', fontWeight: 600 }}>{fmtDate(e.last_working_day)}</span>,
              <span style={{ fontSize: 12, color: '#6b7280' }}>{e.exit_reason || '—'}</span>,
              <button onClick={() => nav('/approvals')} style={{ padding: '5px 12px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 7, fontSize: 11, fontWeight: 600, color: '#1d4ed8', cursor: 'pointer' }}>Review</button>,
            ])}
          />
        )}
      </Card>

      {/* ── Exit Pipeline ── */}
      {exitPipeline.length > 0 && (
        <Card>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Team Exit Pipeline</div>
            <button onClick={() => nav('/exit')} style={{ padding: '7px 16px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 12, fontWeight: 600, color: '#4f8ef7', cursor: 'pointer' }}>View →</button>
          </div>
          <Table
            headers={['Employee', 'Status', 'Last Working Day']}
            rows={exitPipeline.slice(0, 5).map(e => [
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{e.name}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{e.employee_id}</div>
              </div>,
              <Badge status={e.status} />,
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#d97706', fontWeight: 600 }}>{fmtDate(e.last_working_day)}</span>,
            ])}
          />
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function EmployeeDashboard({ user }) {
  const [data, setData] = useState({ letters: [], aoOrders: [], exitStatus: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      axios.get('/api/letters/'),
      axios.get('/api/appointment-orders/'),
      axios.get('/api/exit/my-status'),
    ]).then(([letters, ao, exit]) => {
      setData({
        letters: letters.value?.data || [],
        aoOrders: ao.value?.data || [],
        exitStatus: exit.value?.data || null,
      });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#4f8ef7', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading your portal…</div>
      </div>
    </div>
  );

  const { letters, aoOrders, exitStatus } = data;
  const offerLetters = letters.filter(l => l.letter_type === 'offer');
  const latestLetter = offerLetters[0];
  const latestAO = aoOrders[0];
  const inExit = exitStatus?.in_exit_pipeline;
  const exitSt = exitStatus?.status;
  const isExited = exitSt === 'exited';
  const isPending = exitSt === 'resignation_pending';
  const approvedAOs = aoOrders.filter(o => o.status === 'approved').length;
  const pendingAOs = aoOrders.filter(o => o.status === 'pending_hr_head').length;
  const rejectedAOs = aoOrders.filter(o => o.status === 'rejected').length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const download = async (id, fmt, name) => {
    try {
      const r = await axios.get(`/api/exit/relieving/${id}/download?format=${fmt}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url; a.download = `${name}.${fmt}`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Download failed'); }
  };

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Employee Portal</div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: '#111827', letterSpacing: -0.5 }}>
          {greeting}, {user?.name?.split(' ')[0]}
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9ca3af' }}>{TODAY}</p>
      </div>

      {/* ── Exit status banner ── */}
      {inExit && (
        <div style={{ marginBottom: 24 }}>
          <AlertBanner
            icon={isPending ? '⏳' : isExited ? '✅' : '🔄'}
            title={
              isPending ? 'Your resignation is awaiting manager approval'
                : isExited ? 'Exit process complete — relieving letter ready'
                  : `Exit in progress — ${exitSt?.replace(/_/g, ' ')}`
            }
            sub={[
              exitStatus?.resignation_date && `Resignation Date: ${fmtDate(exitStatus.resignation_date)}`,
              exitStatus?.last_working_day && `Last Working Day: ${fmtDate(exitStatus.last_working_day)}`,
            ].filter(Boolean).join(' · ')}
            color={isPending ? '#f59e0b' : isExited ? '#10b981' : '#6366f1'}
            btnLabel={isExited && exitStatus?.relieving_letter_id && exitStatus.has_pdf ? 'Download PDF' : !isExited && !isPending ? 'View Details →' : null}
            onBtn={() => isExited ? download(exitStatus.relieving_letter_id, 'pdf', 'relieving_letter') : nav('/exit')}
          />
        </div>
      )}

      {/* ── My Documents Metrics ── */}
      <SectionTitle>My Documents</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 32 }}>
        <StatCard value={offerLetters.length} label="Offer Letters" sub="all versions" gradient="linear-gradient(135deg, #4f8ef7 0%, #6366f1 100%)" icon="📄" onClick={() => nav('/letters')} />
        <StatCard value={approvedAOs} label="Appointment Orders" sub="approved & ready" gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)" icon="✅" onClick={() => nav('/appointment')} />
        <StatCard value={pendingAOs + rejectedAOs} label="Needs Action" sub="pending or rejected" gradient={(pendingAOs + rejectedAOs) > 0 ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" : "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)"} icon="📋" onClick={() => nav('/appointment')} urgent={(pendingAOs + rejectedAOs) > 0} />
      </div>

      {/* ── Two column ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Latest offer letter */}
        <Card style={{ padding: '22px 24px' }}>
          <SectionTitle action={() => nav('/letters')} actionLabel="View all →">My Latest Offer Letter</SectionTitle>
          {!latestLetter ? (
            <EmptyState icon="📄" title="No offer letters yet" sub="Your offer letter will appear here once HR creates one." />
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <Badge status={latestLetter.status} />
                <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', background: '#f8fafc', padding: '2px 8px', borderRadius: 6 }}>v{latestLetter.version}</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(latestLetter.created_at)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                {[
                  ['Designation', latestLetter.context?.designation],
                  ['Department', latestLetter.context?.department],
                  ['CTC', latestLetter.context?.ctc ? `₹${Number(latestLetter.context.ctc).toLocaleString('en-IN')}` : null],
                  ['Joining Date', fmtDate(latestLetter.context?.joining_date)],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 3 }}>{k}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{v}</div>
                  </div>
                ))}
              </div>
              {latestLetter.status === 'rejected' && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', borderRadius: 10, fontSize: 12, color: '#dc2626', fontWeight: 500 }}>
                  Letter was rejected — check Offer Letters for details
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Latest appointment order */}
        <Card style={{ padding: '22px 24px' }}>
          <SectionTitle action={() => nav('/appointment')} actionLabel="View all →">My Latest Appointment Order</SectionTitle>
          {!latestAO ? (
            <EmptyState icon="📋" title="No appointment orders yet" sub="Your appointment order will appear here once HR creates one." />
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <Badge status={latestAO.status} />
                <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', background: '#f8fafc', padding: '2px 8px', borderRadius: 6 }}>{latestAO.reference_number}</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(latestAO.created_at)}</span>
              </div>
              {latestAO.status === 'rejected' && (
                <div style={{ padding: '12px 14px', background: '#fef2f2', borderRadius: 10, fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Rejected — you can edit and resubmit</div>
                  <button onClick={() => nav('/appointment')} style={{ padding: '6px 14px', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 7, fontSize: 11, fontWeight: 700, color: '#b45309', cursor: 'pointer' }}>
                    ✎ Edit & Resubmit
                  </button>
                </div>
              )}
              {latestAO.status === 'pending_hr_head' && (
                <div style={{ padding: '12px 14px', background: '#fffbeb', borderRadius: 10, fontSize: 12, color: '#92400e', fontWeight: 500 }}>
                  ⏳ Submitted — awaiting HR Head approval
                </div>
              )}
              {latestAO.status === 'approved' && (
                <div style={{ padding: '12px 14px', background: '#d1fae5', borderRadius: 10, fontSize: 12, color: '#065f46' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Approved — download your appointment order</div>
                  <button onClick={() => nav('/appointment')} style={{ padding: '6px 14px', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 7, fontSize: 11, fontWeight: 700, color: '#15803d', cursor: 'pointer' }}>
                    Download
                  </button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ── Quick Actions ── */}
      <Card style={{ padding: '22px 24px' }}>
        <SectionTitle>Quick Actions</SectionTitle>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: '📋 Appointment Orders', path: '/appointment', bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
            { label: '📄 My Offer Letters', path: '/letters', bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
            { label: '🗂 My Documents', path: '/documents', bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
            ...(!inExit ? [{ label: '→ Apply for Resignation', path: '/exit', bg: '#fdf2f8', border: '#fbcfe8', color: '#be185d' }] : []),
          ].map(a => (
            <button key={a.label} onClick={() => nav(a.path)} style={{
              padding: '10px 20px', background: a.bg, border: `1.5px solid ${a.border}`,
              borderRadius: 10, fontSize: 13, fontWeight: 600, color: a.color,
              cursor: 'pointer', transition: 'transform .15s, box-shadow .15s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.10)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </Card>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Root router ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role || 'employee';
  if (['admin', 'hr_head'].includes(role)) return <HRDashboard user={user} />;
  if (role === 'manager') return <ManagerDashboard user={user} />;
  return <EmployeeDashboard user={user} />;
}