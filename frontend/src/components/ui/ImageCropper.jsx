import { useState, useRef, useEffect, useCallback } from 'react'

// Modale de recadrage d'une image dans un cadre ROND (photo de profil).
// L'utilisateur déplace (drag) et zoome (slider / pinch) ; on exporte la zone
// visible du cadre en JPEG carré. Props : { file, onCancel, onConfirm(croppedFile), output=512 }
export default function ImageCropper({ file, onCancel, onConfirm, output = 512 }) {
  const [img, setImg] = useState(null)       // HTMLImageElement
  const [scale, setScale] = useState(1)
  const [minScale, setMinScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const frameRef = useRef(null)              // taille réelle du cadre (px écran)
  const drag = useRef(null)
  const pinch = useRef(null)

  // Charger l'image + calculer le zoom minimal (pour couvrir le cadre)
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      setImg(image)
    }
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Quand l'image est prête, ajuster le zoom min pour qu'elle couvre le cadre
  useEffect(() => {
    if (!img || !frameRef.current) return
    const frame = frameRef.current.offsetWidth
    const base = Math.max(frame / img.width, frame / img.height)
    setMinScale(base)
    setScale(base)
    setOffset({ x: 0, y: 0 })
  }, [img])

  // Contrainte : empêcher les bords blancs
  const clamp = useCallback((off, s) => {
    if (!img || !frameRef.current) return off
    const frame = frameRef.current.offsetWidth
    const w = img.width * s, h = img.height * s
    const maxX = Math.max(0, (w - frame) / 2)
    const maxY = Math.max(0, (h - frame) / 2)
    return {
      x: Math.max(-maxX, Math.min(maxX, off.x)),
      y: Math.max(-maxY, Math.min(maxY, off.y)),
    }
  }, [img])

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinch.current = { dist: Math.hypot(dx, dy), scale }
    } else {
      drag.current = { x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y }
    }
  }
  function onTouchMove(e) {
    e.preventDefault()
    if (e.touches.length === 2 && pinch.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const d = Math.hypot(dx, dy)
      const next = Math.max(minScale, Math.min(minScale * 4, pinch.current.scale * (d / pinch.current.dist)))
      setScale(next)
      setOffset(o => clamp(o, next))
    } else if (drag.current) {
      const next = { x: e.touches[0].clientX - drag.current.x, y: e.touches[0].clientY - drag.current.y }
      setOffset(clamp(next, scale))
    }
  }
  function onTouchEnd() { drag.current = null; pinch.current = null }

  async function handleConfirm() {
    if (!img || !frameRef.current) return
    setSaving(true)
    const frame = frameRef.current.offsetWidth
    const ratio = output / frame
    const canvas = document.createElement('canvas')
    canvas.width = output
    canvas.height = output
    const ctx = canvas.getContext('2d')
    // Position du coin haut-gauche de l'image dans le repère du cadre
    const drawW = img.width * scale * ratio
    const drawH = img.height * scale * ratio
    const cx = output / 2 + offset.x * ratio
    const cy = output / 2 + offset.y * ratio
    ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH)
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85))
    setSaving(false)
    if (blob) onConfirm(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <p style={{ color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 20 }}>Recadre ta photo</p>

      {/* Cadre rond */}
      <div
        ref={frameRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          width: 'min(72vw, 300px)', aspectRatio: '1', borderRadius: '50%',
          overflow: 'hidden', position: 'relative', background: '#111',
          touchAction: 'none', cursor: 'grab', boxShadow: '0 0 0 3px var(--accent)',
        }}
      >
        {img && (
          <img
            src={img.src}
            alt=""
            draggable={false}
            style={{
              position: 'absolute', left: '50%', top: '50%',
              width: img.width * scale, height: img.height * scale,
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              maxWidth: 'none', userSelect: 'none', pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Slider de zoom */}
      <input
        type="range" min={minScale} max={minScale * 4} step="0.01" value={scale}
        onChange={e => { const s = parseFloat(e.target.value); setScale(s); setOffset(o => clamp(o, s)) }}
        style={{ width: 'min(72vw, 300px)', marginTop: 24, accentColor: 'var(--accent)' }}
      />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, marginTop: 24, width: 'min(72vw, 300px)' }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '12px 0', borderRadius: 11, border: '1px solid #444', background: 'none', color: '#fff', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: 'pointer' }}>
          Annuler
        </button>
        <button onClick={handleConfirm} disabled={saving || !img} style={{ flex: 1, padding: '12px 0', borderRadius: 11, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontFamily: 'Syne, sans-serif', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? '…' : 'Valider'}
        </button>
      </div>
    </div>
  )
}
