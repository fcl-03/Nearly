export default function Input({ label, error, hint, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold tracking-wider text-[#6B7080] uppercase">{label}</label>}
      <input
        className={`
          w-full bg-[#13151C] border rounded-[14px]
          px-4 py-3.5 text-white placeholder-[#4A5060] text-[15px]
          outline-none transition-colors
          ${error ? 'border-[#FF7A3D]' : 'border-[#252836] focus:border-[#E8FF47]/60'}
          ${className}
        `}
        {...props}
      />
      {error && <span className="text-xs text-[#FF7A3D]">{error}</span>}
      {hint && !error && <span className="text-xs text-[#6B7080]">{hint}</span>}
    </div>
  )
}
