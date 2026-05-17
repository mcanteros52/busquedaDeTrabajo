import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ExternalLink, Star, MapPin, Building2, Calendar, Filter, ArrowLeft } from 'lucide-react';
import { jobsAPI } from '../utils/api';

function getScoreClass(score) {
  if (score >= 80) return 'score-high';
  if (score >= 60) return 'score-mid';
  return 'score-low';
}

function getScoreLabel(score) {
  if (score >= 80) return '🎯 Muy recomendado';
  if (score >= 60) return '✅ Buena coincidencia';
  return '👀 Para explorar';
}

export default function ResultsPage() {
  const { matchId } = useParams();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ minScore: 0, remote: null, portal: 'all' });
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    async function loadResults() {
      try {
        const response = await jobsAPI.getHistory({ matchId, limit: 50 });
        setMatches(response.data?.matches || []);
      } catch (err) {
        console.error('Results load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadResults();
  }, [matchId]);

  // Flatten all jobs from all matches
  const allJobs = matches.flatMap(m => m.results || []);

  const filteredJobs = allJobs.filter(item => {
    if (item.match_score < filter.minScore) return false;
    if (filter.remote !== null && item.job?.remote !== filter.remote) return false;
    if (filter.portal !== 'all' && item.job?.portal !== filter.portal) return false;
    return true;
  });

  const highMatches = filteredJobs.filter(j => j.match_score >= 80);
  const midMatches = filteredJobs.filter(j => j.match_score >= 60 && j.match_score < 80);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (allJobs.length === 0) {
    return (
      <div className="fade-up">
        <Link to="/search" className="btn btn-ghost" style={{ marginBottom: 24 }}>
          <ArrowLeft size={16} /> Nueva búsqueda
        </Link>
        <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h3 style={{ marginBottom: 8 }}>Sin resultados aún</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>
            Ejecutá una búsqueda para ver trabajos recomendados para tu perfil.
          </p>
          <Link to="/search" className="btn btn-primary">Buscar trabajos</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, marginBottom: 6 }}>Resultados de búsqueda</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            {filteredJobs.length} trabajos encontrados · {highMatches.length} con match alto
          </p>
        </div>
        <Link to="/search" className="btn btn-secondary">
          <ArrowLeft size={16} /> Nueva búsqueda
        </Link>
      </div>

      {/* Summary from agent */}
      {matches[0]?.summary && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '3px solid var(--color-accent)' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>Análisis del agente</div>
          <p style={{ fontSize: 14 }}>{matches[0].summary}</p>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: 13 }}>
          <Filter size={14} />
          Filtrar:
        </div>
        {[0, 60, 80].map(score => (
          <button
            key={score}
            onClick={() => setFilter(f => ({ ...f, minScore: score }))}
            className="badge"
            style={{
              cursor: 'pointer',
              background: filter.minScore === score ? 'var(--color-accent)' : 'var(--color-surface-2)',
              color: filter.minScore === score ? 'white' : 'var(--color-text-muted)',
              border: filter.minScore === score ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
            }}
          >
            {score === 0 ? 'Todos' : score === 60 ? '≥60%' : '≥80%'}
          </button>
        ))}
        <button
          onClick={() => setFilter(f => ({ ...f, remote: f.remote === true ? null : true }))}
          className="badge"
          style={{
            cursor: 'pointer',
            background: filter.remote === true ? 'var(--color-accent)' : 'var(--color-surface-2)',
            color: filter.remote === true ? 'white' : 'var(--color-text-muted)',
            border: filter.remote === true ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
          }}
        >
          Solo remoto
        </button>
      </div>

      {/* Job cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedJob ? '1fr 380px' : '1fr', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredJobs.map((item, idx) => (
            <JobCard
              key={item.job?.id || idx}
              item={item}
              selected={selectedJob?.job?.id === item.job?.id}
              onClick={() => setSelectedJob(selectedJob?.job?.id === item.job?.id ? null : item)}
            />
          ))}
        </div>

        {/* Detail panel */}
        {selectedJob && (
          <div>
            <JobDetail item={selectedJob} onClose={() => setSelectedJob(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({ item, selected, onClick }) {
  const { job, match_score, match_reason } = item;
  if (!job) return null;

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: selected ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
        boxShadow: selected ? 'var(--shadow-glow)' : 'var(--shadow-card)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{job.title}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Building2 size={12} /> {job.company}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} /> {job.location}
            </span>
          </div>
        </div>
        <div className={`badge ${getScoreClass(match_score)}`} style={{ marginLeft: 12, flexShrink: 0 }}>
          {match_score}%
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
        {match_reason}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {job.remote && <span className="badge badge-accent">Remoto</span>}
        {job.seniority && <span className="badge badge-muted">{job.seniority}</span>}
        <span className="badge badge-muted">{job.portal}</span>
        {job.salary && <span className="badge badge-success">{job.salary}</span>}
      </div>
    </div>
  );
}

function JobDetail({ item, onClose }) {
  const { job, match_score, match_reason } = item;

  return (
    <div className="card" style={{ position: 'sticky', top: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <span className={`badge ${getScoreClass(match_score)}`}>{getScoreLabel(match_score)}</span>
        <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px 8px' }}>✕</button>
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 4 }}>{job.title}</h2>
      <div style={{ color: 'var(--color-accent)', fontWeight: 600, marginBottom: 16 }}>{job.company}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--color-text-muted)' }}>
        <div style={{ display: 'flex', gap: 6 }}><MapPin size={14} /> {job.location}</div>
        {job.salary && <div style={{ display: 'flex', gap: 6 }}><Star size={14} /> {job.salary}</div>}
        {job.posted_at && (
          <div style={{ display: 'flex', gap: 6 }}>
            <Calendar size={14} />
            {new Date(job.posted_at).toLocaleDateString('es-AR')}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div className="label" style={{ marginBottom: 8 }}>Por qué coincide</div>
        <p style={{ fontSize: 13, color: 'var(--color-text-dim)', lineHeight: 1.7 }}>{match_reason}</p>
      </div>

      {job.required_skills?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="label" style={{ marginBottom: 8 }}>Skills requeridos</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {job.required_skills.map(skill => (
              <span key={skill} className="badge badge-muted">{skill}</span>
            ))}
          </div>
        </div>
      )}

      {job.description && (
        <div style={{ marginBottom: 20 }}>
          <div className="label" style={{ marginBottom: 8 }}>Descripción</div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>{job.description}</p>
        </div>
      )}

      <a
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center' }}
      >
        <ExternalLink size={16} />
        Ver en {job.portal}
      </a>
    </div>
  );
}
