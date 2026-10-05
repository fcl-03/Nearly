# LEGAL.md — Nearly · Conformité juridique & Sécurité

> Source de vérité pour la conformité légale de Nearly.
> Ce fichier dit à Claude Code ce qu'il doit coder, et à Florian ce qu'il doit faire manuellement.
> Dernière mise à jour : Mars 2026

---

## 1. Pourquoi ce fichier existe

Nearly collecte des selfies + pièces d'identité pour vérifier les utilisateurs. C'est la catégorie de données la plus sensible qui existe (RGPD art. 9 — données biométriques). Sans les mesures ci-dessous, l'app est illégale dès le premier utilisateur.

**Emails officiels Nearly :**

- `contact@nearly.app` — email général, mentions légales, support utilisateurs
- `legal@nearly.app` — juridique, RGPD, réquisitions judiciaires, signalements graves

---

## 2. Gestion des données d'identité

### Ce qui est supprimé après vérification

- Le selfie en temps réel (fichier dans le bucket)
- La photo de la pièce d'identité (fichier dans le bucket)
- Suppression immédiate dès validation ou refus par le modérateur
- Maximum 48h de rétention dans tous les cas

### Ce qui est conservé définitivement (obligation légale LCEN)

- Nom complet extrait de la pièce
- Date de naissance
- Type de document (CNI ou passeport)
- Numéro de la pièce d'identité — **stocké chiffré AES-256**
- Date de vérification + ID du modérateur

Ces données permettent de répondre à une réquisition judiciaire en cas d'incident grave (agression, harcèlement, etc.). C'est une obligation légale française (décret 2011-219), pas un choix.

### Texte à inclure dans la politique de confidentialité

> "Les documents d'identité (selfie et pièce d'identité) sont supprimés définitivement après vérification. Les données textuelles extraites (nom, date de naissance, numéro de document) sont conservées conformément aux obligations légales françaises (LCEN, décret 2011-219) et peuvent être communiquées aux autorités judiciaires sur réquisition."

---

## 3. Ce que Claude Code doit implémenter

### 3.1 Suppression automatique des fichiers après vérification

```python
# Dès qu'un modérateur valide ou refuse :
# 1. Supprimer selfie_url du bucket Scaleway
# 2. Supprimer id_card_url du bucket Scaleway
# 3. Mettre selfie_url = NULL et id_card_url = NULL en base
# 4. Enregistrer files_deleted_at = datetime.now()
```

### 3.2 Table identity_verifications — champs requis

```sql
full_name          VARCHAR(200)              -- conservé
birth_date         DATE                      -- conservé
document_type      ENUM('cni', 'passport')   -- conservé
document_number    VARCHAR(50) ENCRYPTED     -- conservé, chiffré AES-256
selfie_url         VARCHAR(500) NULLABLE     -- mis à NULL après vérif
id_card_url        VARCHAR(500) NULLABLE     -- mis à NULL après vérif
files_deleted_at   TIMESTAMP NULLABLE        -- horodatage suppression
verified_by        FK users (admin)          -- ID du modérateur
verified_at        TIMESTAMP
status             ENUM('pending','approved','rejected')
```

### 3.3 Chiffrement du numéro de pièce d'identité

- Chiffrement AES-256 en base
- Jamais en clair dans les logs ou les interfaces admin standard
- Accès déchiffrement : admin uniquement, avec confirmation explicite, accès logué

### 3.4 Bucket Scaleway Object Storage

- Bucket **privé** — aucun accès public
- Bucket **séparé** pour les fichiers de vérification (distinct des photos de profil)
- URLs signées temporaires (presigned URLs) pour accès modérateur — expire après 15 minutes
- Politique de rétention : aucun fichier de vérification ne peut rester plus de 48h

### 3.5 Bannissement définitif

```sql
-- Table banned_users
user_id     FK users
banned_at   TIMESTAMP
reason      TEXT
banned_by   FK users (admin)
```

```python
# À chaque requête : middleware vérifie si user_id est banni → 403
# Bannissement : invalider TOUS les JWT actifs via liste noire Redis
# Email blacklisté : impossible de recréer un compte
```

### 3.6 Système de signalement

```sql
-- Table reports
reporter_id       FK users
reported_user_id  FK users
event_id          FK events NULLABLE
reason            TEXT
created_at        TIMESTAMP
status            ENUM('pending','reviewed','action_taken')
```

- Notification email automatique à `legal@nearly.app` à chaque signalement (via Resend)
- Dashboard admin : liste signalements + profil accusé + historique sorties

### 3.7 Traçabilité des consentements

```sql
-- Table user_consents
user_id         FK users
consent_type    ENUM('cgu','majority','biometric','activity_data','geolocation')
accepted        BOOLEAN
accepted_at     TIMESTAMP
ip_address      VARCHAR(45)   -- pour preuve légale
```

Chaque consentement cliqué = une ligne dans cette table.

### 3.8 Consentements obligatoires dans l'onboarding

| Étape                | Consentement                        | Bloquant ?             |
| -------------------- | ----------------------------------- | ---------------------- |
| Onboarding étape 2   | CGU + Politique de confidentialité  | Oui                    |
| Onboarding étape 2   | Déclaration de majorité (18 ans)    | Oui                    |
| Avant premier selfie | Traitement données biométriques     | Oui                    |
| Onboarding étape 3   | Opt-in données activité anonymisées | Non                    |
| Premier accès carte  | Géolocalisation                     | Non (dégradé si refus) |

