export default function Spinner({ size = 'md' }) {
  const s = { sm: 'w-5 h-5 border-2', md: 'w-9 h-9 border-2', lg: 'w-14 h-14 border-3' }
  return <div className={`${s[size]} border-[#252836] border-t-[#E8FF47] rounded-full animate-spin`} />
}
