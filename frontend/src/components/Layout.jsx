import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Upload, Search, Briefcase, User, LogOut, Zap } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/upload', label: 'Subir CV', icon: Upload },
  { path: '/search', label: 'Buscar', icon: Search },
  { path: '/results', label: 'Resultados', icon: Briefcase },
  { path: '/profile', label: 'Mi Perfil', icon: User },
];

export default function Layout({ children, user, onSignOut }) {
  const location = useLocation();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* ─── Sidebar ──────────────────────────────────────────────────── */}
      <aside style={{
        width: 240,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        position: 'sticky',
        top: 0,
        height: '100vh',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--color-accent)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color="white" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>
              JobMatch
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>AI Agent</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path || location.pathname.startsWith(path + '/');
            return (
              <Link
                key={path}
                to={path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                  background: active ? 'var(--color-surface-2)' : 'transparent',
                  border: active ? '1px solid var(--color-border)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} color={active ? 'var(--color-accent)' : 'currentColor'} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User + Sign out */}
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8, padding: '0 12px' }}>
            {user?.signInDetails?.loginId || user?.username}
          </div>
          <button
            onClick={onSignOut}
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', fontSize: 14 }}
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ─── Main content ─────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: '40px 48px', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
