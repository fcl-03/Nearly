import { useEffect, useState } from 'react'
import { useToastStore } from '../../stores/toastStore'

// Bannière in-app : descend du haut, puis se rétracte seule après ~3,5 s.
// Déclenchée via useToastStore.show(text, emoji) depuis n'importe où.
export default function InAppBanner() {
  const toast = useToastStore((s) => s.toast)
  const hide = useToastStore((s) => s.hide)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) return
    // Laisse le temps au DOM de monter avant de déclencher la transition
    const show = requestAnimationFrame(() => setVisible(true))
    const t1 = setTimeout(() => setVisible(false), 3500) // remonte
    const t2 = setTimeout(() => hide(), 3850)            // retire du store
    return () => {
      cancelAnimationFrame(show)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [toast?.id, hide])

  if (!toast) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        transform: visible ? 'translateY(0)' : 'translateY(-130%)',
        transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div
        onClick={() => setVisible(false)}
        style={{
          pointerEvents: 'auto',
          maxWidth: 400,
          width: 'calc(100% - 24px)',
          background: 'var(--surface2)',
          border: '1px solid var(--border-color)',
          borderRadius: 14,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 20, flexShrink: 0 }}>{toast.emoji}</span>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {toast.text}
        </p>
      </div>
    </div>
  )
}
