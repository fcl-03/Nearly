import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // Flag de connexion — les vrais tokens sont dans les cookies httpOnly
      accessToken: null,
      user: null,

      setTokens: () => {
        // Les tokens sont dans les cookies httpOnly — on met juste le flag
        set({ accessToken: '__cookie__' })
      },

      setUser: (user) => set({ user }),

      logout: () => {
        set({ accessToken: null, user: null })
        // Reset du thème au défaut (dark) au logout
        localStorage.removeItem('theme')
        document.documentElement.classList.remove('light')
      },

      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'nearly-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
      }),
    }
  )
)
