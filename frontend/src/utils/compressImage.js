// Compresse / redimensionne une image côté client AVANT l'upload (via canvas).
// Objectif : une photo iPhone brute (2-5 Mo) → ~200-400 Ko → upload quasi instantané.
// Bonus : convertit le HEIC iPhone en JPEG (Safari sait décoder le HEIC sur un canvas),
// ce qui évite les rejets de format côté backend.
// En cas d'échec (format non décodable, ex. HEIC sur Chrome desktop), renvoie l'original.
export async function compressImage(file, { maxSize = 1280, quality = 0.82 } = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file
  try {
    const img = await loadImage(file)
    let width = img.naturalWidth || img.width
    let height = img.naturalHeight || img.height
    if (!width || !height) return file

    if (width > maxSize || height > maxSize) {
      const ratio = Math.min(maxSize / width, maxSize / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(img, 0, 0, width, height)

    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob) return file

    const name = (file.name || 'image').replace(/\.\w+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}
