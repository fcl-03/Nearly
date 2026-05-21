import { ExternalLink } from 'lucide-react'

/**
 * Carte publicitaire native insérée dans le feed des sorties.
 * Style similaire à une EventCard mais avec un tag "Sponsorisé".
 */
export default function AdCard({ ad }) {
  const handleClick = () => {
    // Passe par le backend pour tracker le clic puis redirige
    window.open(`/api/v1/ads/${ad.id}/click`, '_blank', 'noopener')
  }

  return (
    <button
      onClick={handleClick}
      style={{
        width: '100%',
        background: 'var(--surface2)',
        border: '1px solid var(--border-color)',
        borderRadius: 18,
        overflow: 'hidden',
        cursor: 'pointer',
        textAlign: 'left',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Image */}
      {ad.image_url && (
        <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden' }}>
          <img
            src={ad.image_url}
            alt={ad.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      {/* Contenu */}
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Tag sponsorisé */}
        <span
          style={{
            alignSelf: 'flex-start',
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'DM Sans, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-tertiary)',
            background: 'var(--bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 999,
            padding: '3px 10px',
          }}
        >
          Sponsorisé
        </span>

        {/* Titre */}
        <h3
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: 16,
            color: 'var(--text)',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {ad.title}
        </h3>

        {/* Description */}
        {ad.description && (
          <p
            style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 13,
              color: 'var(--text-secondary)',
              margin: 0,
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {ad.description}
          </p>
        )}

        {/* CTA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'DM Sans, sans-serif',
            color: 'var(--accent-text)',
            marginTop: 4,
          }}
        >
          {ad.cta_label}
          <ExternalLink size={13} />
        </div>
      </div>
    </button>
  )
}
