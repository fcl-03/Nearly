<div align="center">

# Nearly

**Real people. Real outings. Nearly there.**

Application sociale pour organiser des sorties informelles en petits groupes
dans sa ville, avec des personnes vérifiées.

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL%20+%20PostGIS-15-336791?logo=postgresql&logoColor=white)](https://postgis.net/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

</div>

---

## À propos

Nearly est un projet personnel que je développe en parallèle de ma formation, pour apprendre
à construire une application web complète de bout en bout : du modèle de données aux
WebSockets, en passant par l'authentification sécurisée, la géolocalisation, le stockage
de fichiers et le déploiement.

L'objectif technique pour moi : ne pas me limiter à un exercice scolaire, mais traverser
toutes les couches d'un vrai produit (RGPD, modération, temps réel, PWA, CI/CD…) et
documenter mes choix.

L'idée fonctionnelle : il n'existe pas vraiment d'app pour proposer une sortie informelle
au dernier moment (un ciné, un verre, une balade) et trouver 2 ou 3 personnes pour
t'accompagner. Meetup est trop formel, Tinder/Bumble c'est de la rencontre amoureuse,
Facebook Events c'est de l'événementiel. Nearly se positionne entre les deux : petits
groupes, vérification d'identité, ouvert à partir de 18 ans, pas de logique de dating.

> **Démo vidéo** — *à venir*

---

## Stack technique

| Domaine        | Technos                                                              |
|----------------|----------------------------------------------------------------------|
| **Backend**    | Python 3.11, FastAPI, SQLAlchemy async, Alembic                      |
| **Base**       | PostgreSQL 15 + PostGIS (requêtes géospatiales)                      |
| **Cache / RT** | Redis (sessions, blacklist JWT, pub/sub), WebSockets                 |
| **Auth**       | JWT (access + refresh), bcrypt, blacklist Redis pour bannissement    |
| **Frontend**   | React 18, Vite, Zustand, Tailwind CSS, React Router                  |
| **Carte**      | Leaflet + OpenStreetMap + clustering                                 |
| **i18n**       | react-i18next (fr / en)                                              |
| **PWA**        | Vite PWA plugin (service worker, manifest, offline-ready)            |
| **Email**      | Resend API                                                           |
| **Paiements**  | Stripe (intégré, non activé au MVP)                                  |
| **Stockage**   | Hetzner Object Storage (S3-compatible)                               |
| **Infra**      | Docker Compose, Hetzner CX22, Cloudflare DNS, GitHub Actions CI      |

---

## Architecture

```
nearly/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/  # Routes organisées par domaine
│   │   │   ├── auth.py        # register, login, refresh, verify, reset password
│   │   │   ├── users.py       # profil, avatar, intérêts
│   │   │   ├── events.py      # CRUD sorties, join/leave, filtre géographique
│   │   │   ├── verification.py# upload selfie + pièce d'identité
│   │   │   ├── messages.py    # messages privés
│   │   │   ├── friendships.py # demandes d'amis (premium)
│   │   │   ├── notifications.py
│   │   │   ├── reports.py     # signalements
│   │   │   ├── admin.py       # dashboard admin
│   │   │   ├── business.py    # comptes établissements (B2B)
│   │   │   ├── photos_and_badges.py
│   │   │   ├── ads.py         # publicités sponsorisées
│   │   │   ├── analytics.py
│   │   │   └── payments.py    # Stripe
│   │   ├── core/              # Config, sécurité JWT, Redis, dépendances FastAPI
│   │   ├── models/            # SQLAlchemy models async (16 entités)
│   │   ├── schemas/           # Pydantic (validation request/response)
│   │   ├── services/          # Logique métier (jamais dans les routes)
│   │   └── websockets/        # Chat temps réel
│   ├── alembic/               # 13 migrations versionnées
│   ├── tests/                 # pytest + pytest-asyncio
│   └── main.py
├── frontend/
│   └── src/
│       ├── pages/             # 27 pages (auth, events, profile, admin, business…)
│       ├── components/        # Composants réutilisables (fonctionnels)
│       ├── stores/            # État global Zustand
│       ├── services/          # Couche API (axios + intercepteurs JWT)
│       ├── hooks/             # Custom hooks
│       └── locales/           # Traductions i18n
└── docker-compose.yml         # PostgreSQL + Redis + backend + frontend
```

---

## Fonctionnalités

**Authentification & sécurité**
- Inscription avec vérification email obligatoire (token signé, expiration)
- Login / refresh token / logout (blacklist Redis pour invalidation immédiate)
- Reset password par email
- Bannissement effectif en temps réel : un JWT bani est rejeté à la prochaine requête

**Profil utilisateur**
- Avatar (upload S3, resize via Pillow)
- Bio, intérêts, ville, @username unique
- Page profil publique consultable

**Vérification d'identité**
- Workflow user : upload selfie + pièce d'identité vers un bucket S3 privé
- Workflow admin : revue avec URL signée temporaire, approve / reject
- Suppression définitive des photos après validation (RGPD)

**Sorties (events)**
- CRUD complet avec deux types : petit groupe (3-6) ou ouvert (sans limite)
- Géolocalisation via PostGIS (`Geography(Point)` + `ST_DWithin`)
- Join / leave, gestion des places restantes
- Catégories prédéfinies + champ libre

**Carte interactive**
- Leaflet + OpenStreetMap (pas de Google Maps)
- Clustering des marqueurs
- Filtrage par catégorie, distance, type

**Chat de groupe temps réel**
- WebSocket par sortie, authentification JWT au handshake
- Historique REST, badges "messages non lus" (table `event_read_receipts`)
- Connection manager singleton par sortie

**Messages privés** (1-to-1)
- Inbox triée par dernier message reçu
- Envoi conditionné au statut premium (recevoir reste gratuit)

**Système d'amis** (premium)
- Demandes d'amis, acceptation / refus
- Pages "Mes amis" et "Demandes en attente"

**Modération**
- Signalement d'utilisateurs et de sorties
- Dashboard admin : stats globales, gestion users (ban / unban / promote / demote),
  file de vérifications, file de signalements
- Bannissement = JWT invalidé + email blacklisté

**Comptes business** (B2B)
- Dashboard dédié pour établissements (bars, ciné, restos…)
- Création de sorties sponsorisées avec mise en avant

**Premium (Stripe)**
- Intégration paiements complète (non activée au MVP — gratuit jusqu'à ~500 users)

**Notifications**
- Notifications in-app (centre de notifications)
- Emails transactionnels via Resend

**PWA**
- Installable mobile / desktop, service worker, manifest, icônes

**i18n**
- Toutes les strings UI dans `locales/fr.json` dès le départ
- Anglais en cours de remplissage

---

## Choix techniques notables

**Sécurité & RGPD**
- Photos d'identité dans un bucket S3 privé, accessibles uniquement via URL signée
  temporaire pour l'admin, supprimées définitivement après validation.
- JWT bani rejeté immédiatement via lookup Redis dans `core/dependencies.py`,
  pas à expiration du token.
- Toutes les clés API en variables d'environnement, jamais hardcodées.

**Géolocalisation**
- PostGIS côté DB plutôt que calcul Haversine en application : indexable,
  performant, délégué au moteur de base.

**Temps réel**
- WebSocket FastAPI avec un `ConnectionManager` singleton par sortie.
- Authentification du WS via JWT en query param, vérifiée au handshake.

**Frontend**
- Aucune string UI hardcodée — tout passe par i18next dès le départ pour éviter
  un gros refacto plus tard.
- Couleurs Tailwind en valeurs littérales (`bg-[#E8FF47]`) pour rester fidèle au
  design system sans surcouche de config.

---

## Installation

### Prérequis

- Docker Desktop
- Python 3.11
- Node.js 20+

### Démarrage

```bash
# 1. Cloner le repo
git clone <url-du-repo>
cd nearly

# 2. Préparer les variables d'environnement
cp backend/.env.example backend/.env
cp backend/.env.docker.example backend/.env.docker
cp frontend/.env.example frontend/.env
# → remplir les clés API (Resend, Stripe, S3, Geoapify, TomTom)

# 3. Lancer PostgreSQL + Redis
make up

# 4. Appliquer les migrations
make migrate

# 5. Lancer le backend (terminal dédié)
make backend
# → API sur http://localhost:8000
# → Swagger sur http://localhost:8000/docs

# 6. Lancer le frontend (autre terminal)
make frontend
# → App sur http://localhost:5173
```

### Commandes disponibles

| Commande                            | Description                                    |
|-------------------------------------|------------------------------------------------|
| `make up`                           | Lance PostgreSQL + Redis (Docker)              |
| `make down`                         | Arrête les conteneurs                          |
| `make backend`                      | Backend FastAPI hot reload                     |
| `make frontend`                     | Frontend Vite hot reload                       |
| `make migrate`                      | Applique les migrations Alembic                |
| `make migration m="description"`    | Crée une nouvelle migration                    |
| `make rollback`                     | Annule la dernière migration                   |
| `make shell-db`                     | Shell PostgreSQL interactif                    |
| `make deploy`                       | Stack complète via Docker (preview / prod)     |

### Ports

| Service           | Port |
|-------------------|------|
| Frontend Vite     | 5173 |
| Backend FastAPI   | 8000 |
| PostgreSQL        | 5432 |
| Redis             | 6379 |

---

## Tests

```bash
cd backend && .venv/bin/pytest -v --tb=short
```

Couverture priorisée sur les routes critiques : auth, vérification d'identité,
bannissement, join / leave de sortie.

---

## Design system

Dark theme.

| Rôle              | Couleur     |
|-------------------|-------------|
| Fond              | `#0B0D11`   |
| Surface 1         | `#13151C`   |
| Surface 2         | `#1A1D26`   |
| Accent            | `#E8FF47`   |
| Vert (validé)     | `#3DDB82`   |
| Orange (urgent)   | `#FF7A3D`   |
| Texte principal   | `#F0F2F8`   |
| Texte secondaire  | `#858AA8`   |

- Typo titres : **Syne** (bold 700 / 800)
- Typo corps : **DM Sans** (400 / 500)
- Radius : `18px` (cards), `11px` (boutons / inputs)
- Mobile first à partir de 375px

---

## Ce que ce projet m'a fait apprendre

- Concevoir un schéma de données relationnel avec des contraintes métier fortes
- Utiliser PostGIS pour faire de la géolocalisation côté base, pas côté app
- Authentifier proprement avec JWT + refresh + invalidation Redis
- Implémenter une couche WebSocket avec gestion de connexions et d'authentification
- Gérer le stockage de fichiers sensibles (RGPD : suppression après usage)
- Versionner une base de données avec Alembic sans casser l'existant
- Structurer un front React mobile-first avec i18n dès le jour 1
- Mettre en place un CI GitHub Actions
- Packager le tout en Docker Compose pour un déploiement reproductible

---

## À propos

Projet développé par **Florian** dans le cadre d'une formation développeur web.

Code consultable à des fins de portfolio. Tous droits réservés.
