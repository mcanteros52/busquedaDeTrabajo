import { useState, useEffect } from 'react';
import { Save, Plus, X, AlertCircle, CheckCircle } from 'lucide-react';
import { profileAPI } from '../utils/api';

const SENIORITY_OPTIONS = ['junior', 'semi-senior', 'senior', 'lead', 'manager'];
const REMOTE_OPTIONS = ['remote', 'hybrid', 'onsite', 'any'];
const REMOTE_LABELS = { remote: 'Remoto', hybrid: 'Híbrido', onsite: 'Presencial', any: 'Indiferente' };

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(''); // '' | 'success' | 'error'
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    profileAPI.get().then(res => {
      setProfile(res.data || {});
      setLoading(false);
    }).catch(() => {
      setProfile({});
      setLoading(false);
    });
  }, []);

  function updateField(field, value) {
    setProfile(prev => ({ ...prev, [field]: value }));
  }

  function addSkill() {
    const skill = newSkill.trim();
    if (!skill || (profile.skills || []).includes(skill)) return;
    updateField('skills', [...(profile.skills || []), skill]);
    setNewSkill('');
  }

  function removeSkill(skill) {
    updateField('skills', (profile.skills || []).filter(s => s !== skill));
  }

  async function handleSave() {
    setSaving(true);
    setStatus('');
    try {
      await profileAPI.update({
        name: profile.name,
        targetRole: profile.targetRole,
        location: profile.location,
        seniority: profile.seniority,
        yearsOfExperience: Number(profile.yearsOfExperience),
        skills: profile.skills,
        languages: profile.languages,
        remotePreference: profile.remotePreference,
      });
      setStatus('success');
    } catch (err) {
      setStatus('error');
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(''), 3000);
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', marginTop: 80 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>;
  }

  return (
    <div className="fade-up" style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <div>
          <h1 style={{ fontSize: 26, marginBottom: 6 }}>Mi Perfil</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>Revisá y editá los datos extraídos de tu CV</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          {saving ? <div className="spinner" /> : <Save size={16} />}
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {status === 'success' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 20, color: 'var(--color-success)', fontSize: 13 }}>
          <CheckCircle size={16} /> Perfil actualizado correctamente
        </div>
      )}
      {status === 'error' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 20, color: 'var(--color-error)', fontSize: 13 }}>
          <AlertCircle size={16} /> Error al guardar. Intentá de nuevo.
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 20 }}>Información básica</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label className="label">Nombre completo</label>
            <input className="input" value={profile.name || ''} onChange={e => updateField('name', e.target.value)} placeholder="Juan Pérez" />
          </div>
          <div>
            <label className="label">Ubicación</label>
            <input className="input" value={profile.location || ''} onChange={e => updateField('location', e.target.value)} placeholder="Buenos Aires, Argentina" />
          </div>
          <div>
            <label className="label">Rol objetivo</label>
            <input className="input" value={profile.targetRole || ''} onChange={e => updateField('targetRole', e.target.value)} placeholder="Backend Developer" />
          </div>
          <div>
            <label className="label">Años de experiencia</label>
            <input className="input" type="number" min="0" max="50" value={profile.yearsOfExperience || ''} onChange={e => updateField('yearsOfExperience', e.target.value)} placeholder="5" />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 20 }}>Seniority y modalidad</h3>
        <div style={{ marginBottom: 20 }}>
          <label className="label">Nivel de seniority</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SENIORITY_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => updateField('seniority', opt)}
                className="badge"
                style={{
                  cursor: 'pointer',
                  background: profile.seniority === opt ? 'var(--color-accent)' : 'var(--color-surface-2)',
                  color: profile.seniority === opt ? 'white' : 'var(--color-text-muted)',
                  border: profile.seniority === opt ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                  padding: '6px 14px',
                  fontSize: 13,
                }}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Preferencia de modalidad</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {REMOTE_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => updateField('remotePreference', opt)}
                className="badge"
                style={{
                  cursor: 'pointer',
                  background: profile.remotePreference === opt ? 'var(--color-accent)' : 'var(--color-surface-2)',
                  color: profile.remotePreference === opt ? 'white' : 'var(--color-text-muted)',
                  border: profile.remotePreference === opt ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                  padding: '6px 14px',
                  fontSize: 13,
                }}
              >
                {REMOTE_LABELS[opt]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 20 }}>Skills</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="input"
            value={newSkill}
            onChange={e => setNewSkill(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSkill()}
            placeholder="Agregar skill (Enter para confirmar)"
          />
          <button onClick={addSkill} className="btn btn-secondary">
            <Plus size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(profile.skills || []).map(skill => (
            <div
              key={skill}
              className="badge badge-accent"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px' }}
            >
              {skill}
              <button
                onClick={() => removeSkill(skill)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', lineHeight: 1 }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {(!profile.skills || profile.skills.length === 0) && (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No hay skills cargados</span>
          )}
        </div>
      </div>
    </div>
  );
}
