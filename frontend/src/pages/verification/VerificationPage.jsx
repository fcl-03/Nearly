import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import api from '../../services/api'

// Infos affichées sur l'écran d'introduction
const STEPS_INFO = [
  { emoji: '🤳', title: 'Selfie en temps réel', desc: 'Une photo prise maintenant, pas depuis la galerie' },
  { emoji: '🪪', title: "Pièce d'identité", desc: 'CNI ou passeport — recto seul suffit' },
  { emoji: '👁️', title: 'Vérification humaine', desc: 'Un modérateur vérifie la correspondance — résultat sous 24h' },
  { emoji: '🔒', title: 'Données supprimées après vérif', desc: "La pièce d'identité et le selfie ne sont pas stockés" },
]

// Page de vérification d'identité — Figma: VerificationScreen
export default function VerificationPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('intro') // intro | selfie | id | done
  const [selfie, setSelfie] = useState(null)
  const [idCard, setIdCard] = useState(null)
  const [selfiePreview, setSelfiePreview] = useState(null)
  const [idPreview, setIdPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [camError, setCamError] = useState('')
  const [capturing, setCapturing] = useState(false)
  const videoRef = useRef()
  const canvasRef = useRef()
  const streamRef = useRef()
  const idRef = useRef()

  // Démarrer la caméra frontale quand on passe à l'étape selfie
  useEffect(() => {
    if (step !== 'selfie' || selfiePreview) return

    async function startCamera() {
      setCamError('')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch {
        setCamError("Impossible d'accéder à la caméra. Vérifie les permissions de ton navigateur.")
      }
    }
    startCamera()

    return () => {
      // Arrêter le flux quand on quitte l'étape
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [step, selfiePreview])

  // Capturer une frame depuis le flux vidéo
  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    setCapturing(true)
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)

    canvas.toBlob(blob => {
      if (!blob) return
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' })
      setSelfie(file)
      setSelfiePreview(URL.createObjectURL(file))
      // Arrêter la caméra
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setTimeout(() => {
        setCapturing(false)
        setStep('id')
      }, 300)
    }, 'image/jpeg', 0.92)
  }, [])

  // La pièce d'identité peut venir de la galerie ou de la caméra (pas de contrainte)
  function pickId(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setIdCard(f)
    setIdPreview(URL.createObjectURL(f))
  }

  async function handleSubmit() {
    if (!selfie || !idCard) return
    setError('')
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('selfie', selfie)
      fd.append('id_card', idCard)
      await api.post('/verification/submit', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setStep('done')
    } catch (err) {
      const s = err.response?.status
      if (s === 403) setError('Tu dois vérifier ton email avant de soumettre une vérification.')
      else setError('Une erreur est survenue. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', padding: '0 20px' }}>

      {/* ── En-tête ── */}
      <div style={{ padding: '20px 0 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => {
            // Naviguer entre les étapes avant de quitter la page
            if (step === 'id') { setStep('selfie'); setIdCard(null); setIdPreview(null) }
            else if (step === 'selfie') { setStep('intro'); setSelfie(null); setSelfiePreview(null) }
            else navigate(-1)
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
          }}
          aria-label="Retour"
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
      </div>

      {/* ── INTRO ── */}
      {step === 'intro' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, paddingBottom: 32 }}>

          {/* Icône animée pulsation */}
          <div
            style={{
              width: 90,
              height: 90,
              borderRadius: '50%',
              border: '2px solid var(--accent)',
              background: 'var(--surface2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              marginBottom: 24,
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            🪪
          </div>

          <h1
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: 28,
              color: 'var(--text)',
              textAlign: 'center',
              marginBottom: 10,
            }}
          >
            Vérification requise
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              textAlign: 'center',
              fontSize: 14,
              lineHeight: 1.6,
              marginBottom: 28,
            }}
          >
            Pour rejoindre ta première sortie, on vérifie ton identité.{' '}
            <strong style={{ color: 'var(--text)' }}>Une seule fois.</strong>
          </p>

          {/* Cartes d'info */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {STEPS_INFO.map((s, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <span style={{ fontSize: 24, flexShrink: 0 }}>{s.emoji}</span>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', margin: 0 }}>
                    {s.title}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20 }}>
            Une fois vérifié, le badge{' '}
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>Vérifié ✓</span>{' '}
            apparaît sur ton profil
          </p>

          <button
            onClick={() => setStep('selfie')}
            style={{
              width: '100%',
              background: 'var(--accent)',
              color: 'var(--bg)',
              fontWeight: 700,
              fontSize: 15,
              padding: '14px 0',
              borderRadius: 11,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Commencer la vérification →
          </button>
        </div>
      )}

      {/* ── SELFIE ── viewfinder caméra live, pas de galerie possible */}
      {step === 'selfie' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingBottom: 32 }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, marginBottom: 8, color: 'var(--text)' }}>
            Ton selfie
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
            Regarde la caméra et appuie sur le bouton.
          </p>

          {/* Canvas caché pour la capture */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {camError ? (
            /* Erreur d'accès caméra */
            <div style={{
              background: 'rgba(255,122,61,0.1)',
              border: '1px solid rgba(255,122,61,0.3)',
              borderRadius: 14,
              padding: '20px 16px',
              textAlign: 'center',
              marginBottom: 24,
            }}>
              <span style={{ fontSize: 32 }}>📵</span>
              <p style={{ color: 'var(--orange)', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>{camError}</p>
            </div>
          ) : (
            /* Viewfinder circulaire */
            <div style={{
              position: 'relative',
              width: 220,
              height: 220,
              borderRadius: '50%',
              overflow: 'hidden',
              margin: '0 auto 28px',
              border: `3px solid ${capturing ? 'var(--accent)' : 'var(--border-color)'}`,
              background: 'var(--surface2)',
              transition: 'border-color 0.15s',
              flexShrink: 0,
            }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)', // miroir naturel pour selfie
                }}
              />
              {/* Flash blanc au moment de la capture */}
              {capturing && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(255,255,255,0.6)',
                  borderRadius: '50%',
                }} />
              )}
            </div>
          )}

          <button
            onClick={captureFrame}
            disabled={!!camError || capturing}
            style={{
              width: '100%',
              background: camError ? 'var(--surface2)' : 'var(--accent)',
              color: camError ? 'var(--text-secondary)' : 'var(--bg)',
              fontWeight: 700,
              fontSize: 15,
              padding: '14px 0',
              borderRadius: 11,
              border: 'none',
              cursor: camError || capturing ? 'not-allowed' : 'pointer',
              opacity: capturing ? 0.8 : 1,
              fontFamily: 'DM Sans, sans-serif',
              transition: 'opacity 0.15s',
            }}
          >
            {capturing ? 'Capture…' : '📸 Prendre le selfie'}
          </button>
        </div>
      )}

      {/* ── PIÈCE D'IDENTITÉ ── */}
      {step === 'id' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingBottom: 32 }}>
          <h2
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: 24,
              marginBottom: 8,
              color: 'var(--text)',
            }}
          >
            Ta pièce d'identité
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
            CNI ou passeport — recto uniquement.
          </p>

          {/* Récap selfie */}
          <div
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <img
              src={selfiePreview}
              alt="selfie"
              style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Selfie ✓</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Photo prise avec succès</p>
            </div>
          </div>

          {/* Zone pièce d'identité */}
          <button
            onClick={() => idRef.current.click()}
            style={{
              width: '100%',
              height: 160,
              background: 'var(--surface2)',
              border: `2px dashed ${idPreview ? 'var(--accent)' : 'var(--border-color)'}`,
              borderRadius: 18,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              overflow: 'hidden',
              marginBottom: 20,
              transition: 'border-color 0.15s',
            }}
          >
            {idPreview ? (
              <img src={idPreview} alt="ID" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <>
                <span style={{ fontSize: 40 }}>🪪</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Appuie pour photographier</span>
              </>
            )}
          </button>
          <input
            ref={idRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={pickId}
          />

          {/* Message d'erreur */}
          {error && (
            <div
              style={{
                background: 'rgba(255,122,61,0.1)',
                border: '1px solid rgba(255,122,61,0.2)',
                borderRadius: 11,
                padding: '12px 16px',
                color: 'var(--orange)',
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!idCard && (
              <button
                onClick={() => idRef.current.click()}
                style={{
                  width: '100%',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  fontWeight: 600,
                  fontSize: 15,
                  padding: '13px 0',
                  borderRadius: 11,
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Photographier la pièce 📷
              </button>
            )}
            {idCard && (
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  width: '100%',
                  background: 'var(--accent)',
                  color: 'var(--bg)',
                  fontWeight: 700,
                  fontSize: 15,
                  padding: '14px 0',
                  borderRadius: 11,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {loading && (
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: '2px solid color-mix(in srgb, var(--on-accent) 30%, transparent)',
                      borderTop: '2px solid var(--on-accent)',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      display: 'inline-block',
                    }}
                  />
                )}
                Envoyer pour vérification →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {step === 'done' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            paddingTop: 48,
            paddingBottom: 32,
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 64, marginBottom: 16 }}>🎉</span>
          <h2
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: 28,
              marginBottom: 12,
              color: 'var(--text)',
            }}
          >
            Demande envoyée !
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
            Un modérateur va vérifier ta correspondance.<br />
            <strong style={{ color: 'var(--text)' }}>Résultat sous 24h.</strong><br /><br />
            Tu recevras une notification dès que c'est validé.
          </p>
          <button
            onClick={() => navigate('/events')}
            style={{
              width: '100%',
              background: 'var(--accent)',
              color: 'var(--bg)',
              fontWeight: 700,
              fontSize: 15,
              padding: '14px 0',
              borderRadius: 11,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Explorer les sorties
          </button>
        </div>
      )}

      {/* Keyframe pulse pour l'icône intro */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(232,255,71,0.3); }
          50% { box-shadow: 0 0 0 14px rgba(232,255,71,0); }
        }
      `}</style>
    </div>
  )
}
