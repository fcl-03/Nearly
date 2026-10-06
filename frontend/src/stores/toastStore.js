import { create } from 'zustand'

// Bannière in-app (toast) — affichée en haut de l'app quand un message/alerte
// arrive pendant qu'on utilise l'app. Pas de notification système.
export const useToastStore = create((set) => ({
  toast: null, // { id, text, emoji }
  show: (text, emoji = '💬') => set({ toast: { id: Date.now(), text, emoji } }),
  hide: () => set({ toast: null }),
}))
