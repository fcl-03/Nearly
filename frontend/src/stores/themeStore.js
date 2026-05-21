import { create } from 'zustand'

// Appliquer le thème stocké au chargement
const stored = localStorage.getItem('theme') || 'dark'
document.documentElement.classList.toggle('light', stored === 'light')

export const useThemeStore = create(set => ({
  theme: stored,

  toggleTheme: () => set(state => {
    const next = state.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', next)
    document.documentElement.classList.toggle('light', next === 'light')
    return { theme: next }
  }),
}))
