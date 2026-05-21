export default function Button({ children, variant = 'primary', size = 'md', className = '', loading = false, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-[14px] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]'

  const variants = {
    primary:   'bg-[#E8FF47] text-[#0D0E14]  hover:bg-[#d4eb38]',
    secondary: 'bg-[#1A1C26] text-[#FFFFFF]  border border-[#252836] hover:border-[#E8FF47]/40',
    ghost:     'text-[#6B7080] hover:text-white',
    danger:    'bg-[#FF7A3D]/10 text-[#FF7A3D] border border-[#FF7A3D]/30 hover:bg-[#FF7A3D]/20',
  }

  const sizes = {
    sm: 'text-sm px-4 py-2',
    md: 'text-[15px] px-5 py-3.5',
    lg: 'text-base px-6 py-4 w-full',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />}
      {children}
    </button>
  )
}
