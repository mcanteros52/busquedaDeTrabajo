import { Link } from 'react-router-dom';
import { Zap, Upload, Search, Star, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <header style={{ padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'var(--color-accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="white" />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>JobMatch AI</span>
        </div>
        <Link to="/dashboard" className="btn btn-primary">
          Ingresar <ArrowRight size={14} />
        </Link>
      </header>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '100px 40px 80px', maxWidth: 700, margin: '0 auto' }}>
        <div className="badge badge-accent" style={{ marginBottom: 24, display: 'inline-flex' }}>
          ✨ Powered by Claude AI
        </div>
        <h1 style={{ fontSize: 52, lineHeight: 1.1, marginBottom: 20, fontFamily: 'var(--font-display)' }}>
          Encontrá trabajo<br />
          <span style={{ color: 'var(--color-accent)' }}>sin el esfuerzo</span>
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 18, marginBottom: 36, maxWidth: 500, margin: '0 auto 36px' }}>
          Subí tu CV, nuestro agente analiza tu perfil y busca en múltiples portales las oportunidades que mejor coinciden con vos.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link to="/dashboard" className="btn btn-primary" style={{ padding: '14px 28px', fontSize: 16 }}>
            Empezar gratis
          </Link>
          <a href="#como-funciona" className="btn btn-secondary" style={{ padding: '14px 28px', fontSize: 16 }}>
            Cómo funciona
          </a>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" style={{ padding: '80px 48px', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, marginBottom: 48 }}>3 pasos, cero hassle</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            { icon: <Upload size={24} />, num: '01', title: 'Subí tu CV', desc: 'Arrastrá tu PDF. El agente extrae toda tu experiencia, skills y tecnologías automáticamente.' },
            { icon: <Search size={24} />, num: '02', title: 'El agente busca', desc: 'Consulta GetOnBoard, Computrabajo, Bumeran y más portales de LATAM en segundos.' },
            { icon: <Star size={24} />, num: '03', title: 'Ves los mejores matches', desc: 'Los trabajos aparecen rankeados por % de coincidencia con una explicación de por qué te conviene cada uno.' },
          ].map(step => (
            <div key={step.num} className="card" style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)', marginBottom: 16 }}>{step.num}</div>
              <div style={{ width: 48, height: 48, background: 'var(--color-surface-2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--color-accent)' }}>
                {step.icon}
              </div>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>{step.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ textAlign: 'center', padding: '80px 40px', borderTop: '1px solid var(--color-border)' }}>
        <h2 style={{ fontSize: 28, marginBottom: 16 }}>¿Buscando trabajo en LATAM?</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 28 }}>Es gratis. No hace falta tarjeta de crédito.</p>
        <Link to="/dashboard" className="btn btn-primary" style={{ padding: '14px 32px', fontSize: 16 }}>
          Activar mi agente <Zap size={16} />
        </Link>
      </section>

      <footer style={{ borderTop: '1px solid var(--color-border)', padding: '24px 48px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
        JobMatch AI — Construido con AWS CDK, Lambda, DynamoDB y Claude
      </footer>
    </div>
  );
}
