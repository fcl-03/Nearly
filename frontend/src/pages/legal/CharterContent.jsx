// Contenu complet de la charte — partagé entre CharterPage et l'inscription (Step2Charter)
export default function CharterContent() {
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

  const divider = {
    height: 1,
    background: 'var(--border-color)',
    margin: '8px 0',
  }

  return (
    <>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.2 }}>
        Politique de confidentialité &amp; Conditions Générales d'Utilisation
      </h2>
      <p style={{ ...body, color: 'var(--text-tertiary)', fontSize: 13 }}>
        Dernière mise à jour : 12 mars 2026 · Version 1.0
      </p>

      <div style={divider} />

      <p style={body}>
        La présente politique de confidentialité et conditions générales d'utilisation (ci-après « la Charte ») régit l'utilisation de l'application Nearly (ci-après « l'Application »), éditée par Nearly SAS, et s'applique à tout utilisateur résidant dans l'Espace économique européen ou accédant à l'Application depuis celui-ci.
      </p>
      <p style={body}>
        Nearly est une application sociale destinée à faciliter des sorties informelles en petits groupes pour des personnes de 25 à 35 ans dans les villes françaises. Nous accordons une importance capitale à la protection de vos données personnelles et nous engageons à traiter celles-ci dans le strict respect du Règlement Général sur la Protection des Données (RGPD — Règlement (UE) 2016/679), de la loi Informatique et Libertés modifiée et de l'ensemble des textes applicables.
      </p>
      <p style={body}>
        En vous inscrivant sur Nearly, vous reconnaissez avoir lu, compris et accepté la présente Charte dans son intégralité. Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser l'Application.
      </p>

      <h2 style={sectionTitle}>1. Responsable du traitement</h2>
      <p style={body}>Le responsable du traitement de vos données personnelles est :</p>
      <div style={highlight}>
        <p style={{ ...body, margin: 0, fontWeight: 600, color: 'var(--text)' }}>Nearly SAS</p>
        <p style={{ ...body, margin: '4px 0 0' }}>Troyes, France</p>
        <p style={{ ...body, margin: '4px 0 0' }}>Délégué à la Protection des Données (DPO) :{' '}<a href="mailto:dpo@nearly.app" style={{ color: 'var(--accent)', textDecoration: 'none' }}>dpo@nearly.app</a></p>
        <p style={{ ...body, margin: '4px 0 0' }}>Contact général :{' '}<a href="mailto:contact@nearly.app" style={{ color: 'var(--accent)', textDecoration: 'none' }}>contact@nearly.app</a></p>
      </div>

      <h2 style={sectionTitle}>2. Données collectées</h2>
      <p style={body}>Dans le cadre du fonctionnement de Nearly, nous collectons les catégories de données suivantes :</p>

      <h3 style={subTitle}>2.1 Données d'identité et de contact</h3>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}>Prénom</li>
        <li style={li}>Adresse e-mail (pseudonymisée en interne)</li>
        <li style={li}>Nom d'utilisateur (@username)</li>
        <li style={li}>Photo de profil (avatar) — optionnelle</li>
        <li style={li}>Biographie courte — optionnelle</li>
      </ul>

      <h3 style={subTitle}>2.2 Données de localisation</h3>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}>Ville déclarée (texte libre, non obligatoire)</li>
        <li style={li}>Coordonnées GPS (latitude/longitude) collectées uniquement lors de la création ou de la recherche de sorties, avec votre autorisation explicite via les permissions système</li>
        <li style={li}>Aucune localisation en arrière-plan</li>
      </ul>

      <h3 style={subTitle}>2.3 Données d'activité</h3>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}>Sorties créées, rejointes ou quittées</li>
        <li style={li}>Catégories d'activités choisies (sport, culture, gastronomie, etc.)</li>
        <li style={li}>Intérêts sélectionnés dans le profil</li>
        <li style={li}>Messages échangés dans les chats de groupe liés aux sorties</li>
        <li style={li}>Photos partagées dans le profil</li>
        <li style={li}>Relations d'amitié établies dans l'application</li>
        <li style={li}>Badges et statistiques de participation</li>
      </ul>

      <h3 style={subTitle}>2.4 Données de vérification d'identité</h3>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}>Selfie (photo en temps réel) collecté uniquement lors de la procédure de vérification volontaire</li>
        <li style={li}>Pièce d'identité officielle (carte nationale d'identité ou passeport)</li>
        <li style={li}>Ces données sont stockées dans un compartiment sécurisé à accès restreint et sont supprimées après traitement par un modérateur humain</li>
      </ul>

      <h3 style={subTitle}>2.5 Données techniques</h3>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}>Adresse IP (anonymisée après 30 jours)</li>
        <li style={li}>Type de navigateur et système d'exploitation</li>
        <li style={li}>Journaux de connexion (timestamps, actions principales)</li>
        <li style={li}>Tokens d'authentification JWT (stockés côté client, durée limitée)</li>
        <li style={li}>Données de session Redis (invalidées à la déconnexion)</li>
      </ul>

      <h3 style={subTitle}>2.6 Données non collectées</h3>
      <p style={body}>
        Nearly ne collecte <strong style={{ color: 'var(--text)' }}>jamais</strong> : numéro de téléphone, données bancaires directes (gestion déléguée à Stripe), numéro de sécurité sociale, données de santé, ni aucune donnée sensible au sens de l'article 9 du RGPD (origines raciales ou ethniques, opinions politiques, convictions religieuses, orientation sexuelle).
      </p>

      <h2 style={sectionTitle}>3. Finalités du traitement</h2>
      <p style={body}>Vos données sont traitées pour les finalités suivantes :</p>

      <h3 style={subTitle}>3.1 Fourniture du service</h3>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}>Création et gestion de votre compte utilisateur</li>
        <li style={li}>Authentification et sécurité des accès (JWT + blacklist Redis)</li>
        <li style={li}>Affichage et recherche de sorties géolocalisées</li>
        <li style={li}>Gestion des participations aux événements</li>
        <li style={li}>Communication en temps réel via les chats de groupe (WebSocket)</li>
        <li style={li}>Système de notifications</li>
        <li style={li}>Gestion des relations d'amitié</li>
      </ul>

      <h3 style={subTitle}>3.2 Vérification et sécurité</h3>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}>Vérification volontaire de l'identité (badge « Vérifié »)</li>
        <li style={li}>Prévention des comportements abusifs et des faux profils</li>
        <li style={li}>Traitement des signalements d'utilisateurs</li>
        <li style={li}>Modération du contenu</li>
      </ul>

      <h3 style={subTitle}>3.3 Amélioration du service</h3>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}>Analyse agrégée des usages pour améliorer les fonctionnalités</li>
        <li style={li}>Détection et correction des anomalies techniques (via Sentry, données anonymisées)</li>
        <li style={li}>Tests A/B et amélioration de l'expérience utilisateur</li>
      </ul>

      <h3 style={subTitle}>3.4 Obligations légales</h3>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}>Conservation des journaux de connexion (obligation légale 12 mois)</li>
        <li style={li}>Réponse aux réquisitions judiciaires</li>
        <li style={li}>Lutte contre la fraude</li>
      </ul>

      <h2 style={sectionTitle}>4. Base légale du traitement</h2>
      <p style={body}>Conformément à l'article 6 du RGPD, chaque traitement repose sur une base légale identifiée :</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {[
          { title: 'Exécution du contrat (art. 6.1.b)', desc: "Création de compte, authentification, participation aux sorties, messagerie — traitements indispensables à la fourniture du service que vous avez demandé." },
          { title: 'Consentement (art. 6.1.a)', desc: "Partage de vos données d'activité anonymisées à des fins analytiques et commerciales (voir section 6). Ce consentement est librement donné, spécifique, éclairé et univoque. Vous pouvez le retirer à tout moment dans Paramètres → Confidentialité, sans que cela n'affecte la licéité des traitements antérieurs." },
          { title: 'Intérêt légitime (art. 6.1.f)', desc: "Sécurisation de la plateforme, prévention des fraudes, amélioration du service, détection des comportements abusifs — à condition que ces intérêts ne prévalent pas sur vos droits et libertés fondamentaux." },
          { title: 'Obligation légale (art. 6.1.c)', desc: "Conservation des journaux de connexion, réponse aux autorités compétentes." },
        ].map(({ title, desc }) => (
          <div key={title} style={{ background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 11, padding: '14px 16px' }}>
            <p style={{ ...body, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>{title}</p>
            <p style={{ ...body, margin: 0 }}>{desc}</p>
          </div>
        ))}
      </div>

      <h2 style={sectionTitle}>5. Partage de données personnelles</h2>
      <h3 style={subTitle}>5.1 Sous-traitants techniques</h3>
      <p style={body}>Nearly fait appel à des sous-traitants techniques pour opérer le service. Ces prestataires n'agissent que sur instruction de Nearly et sont soumis à des clauses contractuelles strictes :</p>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}><strong style={{ color: 'var(--text)' }}>Hetzner Online GmbH</strong> (Allemagne) — hébergement des serveurs et stockage objet S3 (Allemagne, Union Européenne)</li>
        <li style={li}><strong style={{ color: 'var(--text)' }}>Cloudflare Inc.</strong> (États-Unis) — réseau de distribution de contenu (CDN) et protection DDoS, couvert par les Clauses Contractuelles Types (CCT)</li>
        <li style={li}><strong style={{ color: 'var(--text)' }}>Resend Inc.</strong> (États-Unis) — service d'envoi d'e-mails transactionnels, couvert par les CCT</li>
        <li style={li}><strong style={{ color: 'var(--text)' }}>Stripe Inc.</strong> (États-Unis) — traitement des paiements ; Stripe est responsable de traitement indépendant pour les données de paiement</li>
        <li style={li}><strong style={{ color: 'var(--text)' }}>Sentry.io</strong> (États-Unis) — monitoring des erreurs techniques (données anonymisées/pseudonymisées)</li>
      </ul>
      <h3 style={subTitle}>5.2 Autorités compétentes</h3>
      <p style={body}>Nearly peut être amené à communiquer vos données à des autorités judiciaires, administratives ou de sécurité publique françaises ou européennes en vertu d'une obligation légale ou d'une décision judiciaire. Une telle communication ne sera jamais effectuée au-delà du strict nécessaire.</p>
      <h3 style={subTitle}>5.3 Vente de données personnelles — INTERDITE</h3>
      <div style={highlight}>
        <p style={{ ...body, margin: 0, fontWeight: 700, color: 'var(--text)' }}>Nearly ne vend jamais, en aucun cas, vos données personnelles à des tiers. Aucun tiers commercial ne reçoit de données vous identifiant directement ou indirectement.</p>
      </div>

      <h2 style={sectionTitle}>6. Données agrégées et anonymisées — Modèle de monétisation</h2>
      <div style={{ ...highlight }}>
        <p style={{ ...body, fontWeight: 700, color: 'var(--accent)', margin: '0 0 8px', fontSize: 15 }}>Section importante — lisez attentivement</p>
        <p style={{ ...body, margin: 0 }}>Cette section décrit la manière dont Nearly génère des revenus sans compromettre votre vie privée.</p>
      </div>
      <h3 style={subTitle}>6.1 Principe de l'anonymisation</h3>
      <p style={body}>Avec votre consentement, Nearly peut analyser vos données d'activité dans le but de produire des <strong style={{ color: 'var(--text)' }}>statistiques agrégées et anonymisées</strong>. Ces statistiques satisfont aux critères du RGPD relatifs à l'anonymisation : elles ne permettent pas, même par recoupement, de ré-identifier un individu.</p>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}>Agrégation des données sur un minimum de 50 utilisateurs par segment (k-anonymat ≥ 50)</li>
        <li style={li}>Suppression de tout identifiant direct et indirect avant agrégation</li>
        <li style={li}>Application de techniques de bruit différentiel pour les petits groupes</li>
        <li style={li}>Audit interne trimestriel du risque de ré-identification</li>
      </ul>
      <h3 style={subTitle}>6.2 Nature des données partagées avec des partenaires</h3>
      <p style={body}>Les données partagées avec des partenaires commerciaux tiers sont <strong style={{ color: 'var(--text)' }}>exclusivement agrégées et anonymisées</strong>. Elles peuvent inclure :</p>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}>Tendances d'activités populaires par ville ou quartier</li>
        <li style={li}>Tranches d'âge démographiques sans identifiant</li>
        <li style={li}>Fréquences de participation à des types d'activités par région</li>
        <li style={li}>Créneaux horaires et jours d'activité préférés, par zone géographique</li>
        <li style={li}>Saisonnalité des types d'événements</li>
      </ul>
      <h3 style={subTitle}>6.3 Ce qui n'est jamais partagé</h3>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}>Votre nom, prénom, @username ou adresse e-mail</li>
        <li style={li}>Votre avatar ou toute photo vous représentant</li>
        <li style={li}>Votre localisation précise (les données sont agrégées au niveau de la ville)</li>
        <li style={li}>Le contenu de vos messages privés ou chats de groupe</li>
        <li style={li}>Vos relations d'amitié ou votre liste de contacts</li>
        <li style={li}>Tout profil individuel ou pseudonyme traçable</li>
      </ul>
      <h3 style={subTitle}>6.4 Contrôle par l'utilisateur</h3>
      <p style={body}>Le partage de vos données d'activité à des fins analytiques est <strong style={{ color: 'var(--text)' }}>entièrement optionnel</strong>. Vous pouvez activer ou désactiver ce partage à tout moment via Paramètres → Confidentialité, sans subir aucune dégradation des fonctionnalités.</p>

      <h2 style={sectionTitle}>7. Transferts internationaux de données</h2>
      <p style={body}>Certains sous-traitants (Cloudflare, Resend, Stripe, Sentry) sont établis aux États-Unis. Ces transferts hors EEE sont encadrés par les <strong style={{ color: 'var(--text)' }}>Clauses Contractuelles Types (CCT)</strong> adoptées par la Commission européenne, conformément à l'article 46 du RGPD.</p>
      <p style={body}>L'hébergement principal des données est réalisé en <strong style={{ color: 'var(--text)' }}>Allemagne (Hetzner, Nuremberg/Falkenstein)</strong>, au sein de l'Union Européenne.</p>
      <p style={body}>Nearly s'engage à vous informer de tout changement de sous-traitant impliquant un transfert hors EEE dans un délai de 30 jours avant sa mise en œuvre.</p>

      <h2 style={sectionTitle}>8. Durée de conservation des données</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Données de compte (profil, email, prénom)', duree: '3 ans après la dernière connexion, puis suppression automatique' },
          { label: 'Données de localisation GPS précise', duree: '90 jours maximum, puis anonymisation' },
          { label: 'Messages de chat de groupe', duree: "1 an après la date de l'événement, puis suppression" },
          { label: 'Photos de profil', duree: "Jusqu'à suppression par l'utilisateur ou fermeture du compte" },
          { label: "Documents de vérification d'identité (pièce + selfie)", duree: 'Suppression dans les 72h suivant la décision de vérification' },
          { label: 'Journaux de connexion (IP, timestamps)', duree: '12 mois (obligation légale), puis suppression définitive' },
          { label: 'Données de paiement', duree: 'Gérées par Stripe ; 5 ans (obligations comptables)' },
          { label: 'Données agrégées et anonymisées', duree: 'Conservation indéfinie (non soumises au RGPD car anonymisées)' },
        ].map(({ label, duree }) => (
          <div key={label} style={{ background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 11, padding: '12px 14px' }}>
            <p style={{ ...body, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px', fontSize: 13 }}>{label}</p>
            <p style={{ ...body, margin: 0, fontSize: 13 }}>{duree}</p>
          </div>
        ))}
      </div>
      <p style={body}>En cas de fermeture volontaire du compte, toutes vos données personnelles identifiables sont supprimées dans un délai de <strong style={{ color: 'var(--text)' }}>30 jours ouvrés</strong>, à l'exception des données soumises à une obligation légale de conservation.</p>

      <h2 style={sectionTitle}>9. Vos droits</h2>
      <p style={body}>En tant que personne concernée résidant dans l'EEE, vous bénéficiez des droits suivants au titre du RGPD (articles 15 à 22) :</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {[
          { title: "Droit d'accès (art. 15)", desc: "Vous pouvez demander une copie de toutes les données personnelles que nous détenons sur vous, ainsi que des informations sur les traitements associés." },
          { title: 'Droit de rectification (art. 16)', desc: "Vous pouvez corriger ou compléter vos données inexactes ou incomplètes directement depuis votre profil ou en nous contactant." },
          { title: "Droit à l'effacement / « droit à l'oubli » (art. 17)", desc: "Vous pouvez demander la suppression de votre compte et de vos données personnelles via Paramètres → Compte → Supprimer mon compte. Cette action est irréversible." },
          { title: 'Droit à la portabilité (art. 20)', desc: "Vous pouvez demander l'export de vos données personnelles dans un format structuré et lisible (JSON) en contactant notre DPO. Délai de réponse : 30 jours." },
          { title: "Droit d'opposition (art. 21)", desc: "Vous pouvez vous opposer à tout traitement fondé sur l'intérêt légitime ou à des fins de marketing direct. Pour le partage de données anonymisées, utilisez le paramètre dédié." },
          { title: 'Droit à la limitation du traitement (art. 18)', desc: "Dans certaines circonstances (contestation de l'exactitude, opposition en cours), vous pouvez demander la suspension du traitement de vos données." },
          { title: 'Droit de retrait du consentement', desc: "Lorsque le traitement est fondé sur votre consentement, vous pouvez le retirer à tout moment sans conséquence sur votre accès à l'application." },
        ].map(({ title, desc }) => (
          <div key={title} style={{ background: 'var(--surface2)', border: '1px solid var(--border-color)', borderRadius: 11, padding: '14px 16px' }}>
            <p style={{ ...body, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>{title}</p>
            <p style={{ ...body, margin: 0 }}>{desc}</p>
          </div>
        ))}
      </div>
      <p style={body}>Pour exercer vos droits, contactez notre DPO à l'adresse{' '}<a href="mailto:dpo@nearly.app" style={{ color: 'var(--accent)', textDecoration: 'none' }}>dpo@nearly.app</a>{' '}en précisant votre identité et la nature de votre demande. Nous accuserons réception sous 72 heures et traiterons votre demande dans un délai d'un mois.</p>

      <h2 style={sectionTitle}>10. Sécurité des données</h2>
      <p style={body}>Nearly met en œuvre les mesures techniques et organisationnelles appropriées pour protéger vos données :</p>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}>Chiffrement des mots de passe avec bcrypt (facteur de coût élevé)</li>
        <li style={li}>Authentification par JWT avec expiration courte (access token : 15 min)</li>
        <li style={li}>Blacklist des tokens invalidés via Redis</li>
        <li style={li}>Communications chiffrées en TLS 1.3 (HTTPS obligatoire)</li>
        <li style={li}>Stockage des fichiers sensibles (pièces d'identité) dans un bucket S3 privé à accès signé temporaire</li>
        <li style={li}>Cloisonnement des accès : principe du moindre privilège</li>
        <li style={li}>Journalisation des actions sensibles (connexions, modifications de compte, suppressions)</li>
        <li style={li}>Monitoring des erreurs et anomalies via Sentry (données pseudonymisées)</li>
        <li style={li}>Mises à jour de sécurité appliquées dans un délai maximum de 72 heures après publication</li>
        <li style={li}>Hébergement en Allemagne (Hetzner), soumis au droit européen de la protection des données</li>
      </ul>
      <p style={body}>En cas de violation de données susceptible d'engendrer un risque pour vos droits et libertés, Nearly notifiera la CNIL dans un délai de 72 heures et vous informera personnellement si le risque est élevé.</p>

      <h2 style={sectionTitle}>11. Cookies et stockage local</h2>
      <p style={body}>Nearly est une Progressive Web App (PWA). Nous n'utilisons pas de cookies tiers à des fins publicitaires.</p>
      <h3 style={subTitle}>11.1 LocalStorage (navigateur)</h3>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}><strong style={{ color: 'var(--text)' }}>nearly-auth</strong> : tokens JWT (access + refresh) — indispensable au fonctionnement, base légale : exécution du contrat</li>
        <li style={li}><strong style={{ color: 'var(--text)' }}>charter_seen</strong> : booléen indiquant si vous avez vu la charte — base légale : intérêt légitime</li>
      </ul>
      <h3 style={subTitle}>11.2 Cookies techniques (session)</h3>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
        <li style={li}>Cookies Cloudflare (protection anti-bot, sécurité) — nécessaires, pas de consentement requis</li>
        <li style={li}>Aucun cookie analytics tiers (Google Analytics, Facebook Pixel, etc.)</li>
        <li style={li}>Aucun cookie publicitaire</li>
      </ul>
      <h3 style={subTitle}>11.3 Service Worker (PWA)</h3>
      <p style={body}>Un service worker peut être installé pour les fonctionnalités hors-ligne de base. Il ne collecte aucune donnée personnelle et peut être supprimé en désinstallant l'application.</p>

      <h2 style={sectionTitle}>12. Protection des mineurs</h2>
      <p style={body}>L'Application Nearly est destinée aux personnes majeures (18 ans et plus). Nous ne collectons sciemment aucune donnée concernant des mineurs de moins de 18 ans. Si vous avez connaissance qu'un mineur a créé un compte, contactez-nous immédiatement à{' '}<a href="mailto:contact@nearly.app" style={{ color: 'var(--accent)', textDecoration: 'none' }}>contact@nearly.app</a>{' '}afin que nous procédions à la suppression du compte.</p>

      <h2 style={sectionTitle}>13. Modifications de la présente Charte</h2>
      <p style={body}>Nearly se réserve le droit de modifier la présente Charte à tout moment. En cas de modification substantielle, nous vous informerons par e-mail et via une notification in-app au moins <strong style={{ color: 'var(--text)' }}>15 jours avant</strong> l'entrée en vigueur des modifications. Votre usage continu de l'Application après cette période vaudra acceptation des nouvelles conditions.</p>

      <h2 style={sectionTitle}>14. Contact et recours CNIL</h2>
      <h3 style={subTitle}>14.1 Délégué à la Protection des Données (DPO)</h3>
      <div style={highlight}>
        <p style={{ ...body, margin: 0 }}><strong style={{ color: 'var(--text)' }}>E-mail :</strong>{' '}<a href="mailto:dpo@nearly.app" style={{ color: 'var(--accent)', textDecoration: 'none' }}>dpo@nearly.app</a></p>
        <p style={{ ...body, margin: '6px 0 0' }}><strong style={{ color: 'var(--text)' }}>Délai de réponse :</strong> 72h pour accusé de réception, 30 jours pour réponse complète</p>
        <p style={{ ...body, margin: '6px 0 0' }}><strong style={{ color: 'var(--text)' }}>Contact général :</strong>{' '}<a href="mailto:contact@nearly.app" style={{ color: 'var(--accent)', textDecoration: 'none' }}>contact@nearly.app</a></p>
      </div>
      <h3 style={subTitle}>14.2 Recours auprès de la CNIL</h3>
      <p style={body}>Si vous estimez que vos droits ne sont pas respectés après nous avoir contactés, vous disposez du droit d'introduire une réclamation auprès de l'autorité de contrôle compétente :</p>
      <div style={{ ...highlight, border: '1px solid var(--border-color)' }}>
        <p style={{ ...body, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>CNIL — Commission Nationale de l'Informatique et des Libertés</p>
        <p style={{ ...body, margin: '0 0 4px' }}>3 Place de Fontenoy, TSA 80715 — 75334 Paris Cedex 07</p>
        <p style={{ ...body, margin: '0 0 4px' }}>Tél. : +33 1 53 73 22 22</p>
        <p style={{ ...body, margin: 0 }}>Site :{' '}<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>www.cnil.fr</a></p>
      </div>

      <div style={{ height: 1, background: 'var(--border-color)', margin: '24px 0 16px' }} />
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6 }}>
        Nearly SAS · Troyes, France · Version 1.0 du 12 mars 2026{'\n'}Cette charte est rédigée en français, langue faisant foi.
      </p>
    </>
  )
}
