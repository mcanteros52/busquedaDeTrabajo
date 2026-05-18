import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { matchAPI, jobsAPI } from '../utils/api';

const PORTALS = [
  { id: 'getonboard', label: 'GetOnBoard', region: 'LATAM' },
  { id: 'computrabajo', label: 'Computrabajo', region: 'Argentina' },
  { id: 'bumeran', label: 'Bumeran', region: 'Argentina' },
  { id: 'indeed', label: 'Indeed', region: 'Global' },
];

const LOADING_STEPS = [
  'Analizando tu perfil...',
  'Consultando GetOnBoard...',
  'Consultando Computrabajo...',
  'Calculando scores de coincidencia...',
  'Rankeando resultados...',
  'Casi listo...',
];

export default function SearchPage() {
  const navigate = useNavigate();
  const location = useLocation();

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
  const [pollingMatchId, setPollingMatchId] = useState(null);
  const pollingRef = useRef(null);
  const stepRef = useRef(0);

  // Rotar los pasos de loading cada 4 segundos
  useEffect(() => {
    let interval;
    if (loading) {
      setLoadingStep(LOADING_STEPS[0]);
      stepRef.current = 0;
      interval = setInterval(() => {
        stepRef.current = (stepRef.current + 1) % LOADING_STEPS.length;
        setLoadingStep(LOADING_STEPS[stepRef.current]);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Polling: consultar cada 4 segundos si el match terminó
  useEffect(() => {
    if (!pollingMatchId) return;

    pollingRef.current = setInterval(async () => {
      try {
        const result = await jobsAPI.getHistory({ matchId: pollingMatchId });
        const status = result?.status || result?.data?.status;

        if (status === 'completed') {
          clearInterval(pollingRef.current);
          navigate(`/results/${pollingMatchId}`);
        } else if (status === 'failed') {
          clearInterval(pollingRef.current);
          setError('El agente encontró un error al procesar. Intentá de nuevo.');
          setLoading(false);
          setPollingMatchId(null);
        }
        // Si sigue 'pending', seguimos esperando
      } catch (err) {
        console.warn('Polling error:', err);
        // No cortar el polling por errores de red temporales
      }
    }, 4000);

    return () => clearInterval(pollingRef.current);
  }, [pollingMatchId, navigate]);

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
      setError('Primero subí tu CV. El ID se completa automáticamente al subir.');
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
      const matchId = response?.matchId || response?.data?.matchId;

      if (!matchId) throw new Error('No se recibió ID de búsqueda');

      // Arrancar polling — el Lambda procesa en background
      setPollingMatchId(matchId);
    } catch (err) {
      setError(err?.error || err?.message || 'Error al iniciar la búsqueda. Intentá de nuevo.');
      setLoading(false);
    }
  }

  return (
    <div className="fade-up" style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Configurar búsqueda</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 40 }}>
        El agente consultará los portales seleccionados y analizará qué trabajos coinciden con tu perfil.
      </p>

      {/* CV ID */}
      <div style={{ marginBottom: 24 }}>
        <label className="label">ID de tu CV</label>
        <input
          className="input"
          value={cvId}
          onChange={e => setCvId(e.target.value)}
          placeholder="Se completa automáticamente al subir el CV"
          disabled={loading}
        />
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Si acabás de subir tu CV, el ID ya está precargado.
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
                onClick={() => !loading && togglePortal(portal.id)}
                style={{
                  background: selected ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-surface-2)',
                  border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  color: 'var(--color-text)',
                  opacity: loading ? 0.6 : 1,
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
          disabled={loading}
        />
      </div>

      {/* Remote toggle */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: loading ? 'not-allowed' : 'pointer' }}>
          <div
            onClick={() => !loading && setConfig(prev => ({ ...prev, remoteOk: !prev.remoteOk }))}
            style={{
              width: 44, height: 24,
              background: config.remoteOk ? 'var(--color-accent)' : 'var(--color-border)',
              borderRadius: 12,
              position: 'relative',
              transition: 'background 0.2s',
              cursor: loading ? 'not-allowed' : 'pointer',
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
          type="range" min="0" max="90"
          value={config.minMatchScore}
          onChange={e => setConfig(prev => ({ ...prev, minMatchScore: Number(e.target.value) }))}
          style={{ width: '100%', accentColor: 'var(--color-accent)' }}
          disabled={loading}
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
          padding: '10px 14px', marginBottom: 16,
          color: 'var(--color-error)', fontSize: 13,
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading state con polling */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '32px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Loader size={28} color="var(--color-accent)" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>El agente está trabajando...</div>
          <div className="pulse" style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            {loadingStep}
          </div>
          {pollingMatchId && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
              Job ID: {pollingMatchId.slice(0, 8)}...
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Esto puede tardar 1-2 minutos. No cierres esta página.
          </div>
        </div>
      )}

      <button
        onClick={handleSearch}
        disabled={loading}
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, opacity: loading ? 0.7 : 1 }}
      >
        {loading
          ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
          : <Search size={18} />}
        {loading ? 'Buscando...' : 'Buscar trabajos ahora'}
      </button>
    </div>
  );
}
