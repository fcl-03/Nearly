import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

// Page CGU — Conditions Générales d'Utilisation
export default function TermsPage() {
  const navigate = useNavigate()

  const sectionTitle = {
    fontFamily: 'Syne, sans-serif',
    fontWeight: 700,
    fontSize: 18,
    color: 'var(--accent)',
    margin: '32px 0 12px',
    lineHeight: 1.3,
  }

  const subTitle = {
    fontFamily: 'Syne, sans-serif',
    fontWeight: 700,
    fontSize: 15,
    color: 'var(--text)',
    margin: '20px 0 8px',
  }

  const body = {
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 14,
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
    margin: '0 0 12px',
  }

  const li = {
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 14,
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
    marginBottom: 6,
  }

  const highlight = {
    background: 'var(--surface2)',
    border: '1px solid var(--border-color)',
    borderRadius: 11,
    padding: '14px 16px',
    marginBottom: 16,
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', overflowY: 'auto' }}>
      {/* En-tête */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', borderBottom: '1px solid var(--border-color)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text)' }}
          aria-label="Retour"
        >
          <ArrowLeft size={22} color="var(--text)" />
        </button>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--text)', margin: 0 }}>
          Conditions Générales d'Utilisation
        </h1>
      </div>

      <div style={{ padding: '20px 20px 60px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.2 }}>
          Conditions Générales d'Utilisation
        </h2>
        <p style={{ ...body, color: 'var(--text-tertiary)', fontSize: 13 }}>
          Dernière mise à jour : 14 mars 2026 · Version 1.0
        </p>

        <div style={{ height: 1, background: 'var(--border-color)', margin: '8px 0' }} />

        <p style={body}>
          Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») régissent l'accès et l'utilisation de l'application Nearly (ci-après « l'Application »), éditée par Nearly SAS. En utilisant l'Application, vous acceptez les présentes CGU dans leur intégralité.
        </p>
        <p style={body}>
          Les CGU complètent la Politique de confidentialité & Charte disponible dans l'Application. En cas de contradiction, les présentes CGU prévalent pour les aspects relatifs à l'utilisation du service.
        </p>

        {/* Article 1 */}
        <h2 style={sectionTitle}>1. Objet du service</h2>
        <p style={body}>
          Nearly est une application sociale permettant à des personnes majeures (18 ans et plus) d'organiser et de participer à des sorties informelles en petits groupes (3 à 6 personnes) dans les villes françaises. Le service comprend :
        </p>
        <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
          <li style={li}>La création et la consultation de sorties géolocalisées</li>
          <li style={li}>La participation à des sorties proposées par d'autres utilisateurs</li>
          <li style={li}>Un système de messagerie de groupe lié aux sorties</li>
          <li style={li}>Un système de messagerie privée entre amis</li>
          <li style={li}>Un système de vérification d'identité volontaire</li>
          <li style={li}>Un abonnement Premium optionnel</li>
        </ul>

        {/* Article 2 */}
        <h2 style={sectionTitle}>2. Inscription et compte</h2>
        <h3 style={subTitle}>2.1 Conditions d'inscription</h3>
        <p style={body}>Pour créer un compte Nearly, vous devez :</p>
        <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
          <li style={li}>Être âgé(e) d'au moins 18 ans</li>
          <li style={li}>Fournir un prénom et une adresse e-mail valides</li>
          <li style={li}>Accepter les présentes CGU et la Charte de confidentialité</li>
          <li style={li}>Créer un mot de passe sécurisé (8 caractères minimum)</li>
        </ul>

        <h3 style={subTitle}>2.2 Responsabilité du compte</h3>
        <p style={body}>
          Vous êtes seul(e) responsable de la confidentialité de vos identifiants de connexion et de toute activité effectuée depuis votre compte. En cas de suspicion d'utilisation frauduleuse, vous devez nous contacter immédiatement à <a href="mailto:contact@nearly.app" style={{ color: 'var(--accent)', textDecoration: 'none' }}>contact@nearly.app</a>.
        </p>

        <h3 style={subTitle}>2.3 Vérification de l'email</h3>
        <p style={body}>
          Un email de vérification vous est envoyé lors de l'inscription. Vous disposez de 3 jours pour confirmer votre adresse. Passé ce délai, certaines fonctionnalités pourront être restreintes.
        </p>

        {/* Article 3 */}
        <h2 style={sectionTitle}>3. Règles de conduite</h2>
        <div style={highlight}>
          <p style={{ ...body, margin: 0, fontWeight: 700, color: 'var(--text)' }}>
            Nearly est un espace bienveillant. Le non-respect des règles ci-dessous peut entraîner la suspension ou la suppression définitive de votre compte.
          </p>
        </div>

        <h3 style={subTitle}>3.1 Comportements interdits</h3>
        <p style={body}>Il est strictement interdit de :</p>
        <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
          <li style={li}>Harceler, menacer, intimider ou discriminer un autre utilisateur</li>
          <li style={li}>Publier du contenu offensant, violent, pornographique ou illégal</li>
          <li style={li}>Usurper l'identité d'une autre personne ou créer un faux profil</li>
          <li style={li}>Utiliser l'Application à des fins commerciales, publicitaires ou de spam</li>
          <li style={li}>Organiser des sorties à des fins contraires à la loi (vente de substances illicites, activités illégales)</li>
          <li style={li}>Collecter les données personnelles d'autres utilisateurs</li>
          <li style={li}>Tenter de contourner les mesures de sécurité ou d'accéder à des comptes tiers</li>
          <li style={li}>Utiliser des bots, scripts ou outils automatisés pour interagir avec l'Application</li>
        </ul>

        <h3 style={subTitle}>3.2 Contenu publié</h3>
        <p style={body}>
          Vous êtes responsable de tout contenu que vous publiez sur Nearly (photos de profil, descriptions de sorties, messages, etc.). Vous garantissez que ce contenu ne porte pas atteinte aux droits de tiers et respecte la législation en vigueur.
        </p>

        <h3 style={subTitle}>3.3 Signalement</h3>
        <p style={body}>
          Tout utilisateur peut signaler un comportement ou un contenu inapproprié. Les signalements sont traités par notre équipe de modération sous 24 heures. Les faux signalements répétés peuvent également faire l'objet de sanctions.
        </p>

        {/* Article 4 */}
        <h2 style={sectionTitle}>4. Sorties et participations</h2>
        <h3 style={subTitle}>4.1 Création de sorties</h3>
        <p style={body}>
          La vérification de l'adresse email est requise pour créer une sortie. Le créateur est responsable de la description exacte de l'activité proposée (lieu, horaire, nature). Nearly n'est pas responsable de l'organisation effective des sorties.
        </p>

        <h3 style={subTitle}>4.2 Participation</h3>
        <p style={body}>
          Pour rejoindre une sortie, la vérification d'identité est requise. En rejoignant une sortie, vous vous engagez à vous comporter de manière respectueuse envers les autres participants. Nearly ne garantit pas la présence effective des participants inscrits.
        </p>

        <h3 style={subTitle}>4.3 Responsabilité lors des sorties</h3>
        <div style={highlight}>
          <p style={{ ...body, margin: 0 }}>
            Nearly est un outil de mise en relation. L'Application <strong style={{ color: 'var(--text)' }}>décline toute responsabilité</strong> quant aux événements survenant lors des rencontres physiques entre utilisateurs. Chaque participant est responsable de sa propre sécurité et de son comportement.
          </p>
        </div>

        {/* Article 5 */}
        <h2 style={sectionTitle}>5. Abonnement Premium</h2>
        <h3 style={subTitle}>5.1 Fonctionnalités Premium</h3>
        <p style={body}>
          L'abonnement Premium (4,99 €/mois) donne accès à des fonctionnalités supplémentaires : mise en avant des sorties, badge Premium, historique de chat illimité, ajout d'amis et messages privés.
        </p>

        <h3 style={subTitle}>5.2 Paiement et résiliation</h3>
        <p style={body}>
          Le paiement est géré par Stripe. L'abonnement est sans engagement et résiliable à tout moment depuis les Paramètres de l'Application. La résiliation prend effet à la fin de la période en cours — aucun remboursement au prorata n'est effectué.
        </p>

        <h3 style={subTitle}>5.3 Droit de rétractation</h3>
        <p style={body}>
          Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux contenus numériques fournis immédiatement après l'achat, ce que vous acceptez expressément lors de la souscription.
        </p>

        {/* Article 6 */}
        <h2 style={sectionTitle}>6. Propriété intellectuelle</h2>
        <p style={body}>
          L'Application Nearly, son code source, son design, ses textes, logos et marques sont la propriété exclusive de Nearly SAS. Toute reproduction, modification ou utilisation sans autorisation est interdite.
        </p>
        <p style={body}>
          Les contenus publiés par les utilisateurs (photos, messages, descriptions) restent leur propriété. En les publiant sur Nearly, vous accordez à Nearly SAS une licence non exclusive, gratuite et mondiale pour les afficher dans le cadre du service. Cette licence prend fin à la suppression du contenu ou du compte.
        </p>

        {/* Article 7 */}
        <h2 style={sectionTitle}>7. Limitation de responsabilité</h2>
        <p style={body}>Nearly SAS s'engage à fournir un service de qualité mais ne garantit pas :</p>
        <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
          <li style={li}>La disponibilité ininterrompue de l'Application</li>
          <li style={li}>L'absence totale de bugs ou d'erreurs techniques</li>
          <li style={li}>L'exactitude des informations publiées par les utilisateurs</li>
          <li style={li}>La sécurité des rencontres physiques entre utilisateurs</li>
        </ul>
        <p style={body}>
          La responsabilité de Nearly SAS ne saurait être engagée en cas de force majeure, de dysfonctionnement imputable à un tiers (hébergeur, réseau) ou d'utilisation non conforme de l'Application par un utilisateur.
        </p>

        {/* Article 8 */}
        <h2 style={sectionTitle}>8. Sanctions et suspension</h2>
        <p style={body}>Nearly SAS se réserve le droit, à sa seule discrétion, de :</p>
        <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
          <li style={li}>Suspendre temporairement ou supprimer définitivement un compte en cas de violation des présentes CGU</li>
          <li style={li}>Supprimer tout contenu contraire aux règles de conduite</li>
          <li style={li}>Restreindre l'accès à certaines fonctionnalités en cas de comportement suspect</li>
        </ul>
        <p style={body}>
          L'utilisateur sanctionné sera informé par email des motifs de la décision et disposera de la possibilité de contester celle-ci en contactant <a href="mailto:contact@nearly.app" style={{ color: 'var(--accent)', textDecoration: 'none' }}>contact@nearly.app</a>.
        </p>

        {/* Article 9 */}
        <h2 style={sectionTitle}>9. Modification des CGU</h2>
        <p style={body}>
          Nearly SAS se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés par email et notification in-app au moins <strong style={{ color: 'var(--text)' }}>15 jours avant</strong> l'entrée en vigueur des modifications. L'utilisation continue de l'Application après cette période vaut acceptation des nouvelles conditions.
        </p>

        {/* Article 10 */}
        <h2 style={sectionTitle}>10. Droit applicable et juridiction</h2>
        <p style={body}>
          Les présentes CGU sont régies par le droit français. En cas de litige, les parties s'engagent à rechercher une solution amiable avant toute action judiciaire. À défaut, les tribunaux compétents de Troyes (France) seront exclusivement compétents.
        </p>
        <p style={body}>
          Conformément aux articles L611-1 et suivants du Code de la consommation, vous pouvez recourir gratuitement à un médiateur de la consommation en cas de litige non résolu.
        </p>

        {/* Article 11 */}
        <h2 style={sectionTitle}>11. Contact</h2>
        <div style={highlight}>
          <p style={{ ...body, margin: 0 }}><strong style={{ color: 'var(--text)' }}>Nearly SAS</strong></p>
          <p style={{ ...body, margin: '4px 0 0' }}>Troyes, France</p>
          <p style={{ ...body, margin: '4px 0 0' }}>Email : <a href="mailto:contact@nearly.app" style={{ color: 'var(--accent)', textDecoration: 'none' }}>contact@nearly.app</a></p>
          <p style={{ ...body, margin: '4px 0 0' }}>DPO : <a href="mailto:dpo@nearly.app" style={{ color: 'var(--accent)', textDecoration: 'none' }}>dpo@nearly.app</a></p>
        </div>

        <div style={{ height: 1, background: 'var(--border-color)', margin: '24px 0 16px' }} />
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6 }}>
          Nearly SAS · Troyes, France · Version 1.0 du 14 mars 2026{'\n'}
          Ces CGU sont rédigées en français, langue faisant foi.
        </p>
      </div>
    </div>
  )
}
