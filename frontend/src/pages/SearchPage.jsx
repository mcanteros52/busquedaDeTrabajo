import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Loader, AlertCircle } from 'lucide-react';
import { matchAPI, jobsAPI } from '../utils/api';

const PORTALS = [
  { id: 'getonboard', label: 'GetOnBoard', region: 'LATAM' },
  { id: 'computrabajo', label: 'Computrabajo', region: 'Argentina' },
  { id: 'bumeran', label: 'Bumeran', region: 'Argentina' },
  { id: 'indeed', label: 'Indeed', region: 'Global' },
];

export default function SearchPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // cvId puede venir del estado de navegación (desde CVUpload) o del historial
  const [cvId, setCvId] = useState(location.state?.cvId || '');
  const [config, setConfig] = useState({
    portals: ['getonboard', 'computrabajo'],
    location: 'Argentina',
    remoteOk: true,
    maxResults: 20,
    minMatchScore: 60,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingStep, setLoadingStep] = useState('');

  const LOADING_STEPS = [
    'Analizando tu perfil...',
    'Consultando GetOnBoard...',
    'Consultando Computrabajo...',
    'Calculando scores de coincidencia...',
    'Rankeando resultados...',
  ];

  useEffect(() => {
    let stepIdx = 0;
    let interval;
    if (loading) {
      setLoadingStep(LOADING_STEPS[0]);
      interval = setInterval(() => {
        stepIdx = (stepIdx + 1) % LOADING_STEPS.length;
        setLoadingStep(LOADING_STEPS[stepIdx]);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  function togglePortal(id) {
    setConfig(prev => ({
      ...prev,
      portals: prev.portals.includes(id)
        ? prev.portals.filter(p => p !== id)
        : [...prev.portals, id],
    }));
  }

  async function handleSearch() {
    if (!cvId.trim()) {
      setError('Primero subí tu CV para poder buscar');
      return;
    }
    if (config.portals.length === 0) {
      setError('Seleccioná al menos un portal');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await matchAPI.run(cvId, config);
      const { matchId } = response.data;
      navigate(`/results/${matchId}`);
    } catch (err) {
      setError(err?.error || 'Error al ejecutar la búsqueda. Intentá de nuevo.');
      setLoading(false);
    }
  }

  return (
    <div className="fade-up" style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Configurar búsqueda</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 40 }}>
        El agente consultará los portales seleccionados y analizará qué trabajos coinciden con tu perfil.
      </p>

      {/* CV ID input */}
      <div style={{ marginBottom: 24 }}>
        <label className="label">ID de tu CV</label>
        <input
          className="input"
          value={cvId}
          onChange={e => setCvId(e.target.value)}
          placeholder="Pegá el ID de tu CV o subí uno nuevo"
        />
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
          El ID se genera al subir tu CV. Si acabás de subirlo, ya está precargado.
        </div>
      </div>

      {/* Portales */}
      <div style={{ marginBottom: 24 }}>
        <label className="label">Portales de búsqueda</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {PORTALS.map(portal => {
            const selected = config.portals.includes(portal.id);
            return (
              <button
                key={portal.id}
                onClick={() => togglePortal(portal.id)}
                style={{
                  background: selected ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-surface-2)',
                  border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  color: 'var(--color-text)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14 }}>{portal.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{portal.region}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Location */}
      <div style={{ marginBottom: 24 }}>
        <label className="label">Ubicación preferida</label>
        <input
          className="input"
          value={config.location}
          onChange={e => setConfig(prev => ({ ...prev, location: e.target.value }))}
          placeholder="Argentina, Buenos Aires, LATAM..."
        />
      </div>

      {/* Remote */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <div
            onClick={() => setConfig(prev => ({ ...prev, remoteOk: !prev.remoteOk }))}
            style={{
              width: 44, height: 24,
              background: config.remoteOk ? 'var(--color-accent)' : 'var(--color-border)',
              borderRadius: 12,
              position: 'relative',
              transition: 'background 0.2s',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <div style={{
              width: 18, height: 18,
              background: 'white',
              borderRadius: '50%',
              position: 'absolute',
              top: 3,
              left: config.remoteOk ? 22 : 3,
              transition: 'left 0.2s',
            }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Incluir trabajo remoto</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Buscar también trabajos 100% remotos</div>
          </div>
        </label>
      </div>

      {/* Score mínimo */}
      <div style={{ marginBottom: 32 }}>
        <label className="label">Score mínimo de coincidencia: {config.minMatchScore}%</label>
        <input
          type="range"
          min="0"
          max="90"
          value={config.minMatchScore}
          onChange={e => setConfig(prev => ({ ...prev, minMatchScore: Number(e.target.value) }))}
          style={{ width: '100%', accentColor: 'var(--color-accent)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
          <span>0% (todos)</span>
          <span>90% (muy exacto)</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          marginBottom: 16,
          color: 'var(--color-error)',
          fontSize: 13,
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '32px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Loader size={28} color="var(--color-accent)" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>El agente está trabajando...</div>
          <div className="pulse" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {loadingStep}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Esto puede tardar hasta 2 minutos
          </div>
        </div>
      )}

      <button
        onClick={handleSearch}
        disabled={loading}
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, opacity: loading ? 0.7 : 1 }}
      >
        {loading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={18} />}
        {loading ? 'Buscando...' : 'Buscar trabajos ahora'}
      </button>
    </div>
  );
}
