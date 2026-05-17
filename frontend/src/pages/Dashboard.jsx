import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Search, TrendingUp, Briefcase, ArrowRight, Clock } from 'lucide-react';
import { profileAPI, jobsAPI } from '../utils/api';

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, jobsRes] = await Promise.allSettled([
          profileAPI.get(),
          jobsAPI.getHistory({ limit: 3 }),
        ]);

        if (profileRes.status === 'fulfilled') setProfile(profileRes.value?.data);
        if (jobsRes.status === 'fulfilled') setRecentMatches(jobsRes.value?.data?.matches || []);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const hasProfile = profile?.profileComplete !== false && profile?.targetRole;
  const topMatch = recentMatches[0];

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>
          {hasProfile ? `Bienvenido de vuelta${profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}` : 'Bienvenido a JobMatch'}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>
          {hasProfile
            ? 'Tu agente de IA está listo para buscar oportunidades'
            : 'Empezá subiendo tu CV para activar el agente'}
        </p>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
        <QuickAction
          to="/upload"
          icon={<Upload size={20} />}
          title="Subir CV"
          desc="PDF, máx 5MB"
          accent={!hasProfile}
        />
        <QuickAction
          to="/search"
          icon={<Search size={20} />}
          title="Nueva búsqueda"
          desc="Consultar portales"
          disabled={!hasProfile}
        />
        <QuickAction
          to="/results"
          icon={<Briefcase size={20} />}
          title="Ver resultados"
          desc={recentMatches.length > 0 ? `${recentMatches.length} búsquedas guardadas` : 'Sin búsquedas aún'}
          disabled={recentMatches.length === 0}
        />
      </div>

      {/* Stats row */}
      {hasProfile && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
          <StatCard label="Rol objetivo" value={profile?.targetRole || '—'} />
          <StatCard label="Seniority" value={profile?.seniority || '—'} />
          <StatCard label="Skills" value={`${profile?.skills?.length || 0} cargados`} />
          <StatCard label="Búsquedas" value={recentMatches.length} />
        </div>
      )}

      {/* Recent matches */}
      {topMatch && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18 }}>Última búsqueda</h2>
            <Link to="/results" className="btn btn-ghost" style={{ fontSize: 13 }}>
              Ver todo <ArrowRight size={14} />
            </Link>
          </div>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: 'var(--color-text-muted)', fontSize: 13 }}>
              <Clock size={14} />
              {new Date(topMatch.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </div>
            <p style={{ marginBottom: 16, color: 'var(--color-text-dim)' }}>
              {topMatch.summary || 'Búsqueda completada'}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <span className="badge badge-success">{topMatch.totalResults} trabajos encontrados</span>
              {topMatch.topScore > 0 && (
                <span className="badge badge-accent">Mejor match: {topMatch.topScore}%</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasProfile && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--color-surface-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <TrendingUp size={28} color="var(--color-accent)" />
          </div>
          <h3 style={{ marginBottom: 8 }}>Activá tu agente de búsqueda</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
            Subí tu CV y nuestro agente IA analizará tu perfil y buscará los mejores trabajos disponibles en LATAM.
          </p>
          <Link to="/upload" className="btn btn-primary">
            <Upload size={16} />
            Subir mi CV
          </Link>
        </div>
      )}
    </div>
  );
}

function QuickAction({ to, icon, title, desc, accent, disabled }) {
  return (
    <Link
      to={disabled ? '#' : to}
      className="card"
      style={{
        textDecoration: 'none',
        display: 'block',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: accent ? '1px solid var(--color-accent)' : undefined,
        ...(accent ? { boxShadow: 'var(--shadow-glow)' } : {}),
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: accent ? 'var(--color-accent)' : 'var(--color-surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
        color: accent ? 'white' : 'var(--color-accent)',
      }}>
        {icon}
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{desc}</div>
    </Link>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{value}</div>
    </div>
  );
}
