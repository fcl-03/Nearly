import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Zap } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import api from '../../services/api'

const FEATURES = [
  { icon: '🚫', text: 'Zéro publicité — profite du feed sans aucune annonce' },
  { icon: '🔝', text: 'Sorties mises en avant — tes sorties apparaissent en tête de liste avec un style doré' },
  { icon: '⭐', text: 'Badge Premium visible sur ton profil' },
  { icon: '💬', text: 'Historique de chat illimité — tes conversations de groupe ne s\'effacent jamais' },
  { icon: '🚀', text: 'Accès prioritaire aux nouvelles fonctionnalités' },
]

// Page de présentation de l'offre Premium
export default function PremiumPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubscribe() {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post('/payments/create-checkout')
      window.location.href = data.url
    } catch (err) {
      setError(err.response?.data?.detail || 'Une erreur est survenue.')
      setLoading(false)
    }
  }

  async function handleManage() {
    setLoading(true)
    try {
      const { data } = await api.post('/payments/portal')
      window.location.href = data.url
    } catch (err) {
      setError(err.response?.data?.detail || 'Une erreur est survenue.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', overflowY: 'auto' }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', borderBottom: '1px solid var(--border-color)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text)' }}>
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--text)', margin: 0, flex: 1 }}>
          Nearly Premium
        </h1>
      </div>

      <div style={{ padding: '32px 20px 80px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Hero */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>⚡</div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 28, color: 'var(--text)', margin: '0 0 10px' }}>
            Passe à la vitesse{' '}
            <span style={{ color: 'var(--accent)' }}>supérieure</span>
          </h2>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Profite de Nearly sans limites et soutiens le projet.
          </p>
        </div>

        {/* Prix */}
        <div style={{ background: 'var(--surface2)', border: '2px solid var(--accent)', borderRadius: 18, padding: '24px 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Abonnement mensuel
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 4 }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>€</span>
            <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 52, fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>4</span>
            <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 700, color: 'var(--accent)', marginTop: 14 }}>,99</span>
          </div>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
            Sans engagement · résiliable à tout moment
          </p>
        </div>

        {/* Fonctionnalités */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, background: 'var(--surface2)', borderRadius: 14, padding: '14px 16px' }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{f.icon}</span>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>
                {f.text}
              </p>
            </div>
          ))}
        </div>

        {/* Erreur */}
        {error && (
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--orange)', textAlign: 'center', margin: 0 }}>
            {error}
          </p>
        )}

        {/* CTA */}
        {user?.is_premium ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'rgba(61,219,130,0.08)', border: '1.5px solid rgba(61,219,130,0.3)', borderRadius: 14, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Check size={20} color="var(--green)" />
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--green)', margin: 0 }}>
                Tu es déjà Premium ⭐
              </p>
            </div>
            <button
              onClick={handleManage}
              disabled={loading}
              style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 11, padding: '14px 0', color: 'var(--text-secondary)', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
            >
              {loading ? 'Chargement…' : 'Gérer mon abonnement'}
            </button>
            {error && error.includes('Aucun abonnement') && (
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                Ton abonnement Premium a été activé manuellement. Pour le gérer via Stripe, contacte le support.
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={handleSubscribe}
            disabled={loading}
            style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 11, padding: '16px 0', color: 'var(--bg)', fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {loading ? 'Chargement…' : <><Zap size={18} />Passer Premium — 4,99 €/mois</>}
          </button>
        )}

        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
          Paiement sécurisé par Stripe. Tu peux annuler à tout moment depuis les paramètres.
        </p>

      </div>
    </div>
  )
}
