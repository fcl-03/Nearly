// Source de vérité unique pour les plans Business Nearly.
// Toute modification de prix / avantage / limite passe par ici.

export const BUSINESS_PLANS = {
  starter: {
    key: 'starter',
    label: 'Starter',
    price: 29,
    priceLabel: '29 €/mois',
    color: 'var(--blue)',
    badgeLabel: 'Partenaire',
    sortiesPerMonth: 4,           // ≈ 1 par semaine
    sortiesLabel: '4 sorties/mois',
    feedPriority: 'standard',     // 'standard' | 'priority' | 'pinned'
    features: {
      logo: true,
      address: true,
      externalLink: true,
      coverPhoto: false,
      promoCode: false,
      basicStats: false,
      advancedStats: false,
      miniPage: false,
      multiLocation: false,
      pushNotifs: false,
    },
    supportLevel: 'standard',
  },
  pro: {
    key: 'pro',
    label: 'Pro',
    price: 79,
    priceLabel: '79 €/mois',
    color: 'var(--violet)',
    badgeLabel: 'Partenaire Pro',
    sortiesPerMonth: 12,          // ≈ 3 par semaine
    sortiesLabel: '12 sorties/mois',
    feedPriority: 'priority',     // top 3 du feed
    features: {
      logo: true,
      address: true,
      externalLink: true,
      coverPhoto: true,
      promoCode: true,
      basicStats: true,
      advancedStats: false,
      miniPage: false,
      multiLocation: false,
      pushNotifs: false,
    },
    supportLevel: 'priority',
  },
  exclusif: {
    key: 'exclusif',
    label: 'Exclusif',
    price: 199,
    priceLabel: '199 €/mois',
    color: '#FFB800',
    badgeLabel: 'Partenaire Premium',
    sortiesPerMonth: null,        // illimité
    sortiesLabel: 'Sorties illimitées',
    feedPriority: 'pinned',       // bannière épinglée en haut du feed
    features: {
      logo: true,
      address: true,
      externalLink: true,
      coverPhoto: true,
      promoCode: true,
      basicStats: true,
      advancedStats: true,
      miniPage: true,
      multiLocation: true,
      pushNotifs: true,
    },
    supportLevel: 'dedicated',
  },
}

export function getPlan(planKey) {
  return BUSINESS_PLANS[planKey] || BUSINESS_PLANS.starter
}

// Liste des avantages pour affichage marketing (tableau comparatif)
export const PLAN_FEATURES = [
  { key: 'sortiesPerMonth', label: 'Sorties sponsorisées' },
  { key: 'feedPriority', label: 'Position dans le feed' },
  { key: 'logo', label: 'Logo + adresse + lien' },
  { key: 'coverPhoto', label: 'Photo de couverture' },
  { key: 'promoCode', label: 'Code promo personnalisable' },
  { key: 'basicStats', label: 'Stats (vues, inscrits)' },
  { key: 'advancedStats', label: 'Insights démographiques' },
  { key: 'miniPage', label: 'Mini-page du commerce' },
  { key: 'multiLocation', label: 'Multi-établissements' },
  { key: 'pushNotifs', label: 'Notifs push aux fans' },
  { key: 'supportLevel', label: 'Support' },
]
