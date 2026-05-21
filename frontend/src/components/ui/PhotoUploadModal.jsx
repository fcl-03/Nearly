import { useState, useEffect, useRef } from 'react'
import { X, Image, Tag, ChevronRight, Check } from 'lucide-react'
import api from '../../services/api'
import Spinner from './Spinner'

/**
 * Modal d'upload photo Instagram-style.
 * Étape 1 : sélection du fichier (ou fourni directement via `initialFile`)
 * Étape 2 : aperçu + description + tag des amis → publication
 */
export default function PhotoUploadModal({ onClose, onPublished, initialFile = null }) {
  const [step, setStep] = useState(initialFile ? 2 : 1) // 1=sélection, 2=édition
  const [file, setFile] = useState(initialFile)
  const [preview, setPreview] = useState(null)
  const [description, setDescription] = useState('')
  const [friends, setFriends] = useState([])
  const [tagSearch, setTagSearch] = useState('')
  const [tagged, setTagged] = useState([]) // [{id, first_name, avatar_url}]
  const [loading, setLoading] = useState(false)
  const [friendsLoading, setFriendsLoading] = useState(false)
  const fileRef = useRef()

  // Générer l'aperçu dès qu'un fichier est choisi
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Charger la liste d'amis pour le tag
  useEffect(() => {
    if (step !== 2) return
    setFriendsLoading(true)
    api.get('/users/me/friends')
      .then(({ data }) => setFriends(data))
      .catch(() => {})
      .finally(() => setFriendsLoading(false))
  }, [step])

  // Initialiser l'aperçu si un fichier initial est fourni
  useEffect(() => {
    if (initialFile) {
      setFile(initialFile)
      setStep(2)
    }
  }, [initialFile])

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setStep(2)
  }

  function toggleTag(friend) {
    setTagged(prev =>
      prev.some(t => t.id === friend.id)
        ? prev.filter(t => t.id !== friend.id)
        : [...prev, friend]
    )
  }

  async function handlePublish() {
    if (!file) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('photo', file)
      if (description.trim()) fd.append('description', description.trim())
      if (tagged.length > 0) fd.append('tags', JSON.stringify(tagged.map(t => t.id)))
      const { data } = await api.post('/users/me/photos', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onPublished?.(data)
      onClose()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Erreur lors de la publication')
    } finally {
      setLoading(false)
    }
  }

  const filteredFriends = friends.filter(f =>
    f.first_name?.toLowerCase().includes(tagSearch.toLowerCase())
  )

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: '24px 24px 0 0',
          width: '100%',
          maxWidth: 480,
          maxHeight: '92dvh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        {/* En-tête */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
            {step === 1 ? 'Nouvelle photo' : 'Publier'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={20} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* ── Étape 1 : Sélection du fichier ── */}
          {step === 1 && (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 120, height: 120, borderRadius: 20,
                background: 'var(--surface2)', border: '2px dashed var(--border-color)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Image size={36} color="var(--text-tertiary)" />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', lineHeight: 1.5 }}>
                Choisis une photo depuis ta galerie
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  background: 'var(--accent)', color: 'var(--on-accent)',
                  border: 'none', borderRadius: 12, padding: '12px 28px',
                  fontWeight: 700, fontSize: 15, cursor: 'pointer',
                  fontFamily: 'Syne, sans-serif',
                }}
              >
                Choisir une photo
              </button>
            </div>
          )}

          {/* ── Étape 2 : Aperçu + description + tags ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Aperçu de la photo */}
              {preview && (
                <div style={{ position: 'relative', width: '100%', aspectRatio: '1', overflow: 'hidden', background: 'var(--surface2)' }}>
                  <img
                    src={preview}
                    alt="Aperçu"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {/* Bouton changer la photo */}
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{
                      position: 'absolute', bottom: 10, right: 10,
                      background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 8,
                      padding: '6px 12px', fontSize: 12, color: '#fff', cursor: 'pointer',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    Changer
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </div>
              )}

              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Description */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Ajoute une légende..."
                    maxLength={300}
                    rows={3}
                    style={{
                      width: '100%', background: 'var(--surface2)', border: '1px solid var(--border-color)',
                      borderRadius: 12, padding: '10px 14px', color: 'var(--text)', fontSize: 14,
                      resize: 'none', outline: 'none', fontFamily: 'DM Sans, sans-serif',
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 4 }}>
                    {description.length}/300
                  </div>
                </div>

                {/* Tag des amis */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Tag size={14} color="var(--text-secondary)" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Taguer des amis
                    </span>
                  </div>

                  {/* Tags sélectionnés */}
                  {tagged.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {tagged.map(t => (
                        <button
                          key={t.id}
                          onClick={() => toggleTag(t)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            background: 'rgba(232,255,71,0.12)', border: `1px solid var(--accent-border)`,
                            borderRadius: 999, padding: '4px 10px',
                            fontSize: 12, fontWeight: 600, color: 'var(--accent-text)',
                            cursor: 'pointer',
                          }}
                        >
                          {t.first_name}
                          <X size={11} />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Recherche d'amis */}
                  <input
                    type="text"
                    value={tagSearch}
                    onChange={e => setTagSearch(e.target.value)}
                    placeholder="Rechercher un ami..."
                    style={{
                      width: '100%', background: 'var(--surface2)', border: '1px solid var(--border-color)',
                      borderRadius: 10, padding: '8px 12px', color: 'var(--text)', fontSize: 14,
                      outline: 'none', fontFamily: 'DM Sans, sans-serif', marginBottom: 8,
                    }}
                  />

                  {/* Liste des amis */}
                  {friendsLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
                      <Spinner size="sm" />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 160, overflowY: 'auto' }}>
                      {filteredFriends.length === 0 && (
                        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '8px 0' }}>
                          {friends.length === 0 ? 'Aucun ami pour le moment' : 'Aucun résultat'}
                        </p>
                      )}
                      {filteredFriends.map(friend => {
                        const isTagged = tagged.some(t => t.id === friend.id)
                        return (
                          <button
                            key={friend.id}
                            onClick={() => toggleTag(friend)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              background: isTagged ? 'rgba(232,255,71,0.07)' : 'transparent',
                              border: 'none', borderRadius: 10, padding: '8px 10px',
                              cursor: 'pointer', textAlign: 'left', width: '100%',
                            }}
                          >
                            <div style={{
                              width: 34, height: 34, borderRadius: '50%',
                              background: 'var(--surface3)', overflow: 'hidden', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
                            }}>
                              {friend.avatar_url
                                ? <img src={friend.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : friend.first_name?.[0]?.toUpperCase()
                              }
                            </div>
                            <span style={{ fontSize: 14, color: 'var(--text)', flex: 1 }}>
                              {friend.first_name}
                            </span>
                            {isTagged && <Check size={16} color="var(--accent-text)" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bouton publier */}
        {step === 2 && (
          <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
            <button
              onClick={handlePublish}
              disabled={loading || !file}
              style={{
                width: '100%', background: 'var(--accent)', color: 'var(--on-accent)',
                border: 'none', borderRadius: 14, padding: '14px',
                fontWeight: 700, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                fontFamily: 'Syne, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? <Spinner size="sm" /> : 'Publier'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