### 3.9 Droit à l'effacement — suppression de compte

```python
# Quand un utilisateur supprime son compte :
# 1. Prénom → "Utilisateur supprimé"
# 2. Email → hash irréversible (SHA-256)
# 3. Avatar supprimé du bucket
# 4. Messages → contenu remplacé par "[message supprimé]"
# 5. CONSERVER : données d'identité légales (nom, numéro pièce) pendant 1 an min
# 6. Logger la suppression avec horodatage
```

### 3.10 Page Mentions légales dans l'app

Accessible depuis Profil → Paramètres. Afficher :

- Éditeur : Florian [Nom], IAgenSys
- Adresse complète + SIRET
- Email : contact@nearly.app
- Hébergeur : Scaleway SAS, 8 rue de la Ville l'Evêque, 75008 Paris

### 3.11 Log des accès aux données sensibles

```sql
-- Table data_access_log
admin_id      FK users
action        ENUM('viewed_identity','deleted_files','exported_data','banned_user')
target_id     FK users
reason        TEXT
created_at    TIMESTAMP
```

Chaque accès aux données de vérification d'identité doit être loggé.

---

## 4. Ce que Florian doit faire manuellement (pas du code)

### 🔴 CRITIQUE — avant le premier utilisateur

**AIPD (Analyse d'Impact sur la Protection des Données)**

- Obligatoire légalement (RGPD art. 35) — selfie + pièce d'identité = données biométriques
- Logiciel gratuit CNIL : https://www.cnil.fr/fr/outil-pia
- Durée : 2 à 4 heures, le logiciel guide étape par étape
- Aucune compétence juridique requise

**CGU + Politique de confidentialité**

- Ne pas copier d'un autre site (illégal)
- Option rapide : Iubenda.com (~10€/mois, conforme RGPD + DSA, mis à jour automatiquement)
- Option solide : juriste spécialisé numérique (300-600€, une seule fois)

**Mentions légales**

- 30 minutes maximum
- Informations : nom, IAgenSys, adresse, SIRET, contact@nearly.app, hébergeur Scaleway
- Amende jusqu'à 75 000 € si absent (LCEN)

**Registre des traitements**

- Un tableau (Excel ou Notion suffit)
- Colonnes : traitement / données collectées / base légale / durée conservation / destinataires
- Obligatoire RGPD art. 30

### 🟠 IMPORTANT — dans les 3 premiers mois

**Process de modération documenté (usage interne)**

- Qui vérifie les identités (Florian au lancement)
- Délai de traitement (24h max)
- Critères de validation
- Process refus + contestation
- Process signalement + actions possibles

**Email legal@nearly.app configuré**

- Cloudflare Email Routing (gratuit) redirige vers Gmail
- Ce mail va dans les CGU et la politique de confidentialité

### 🟡 PLUS TARD — au moment du premium et du B2B

**CGV (Conditions Générales de Vente)**

- Pas urgent pour le MVP gratuit
- Nécessaire quand le premium et/ou les comptes B2B sont activés
- Contenu : prix, durée, résiliation, remboursements (14 jours droit de rétractation)

**Relecture juriste**

- Recommandé avant levée de fonds ou 10 000 utilisateurs
- Budget : 500 à 1 500 € une seule fois
- Faire relire : CGU, politique de confidentialité, AIPD

**Rapport de transparence DSA**

- Rapport annuel simple sur les signalements traités
- Un tableau suffit au début

---

## 5. DSA — obligations depuis février 2024

Le Digital Services Act s'applique à Nearly dès le premier utilisateur européen.

**Déjà prévu dans le design :**

- Bouton "Signaler" sur chaque profil et sortie ✓
- Vérification d'âge via pièce d'identité ✓
- Modération avec actions possibles ✓

**À ajouter :**

- Email dédié `legal@nearly.app` comme point de contact autorités
- Information à l'utilisateur si son contenu est supprimé (email automatique + motif)
- Rapport annuel de transparence (signalements reçus / traités / actions)

---

## 6. Checklist résumée

### Claude Code

- [ ] Suppression auto selfie + pièce après vérification
- [ ] Chiffrement AES-256 numéro de pièce
- [ ] Log horodaté chaque suppression fichier
- [ ] Table user_consents avec horodatage + IP
- [ ] Bannissement définitif + invalidation JWT Redis
- [ ] Bucket Scaleway privé + URLs signées 15min
- [ ] Système signalement + notif email admin
- [ ] Page mentions légales dans l'app
- [ ] Droit à l'effacement complet
- [ ] Table data_access_log
- [ ] Consentement géolocalisation + mode dégradé si refus

### Florian

- [ ] AIPD avec logiciel PIA CNIL (gratuit, 2-4h)
- [ ] CGU + politique de confidentialité (Iubenda ~10€/mois)
- [ ] Mentions légales (30 min, 0€)
- [ ] Registre des traitements (tableau, 0€)
- [ ] Email contact@nearly.app + legal@nearly.app (Cloudflare, gratuit)
- [ ] Process modération documenté
- [ ] CGV au moment du premium (pas urgent)
- [ ] Relecture juriste avant levée de fonds

---

_Ce fichier fait partie du projet Nearly avec CONTEXT.md. En cas de doute sur une décision légale, consulter un juriste spécialisé numérique. Ce document est un guide pratique, pas un avis juridique officiel._
