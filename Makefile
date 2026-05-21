# Commandes de développement Nearly
# Usage : make <commande>

.PHONY: help up down logs backend frontend migrate migration shell-db install

help:
	@echo "Commandes disponibles :"
	@echo "  make up          — Lance PostgreSQL + Redis (Docker)"
	@echo "  make down        — Arrête les conteneurs Docker"
	@echo "  make logs        — Affiche les logs Docker"
	@echo "  make backend     — Lance le backend FastAPI (hot reload)"
	@echo "  make frontend    — Lance le frontend Vite (hot reload)"
	@echo "  make migrate     — Applique les migrations Alembic"
	@echo "  make migration m='description'  — Crée une nouvelle migration"
	@echo "  make shell-db    — Ouvre un shell PostgreSQL"
	@echo "  make deploy      — Lance TOUT via Docker (prod/preview)"

# Lance uniquement PostgreSQL et Redis en arrière-plan (dev)
up:
	docker compose up -d db redis
	@echo ""
	@echo "✅ PostgreSQL + Redis démarrés"
	@echo "→ Prochaine étape : make backend (terminal 1) puis make frontend (terminal 2)"

# Arrête les conteneurs
down:
	docker compose down

# Logs en temps réel
logs:
	docker compose logs -f db redis

# Lance le backend FastAPI avec hot reload
backend:
	cd backend && .venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Lance le frontend Vite avec hot reload
frontend:
	cd frontend && npm run dev

# Applique toutes les migrations en attente
migrate:
	cd backend && .venv/bin/alembic upgrade head

# Crée une nouvelle migration (usage : make migration m="ajout table xyz")
migration:
	cd backend && .venv/bin/alembic revision --autogenerate -m "$(m)"

# Rollback de la dernière migration
rollback:
	cd backend && .venv/bin/alembic downgrade -1

# Shell PostgreSQL
shell-db:
	docker compose exec db psql -U nearly -d nearly

# Installe les dépendances Python
install:
	cd backend && pip install -r requirements.txt

# Lance TOUT via Docker — pour la prod ou preview complète
deploy:
	docker compose up -d --build
