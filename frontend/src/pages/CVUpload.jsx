import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, File, CheckCircle, AlertCircle, X } from 'lucide-react';
import axios from 'axios';
import { cvAPI } from '../utils/api';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export default function CVUpload() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | success | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [cvId, setCvId] = useState(null);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError('El archivo no puede superar 5MB');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Solo se aceptan archivos PDF');
      } else {
        setError('Archivo no válido');
      }
      return;
    }
    setFile(acceptedFiles[0]);
    setError('');
    setStatus('idle');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_SIZE,
    maxFiles: 1,
  });

  async function handleUpload() {
    if (!file) return;
    setStatus('uploading');
    setProgress(0);
    setError('');

    try {
      // 1. Pedir presigned URL al backend
      // El interceptor de Axios ya desenvuelve response.data → accedemos directo
      const response = await cvAPI.requestUploadUrl(file.name, file.size);
      const uploadUrl = response?.uploadUrl || response?.data?.uploadUrl;
      const newCvId = response?.cvId || response?.data?.cvId;

      if (!uploadUrl) throw new Error('No se recibió URL de subida');
      setCvId(newCvId);

      // 2. Subir directamente a S3 con la presigned URL
      await axios.put(uploadUrl, file, {
        headers: { 'Content-Type': 'application/pdf' },
        onUploadProgress: (progressEvent) => {
          const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(pct);
        },
      });

      setStatus('success');
      setProgress(100);
    } catch (err) {
      setStatus('error');
      setError(err?.error || err?.message || 'Error al subir el archivo. Intentá de nuevo.');
    }
  }

  function handleReset() {
    setFile(null);
    setStatus('idle');
    setProgress(0);
    setError('');
    setCvId(null);
  }

  return (
    <div className="fade-up" style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Subir CV</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 40 }}>
        Subí tu CV en PDF y nuestro agente IA extraerá tu perfil automáticamente.
      </p>

      {/* Dropzone */}
      {status !== 'success' && (
        <div
          {...getRootProps()}
          className="card"
          style={{
            border: `2px dashed ${isDragActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: isDragActive ? 'rgba(59, 130, 246, 0.05)' : 'var(--color-surface)',
            padding: '40px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <input {...getInputProps()} />
          {file ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <File size={28} color="var(--color-accent)" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{file.name}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {Math.round(file.size / 1024)} KB
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleReset(); }}
                style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <>
              <Upload size={32} color="var(--color-text-muted)" style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {isDragActive ? 'Soltá el archivo acá' : 'Arrastrá tu CV o hacé click para seleccionar'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                PDF, máx 5MB
              </div>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          marginTop: 16,
          color: 'var(--color-error)',
          fontSize: 13,
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Progress bar */}
      {status === 'uploading' && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6 }}>
            <span>Subiendo archivo...</span>
            <span>{progress}%</span>
          </div>
          <div style={{ background: 'var(--color-border)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'var(--color-accent)',
              borderRadius: 4,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Success state */}
      {status === 'success' && (
        <div className="card" style={{ textAlign: 'center', padding: '50px 40px' }}>
          <CheckCircle size={48} color="var(--color-success)" style={{ marginBottom: 16 }} />
          <h3 style={{ marginBottom: 8 }}>¡CV subido exitosamente!</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 28, fontSize: 14 }}>
            Tu CV fue procesado. Ahora podés iniciar una búsqueda de trabajos.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={handleReset} className="btn btn-secondary">
              Subir otro CV
            </button>
            <button
              onClick={() => navigate('/search', { state: { cvId } })}
              className="btn btn-primary"
            >
              Buscar trabajos
            </button>
          </div>
        </div>
      )}

      {/* Upload button */}
      {file && status === 'idle' && (
        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          <button onClick={handleReset} className="btn btn-secondary">Cancelar</button>
          <button onClick={handleUpload} className="btn btn-primary" style={{ flex: 1 }}>
            <Upload size={16} />
            Subir CV
          </button>
        </div>
      )}

      {/* Tips */}
      <div style={{ marginTop: 32, padding: '16px 20px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>💡 Consejos para mejores resultados</div>
        <ul style={{ paddingLeft: 18, color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>Incluí tus tecnologías y herramientas específicas</li>
          <li>Describí logros concretos con números cuando sea posible</li>
          <li>Especificá tu nivel de inglés</li>
          <li>Mencioná si buscás trabajo remoto o en oficina</li>
        </ul>
      </div>
    </div>
  );
}
