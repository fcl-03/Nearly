# AUDIT COMPLET — Nearly (12/06/2026)

> Audit de l'app entière en phase finale : incohérences, bugs, failles de sécurité.
> Contrainte : **ne pas changer le fonctionnement** — corrections uniquement.
> Sévérité : 🔴 critique (sécu/perte de données) | 🟠 bug réel | 🟡 incohérence/mineur

## Avancement des sections

- [x] 1. Core sécurité — core/ (config, security, JWT, redis), auth, deps — **fixes appliqués** (S1-1, S1-2, S1-4, S1-6, S1-10 ; tests auth 41/41 OK)
- [x] 2. Users — profils, photos, vérification identité — **fixes appliqués** (S2-1, S2-2, S2-4 ; tests 26/26 OK)
- [x] 3. Events — CRUD, join/leave, géo, polls, invitations, souvenirs — **fixes appliqués** (S3-1, S3-2)
- [x] 4. Social — friendships, blocages, DM, messages, websockets chat — **fixes appliqués** (S4-1, S4-2)
- [x] 5. Admin — dashboard, reports, bannissement, notifications, badges
- [x] 6. B2B + données — business, ads, analytics, payments, RGPD — **fix appliqué** (S6-1)
- [x] 7. Frontend — stores, api.js, routing/guards, pages — **fixes appliqués** (S7-1, S7-2)
- [x] 8. Infra — main.py, docker, CI, cohérence alembic/models — **fix appliqué** (S8-1)

## Findings

### Section 1 — Core sécurité (config, security, JWT, redis, deps, auth)

- 🔴 **S1-6 — Mot de passe > 72 octets → 500 à l'inscription ET au login.** bcrypt 5.x lève ValueError au-delà de 72 bytes ; aucun max_length sur les champs password. → FIX : troncature explicite à 72 bytes dans hash_password/verify_password (comportement bcrypt historique, aucun impact utilisateur).
- 🟠 **S1-1 — reset-password / change-password ne révoquent pas les sessions existantes.** Un attaquant connecté au compte le reste (refresh 30 j) même après que la victime a changé son mot de passe. → FIX : index Redis `user_refresh:{user_id}` des jti + révocation à chaque reset/changement.
- 🟠 **S1-10 — Le ban ne révoque rien en Redis.** `is_banned=True` en DB bloque le REST (check par requête dans get_current_user) mais les refresh tokens restent actifs ; la « liste noire Redis » du CLAUDE.md n'est pas branchée sur le ban. → FIX : révoquer les refresh du user au ban (même mécanisme que S1-1). WS traité en section 4.
- 🟠 **S1-4 — logout sans cookie access ne révoque pas le refresh.** `if access_token:` englobe toute la révocation : entre 1 h (expiration cookie access) et 30 j, logout efface les cookies mais laisse le refresh actif en Redis. → FIX : révoquer le refresh indépendamment.
- 🟡 **S1-2 — reset-password et verify-email sans rate limit** (les autres endpoints sensibles en ont un). → FIX : @limiter.limit.
- 🟡 S1-3 — forgot-password : double SELECT du user (le service pourrait le retourner). Cleanup non urgent.
- 🟡 S1-7 — Commentaire faux dans _set_auth_cookies (« 15 min par défaut » vs 30 min réels).
- ✅ Sain : rotation des refresh tokens, blacklist jti au logout, cookies httpOnly+secure+samesite=lax, refresh path-restreint, énumération d'email évitée sur forgot-password, slowapi sur register/login/refresh/forgot.

### Section 2 — Users, photos, vérification identité

- 🟠 **S2-1 — Tags photo non validés** (`services/photos.py upload_photo`) : UUID inexistant → IntegrityError 500 ; on peut taguer n'importe qui (spam de notifs) y compris quelqu'un qui nous a bloqué. → FIX : filtrer sur users existants + ignorer les blocages (silencieux).
- 🟠 **S2-4 — give_badge ignore les blocages** : on peut donner un badge (et générer une notif) à quelqu'un qui nous a bloqué. → FIX : 404 si blocage.
- 🟡 **S2-2 — Blocage incomplet sur les données de profil** : /users/{id} renvoie 404 si blocage, mais /users/{id}/photos, /badges, /achievements restent accessibles par API directe. → FIX : même check 404.
- 🟡 S2-3 — toggle_photo_like : likes_count recalculé en ±1 sur l'état préchargé (léger risque de décalage concurrent, sans gravité).
- ✅ Sain : vérif identité complète (validation MIME/taille, suppression S3 + URLs après revue = RGPD, re-soumission), avatar (Pillow, 5 Mo), username normalisé lowercase + unicité, changement d'email → re-vérification, badges (sortie commune exigée, dédup), intérêts validés.

### Section 3 — Events

