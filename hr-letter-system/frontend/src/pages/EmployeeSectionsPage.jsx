// import { useState, useEffect, useMemo } from 'react';
// import axios from 'axios';

// const SECTIONS = {
//   current:  { label: 'Current Employees',   icon: '◉', color: 'var(--green)',       desc: 'Actively employed with login ID' },
//   joining:  { label: 'Joining Employees',    icon: '◎', color: 'var(--accent)',      desc: 'Accepted offer, yet to join' },
//   relieved: { label: 'Relieved Employees',   icon: '○', color: 'var(--text-muted)', desc: 'Completed the exit process' },
// };

// const STATUS_BADGE = {
//   active:             'badge-green',
//   notice_period:      'badge-amber',
//   clearance_pending:  'badge-amber',
//   clearance_complete: 'badge-blue',
//   exited:             'badge-gray',
// };

// function EmployeeCard({ emp, section }) {
//   const cfg = SECTIONS[section];

//   return (
//     <div className="emp-card" style={{ borderLeft: `3px solid ${cfg.color}` }}>
//       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
//         <div>
//           <div style={{ fontWeight: 600, fontSize: 14 }}>{emp.name}</div>
//           <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
//             {emp.employee_id}
//           </div>
//         </div>
//         <span style={{
//           fontSize: 10, padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--mono)', fontWeight: 600,
//           background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}33`,
//         }}>
//           {cfg.icon} {cfg.label.split(' ')[0]}
//         </span>
//       </div>

//       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: emp.login_id ? 12 : 0 }}>
//         {[
//           ['Role',       emp.designation],
//           ['Dept',       emp.department],
//           ['Email',      emp.email],
//           section === 'joining'  ? ['Joining',      emp.joining_date]      :
//           section === 'relieved' ? ['Exit Date',     emp.last_working_day]  :
//                                    ['Since',         emp.joining_date],
//           section !== 'relieved' ? ['Stage',         emp.employment_stage || emp.status] : null,
//         ].filter(Boolean).filter(([, v]) => v).map(([k, v]) => (
//           <div key={k}>
//             <div style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'uppercase', fontFamily: 'var(--mono)', marginBottom: 2 }}>{k}</div>
//             <div style={{ color: 'var(--text-muted)', wordBreak: 'break-all' }}>{v}</div>
//           </div>
//         ))}
//       </div>

//       {/* Login ID chip — shown for current employees */}
//       {emp.login_id && (
//         <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
//           <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>LOGIN ID</span>
//           <code style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 8px', borderRadius: 4 }}>
//             {emp.login_id}
//           </code>
//         </div>
//       )}
//     </div>
//   );
// }

// export default function EmployeeSectionsPage() {
//   const [sections,  setSections]  = useState({ current: [], joining: [], relieved: [] });
//   const [loading,   setLoading]   = useState(true);
//   const [activeTab, setTab]       = useState('current');
//   const [search,    setSearch]    = useState('');

//   useEffect(() => {
//     setLoading(true);
//     axios.get('/api/offer/employee-sections')
//       .then(r => setSections(r.data))
//       .finally(() => setLoading(false));
//   }, []);

//   const counts = {
//     current:  sections.current?.length  || 0,
//     joining:  sections.joining?.length  || 0,
//     relieved: sections.relieved?.length || 0,
//   };

//   const filtered = useMemo(() => {
//     const q = search.toLowerCase();
//     return (sections[activeTab] || []).filter(e =>
//       !q || e.name?.toLowerCase().includes(q) ||
//       e.employee_id?.toLowerCase().includes(q) ||
//       e.designation?.toLowerCase().includes(q) ||
//       e.department?.toLowerCase().includes(q)
//     );
//   }, [sections, activeTab, search]);

//   return (
//     <div>
//       <div className="page-header">
//         <div>
//           <h1 className="page-title">Employee Directory</h1>
//           <p className="page-subtitle">
//             {counts.current} current · {counts.joining} joining · {counts.relieved} relieved
//           </p>
//         </div>
//       </div>

//       {/* Summary stat cards */}
//       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
//         {Object.entries(SECTIONS).map(([key, cfg]) => (
//           <div key={key}
//             onClick={() => setTab(key)}
//             style={{
//               background: activeTab === key ? `${cfg.color}0e` : 'var(--surface)',
//               border: `1px solid ${activeTab === key ? `${cfg.color}55` : 'var(--border)'}`,
//               borderTop: `3px solid ${cfg.color}`,
//               borderRadius: 'var(--radius-lg)', padding: '18px 20px',
//               cursor: 'pointer', transition: 'all 0.15s',
//             }}
//             onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; }}
//             onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
//           >
//             <div style={{ fontSize: 30, fontWeight: 800, color: cfg.color, lineHeight: 1, marginBottom: 6, fontFamily: 'var(--display)' }}>
//               {counts[key]}
//             </div>
//             <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{cfg.label}</div>
//             <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{cfg.desc}</div>
//           </div>
//         ))}
//       </div>

//       {/* Tab switcher */}
//       <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
//         {Object.entries(SECTIONS).map(([key, cfg]) => (
//           <button key={key} className={`btn btn-sm ${activeTab === key ? 'btn-primary' : 'btn-ghost'}`}
//             onClick={() => setTab(key)} style={{ fontSize: 12 }}>
//             {cfg.icon} {cfg.label} ({counts[key]})
//           </button>
//         ))}
//       </div>

//       {/* Search */}
//       <div style={{ marginBottom: 16 }}>
//         <input
//           placeholder="Search by name, ID, role, or department…"
//           value={search} onChange={e => setSearch(e.target.value)}
//           style={{ maxWidth: 380 }}
//         />
//       </div>

//       {/* Grid or states */}
//       {loading ? (
//         <div className="page-loading"><div className="spinner" /></div>
//       ) : filtered.length === 0 ? (
//         <div className="card">
//           <div className="empty-state">
//             <div className="empty-icon">{SECTIONS[activeTab].icon}</div>
//             <p>
//               {search
//                 ? `No results for "${search}"`
//                 : `No ${SECTIONS[activeTab].label.toLowerCase()} yet`}
//             </p>
//             {activeTab === 'current' && !search && (
//               <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
//                 Employees appear here after their offer is accepted and HR Head clicks "Create ID".
//               </p>
//             )}
//             {activeTab === 'joining' && !search && (
//               <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
//                 Employees appear here after they accept the offer letter.
//               </p>
//             )}
//           </div>
//         </div>
//       ) : (
//         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
//           {filtered.map(emp => (
//             <EmployeeCard key={emp._id} emp={emp} section={activeTab} />
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }