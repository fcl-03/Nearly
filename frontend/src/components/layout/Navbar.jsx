import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import api from '../../services/api'

export default function Navbar() {
  const { t } = useTranslation()
  const location = useLocation()
  const { user, logout } = useAuthStore()

  async function handleLogout() {
    try {
      await api.post('/auth/logout')
    } catch {}
    logout()
  }

  const isActive = (path) => location.pathname.startsWith(path)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#13151C] border-t border-[#252836] md:top-0 md:bottom-auto md:border-t-0 md:border-b">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo — desktop uniquement */}
        <Link to="/" className="hidden md:flex items-center gap-2 font-bold text-xl" style={{ fontFamily: 'Syne, sans-serif' }}>
          <span className="text-[#E8FF47]">Nearly</span>
        </Link>

        {/* Navigation */}
        <div className="flex items-center justify-around w-full md:w-auto md:gap-6">
          <NavItem to="/events" label={t('nav.explore')} icon="🗺️" active={isActive('/events')} />
          <NavItem to="/events/new" label={t('nav.create')} icon="✚" active={isActive('/events/new')} accent />
          <NavItem to="/profile" label={t('nav.profile')} icon="👤" active={isActive('/profile')} />
          {user?.is_admin && (
            <NavItem to="/admin" label={t('nav.admin')} icon="⚙️" active={isActive('/admin')} />
          )}
        </div>

        {/* Logout — desktop uniquement */}
        <button onClick={handleLogout} className="hidden md:block text-sm text-[#858AA8] hover:text-[#F0F2F8] transition-colors">
          {t('auth.logout')}
        </button>
      </div>
    </nav>
  )
}

function NavItem({ to, label, icon, active, accent }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-[11px] text-xs font-medium transition-colors
        ${active
          ? accent ? 'text-[#0B0D11] bg-[#E8FF47]' : 'text-[#E8FF47]'
          : 'text-[#858AA8] hover:text-[#F0F2F8]'
        }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