- 🔴 **S3-1 — join_event n'exigeait PAS la vérification d'identité.** Règle métier critique (« un user ne peut pas rejoindre avant validation d'identité ») : create la vérifiait, join non — un compte email-vérifié mais identité non vérifiée pouvait rejoindre n'importe quelle sortie par API. → FIX : même check que create (admin exempté).
- 🟠 **S3-2 — max_participants modifiable après publication** via PUT /events/{id} (règle : figé à la création). Aucune UI d'édition n'existe → 422 explicite côté service, rien de cassé. → FIX appliqué.
- 🟡 S3-3 — get_unread_counts : 1 COUNT SQL par sortie rejointe (N+1). OK à l'échelle actuelle, à grouper plus tard.
- 🟡 S3-4 — list_events : le tri « premium d'abord » s'applique après pagination (un premium en page 2 ne remonte pas en page 1). Cosmétique.
- ✅ Sain : lock FOR UPDATE anti-race sur join, capacité revérifiée au COUNT (y compris à l'approbation manuelle), anti-spam création (2 actives / 3 par semaine), blocages filtrés (feed, détail, join), polls de suppression cohérents, invitations restreintes aux amis non participants, validation manuelle pending/rejected solide.

### Complément RGPD — Suppression de compte (trouvé après l'audit initial)

- 🔴 **S2-5 — DELETE /users/me laissait toutes les données S3 orphelines** : avatar, photos de galerie, photos souvenir, et surtout **selfie + pièce d'identité** d'une vérification en attente restaient sur les buckets Hetzner indéfiniment après l'effacement du compte. Non-conformité directe au droit à l'effacement (art. 17). → FIX : suppression S3 publique + privée avant le delete DB.
- 🔴 **S2-6 — L'abonnement Stripe n'était pas résilié à la suppression du compte** : la carte continuait d'être débitée chaque mois alors que le webhook ne retrouvait plus le user. → FIX : cancel des subscriptions actives (best effort).
- 🟡 S2-7 — La suppression ne révoquait que la session courante. → FIX : révocation de toutes les sessions (revoke_user_refresh_tokens).
- ✅ Sain côté effacement : FK toutes en CASCADE/SET NULL (pas de 500, pas d'orphelins DB), messages de chat passés en sender NULL (anonymisés), consentement data_consent opt-in en base, analytics agrégées sans données perso.

### Section 5 — Admin

- ✅ Sain : tout est gated get_current_admin, concept d'« admin originel » (seul à pouvoir promote/demote, indémotable), ban protégé (pas soi-même, pas un admin) + révocation refresh ajoutée (S1-10), review vérifications avec suppression S3 RGPD, bug-reports admin-only.
- 🟡 S5-1 — ban/unban : pas de log d'audit (qui a banni qui, quand, pourquoi — data.reason existe mais n'est pas persistée). À ajouter plus tard pour la traçabilité.

### Section 6 — B2B, paiements, données

- 🟠 **S6-1 — Webhook Stripe : subscription.updated réactivait le premium quel que soit le statut** (past_due, unpaid, canceled → is_premium=True). → FIX : statut vérifié (active/trialing seulement).
- 🟡 S6-2 — GET /ads/{ad_id}/click sans authentification : gonflage de stats de clics possible. Faible enjeu (système interne).
- ✅ Sain : signature webhook Stripe vérifiée, verify-session contrôle l'ownership (metadata user_id) + payment_status, portail client OK, analytics agrégées (pas de données perso), ads admin-gated, business : voir fixes plans (option A, avant l'audit).

### Section 4 — Social (friendships, DM, messages, WebSockets)

- 🟠 **S4-1 — Re-check de ban du chat WS inopérant + absent sur les messages.** `db.get(User, ...)` renvoyait l'objet caché par l'identity map (jamais re-requêté) → un user banni en cours de session WS n'était jamais détecté ; et seul le ping (que le client contrôle) déclenchait le check. → FIX : SELECT direct de is_banned, vérifié au ping ET avant chaque message.
- 🟠 **S4-2 — Un bloqué pouvait continuer à écrire en DM** : l'exception « réponse à une conversation existante » court-circuitait le check d'amitié, donc le blocage. → FIX : is_blocked vérifié en premier dans send_dm.
- 🟡 S4-3 — Un participant qui quitte la sortie (ou est rejeté) pendant qu'il est connecté au chat WS garde la connexion jusqu'à fermeture (participation vérifiée seulement à l'ouverture). Faible impact.
- 🟡 S4-4 — Pas de rate limit sur les messages WS (flood possible) — le REST DM en a un (30/min).
- 🟡 S4-5 — Blocages mutuels impossibles (1 seule ligne Friendship) : si B bloque A qui l'avait bloqué, le blocage de A est silencieusement remplacé. Limite du modèle, comportement résultant acceptable — à connaître.
- 🟡 S4-6 — cleanup_expired_event_chats préserve les chats si un participant est premium — contredit la promesse « purge 7 j » des CGU/RGPD si elle est écrite sans exception. À aligner (code ou CGU).
- ✅ Sain : DM rate-limited + amis only, reports rate-limited + cible validée, historiques DM scoping correct, WS participation vérifiée à l'ouverture, messages chat lim. 500 chars, React échappe le contenu (pas d'XSS).

### Section 7 — Frontend

- 🟠 **S7-1 — Intercepteur 401 : mauvais mot de passe = reload de la page.** Un 401 de /auth/login déclenchait refresh → échec → logout + redirect /login (reload), effaçant le message d'erreur du formulaire. → FIX : endpoints /auth/ exclus du retry + pas de redirect si déjà sur /login.
- 🟠 **S7-2 — Erreurs upload/suppression photo souvenir avalées** (catch vides, ex. HEIC → rien ne se passe). → FIX : alert avec le detail backend.
- 🟡 S7-3 — /admin n'est protégé que par l'API (la page se monte pour tout le monde et affiche des erreurs). Cosmétique : le backend est gated.
- 🟡 S7-4 — CoverMenu « Immortalise ton souvenir » s'ouvre aussi pour les sorties futures (devrait naviguer vers la sortie) ; le backend accepte une cover sur sortie future. Reporté (UX, non-sécurité).
- 🟡 S7-5 — i18n : règle « aucune string hardcodée » non respectée partout (pré-existant, généralisé). Chantier à part.
- ✅ Sain : tokens uniquement en cookies httpOnly (rien en localStorage), AppLayout redirige les non-connectés, zéro console.log, pas de dangerouslySetInnerHTML, géoloc en sessionStorage uniquement (conforme à la règle « pas de tracking continu »).

### Section 8 — Infra

- 🔴 **S8-1 — Postgres (mdp nearly_dev en dur) et Redis exposés sur 0.0.0.0** dans docker-compose.yml : si utilisé tel quel sur le serveur Hetzner sans firewall, la DB est accessible depuis Internet. → FIX : bind 127.0.0.1 + POSTGRES_PASSWORD via variable d'env (fallback dev inchangé). **À vérifier sur le serveur : un firewall Hetzner bloque-t-il déjà 5432/6379 ?**
- 🟠 **S8-2 — CI : `pytest || true` — les tests ne font JAMAIS échouer la CI.** Conséquence directe de BUG 9 (suite events cassée). À retirer dès que BUG 9 est corrigé.
- 🟡 S8-3 — Pas de headers de sécurité HTTP (X-Frame-Options, HSTS, nosniff) côté FastAPI — à vérifier/poser au niveau nginx/Cloudflare en prod.
- 🟡 S8-4 — _cleanup_loop : un try/except global pour 4 étapes — une erreur persistante à l'étape 2 bloque la purge RGPD (étape 3). Cf review du 12/06.
- ✅ Sain : rate limit global 60/min, docs Swagger désactivées hors DEBUG, CORS restreint aux origins configurées, check SECRET_KEY faible au démarrage (refus en prod), migrations alembic propres (head = d7e3a1c5f942).

---

## Bilan

**Corrigés pendant l'audit (12/06/2026)** : S1-1, S1-2, S1-4, S1-6 🔴, S1-10, S2-1, S2-2, S2-4, S3-1 🔴, S3-2, S4-1, S4-2, S6-1, S7-1, S7-2, S8-1 🔴 — soit 3 critiques, 9 importants, 4 mineurs.
**Validation** : suite backend = baseline exacte (97 passed, échecs restants = BUG 9 pré-existant), build frontend OK, ruff OK.

**Restent à faire (par priorité)** :
1. S8-2 — corriger BUG 9 puis retirer `|| true` de la CI (les tests doivent compter)
2. S8-1 (suite) — vérifier le firewall Hetzner + changer le mot de passe Postgres de prod
3. S4-6 — trancher l'exception premium de la purge des chats vs CGU
4. last_active_at visible par les non-amis (présence traçable) — décision produit
5. S7-4 — CoverMenu sorties futures → naviguer vers la sortie
6. S8-3 — headers de sécurité nginx
7. S5-1 — log d'audit des bans
8. Cleanups : sérialiseurs user dupliqués, N+1 unread-counts, S4-4 rate limit WS

---

## Déjà corrigé le 12/06 (avant l'audit)

- ✅ events-history d'autrui : sorties futures masquées (anti-stalking)
- ✅ get_event_souvenir : récap d'autrui refusé si sortie future
- ✅ cover_url : cache-buster ?v= (remplacement photo invisible sinon)
- ✅ Plans business : limites mensuelles dynamiques (migration d7e3a1c5f942)

## Reporté de la review du diff (à fixer pendant l'audit)

- 🟠 ProfilePage.jsx:97,107 — erreurs upload/suppression souvenir avalées (aucun feedback, ex. HEIC)
- 🟡 last_active_at exposé aux non-amis (présence traçable)
- 🟡 CoverMenu s'ouvre sur les sorties futures (devrait mener à la sortie) ; backend accepte une cover sur sortie future
- 🟡 Souvenir : un bloqué voit le bloqueur dans « Qui était là » via le profil d'un tiers
- 🟡 3 sérialiseurs user dupliqués (_user_card / _user_to_public / PublicUserProfile)
