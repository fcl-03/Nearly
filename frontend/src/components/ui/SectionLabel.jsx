// Petit label de section en capitales — réutilisé sur toutes les pages
export default function SectionLabel({ children, mb = 12 }) {
  return (
    <p
      style={{
        fontSize: 10,
        fontFamily: 'Syne, sans-serif',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--text-tertiary)',
        marginBottom: mb,
      }}
    >
      {children}
    </p>
  )
}
