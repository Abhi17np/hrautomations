import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/',           icon: '▦',  label: 'Dashboard'        },
  { to: '/employees',  icon: '◉',  label: 'Employees'        },
  { to: '/templates',  icon: '⬡',  label: 'Templates'        },
  { to: '/letters',    icon: '◈',  label: 'Offer Letters'    },
  { to: '/approvals',  icon: '◎',  label: 'Approvals'        },
  { to: '/exit',       icon: '⇥',  label: 'Exit & Relieving' },
];

const ROLE_COLOR = { admin: '#f5a623', hr_head: '#4f8ef7', hr: '#3fcf8e', manager: '#c084fc' };

function NavLink({ to, icon, label, currentPath }) {
  const isActive = currentPath === to;
  const navigate = (path) => { window.location.hash = path; };
  return (
    <button
      onClick={() => navigate(to)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '9px 12px', borderRadius: 'var(--radius)',
        marginBottom: 2, fontSize: 13, fontWeight: 500,
        color: isActive ? 'var(--accent)' : 'var(--text-muted)',
        background: isActive ? 'var(--accent-glow)' : 'transparent',
        border: `1px solid ${isActive ? 'var(--accent-dim)' : 'transparent'}`,
        transition: 'all 0.15s', cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text)'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
    >
      <span style={{ fontSize: 13 }}>{icon}</span>
      {label}
    </button>
  );
}

export default function Layout({ children, currentPath }) {
  const { user, logout } = useAuth();
  const rc = ROLE_COLOR[user?.role] || '#4f8ef7';

  const handleLogout = () => {
    logout();
    window.location.hash = '/';
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 224, flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ padding: '22px 20px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>
            HR<span style={{ color: 'var(--accent)' }}>Letters</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Offer Letter System
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '14px 12px', overflowY: 'auto' }}>
          {NAV.map(item => (
            <NavLink key={item.to} {...item} currentPath={currentPath} />
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: `${rc}1a`, border: `1.5px solid ${rc}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: rc,
            }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: rc, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{user?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '7px', borderRadius: 'var(--radius)',
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
              transition: 'all 0.15s', fontFamily: 'var(--body)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)', padding: '32px 36px' }}>
        {children}
      </main>
    </div>
  );
}