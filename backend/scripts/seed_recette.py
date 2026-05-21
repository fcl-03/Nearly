"""
Script de seed pour le cahier de recette.
Crée les comptes de test + fausses publicités.
Usage : .venv/bin/python scripts/seed_recette.py
"""
import asyncio
import uuid
import bcrypt
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker


async def seed():
    engine = create_async_engine("postgresql+asyncpg://nearly:nearly_dev@localhost:5432/nearly")
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:

        # Seed les badges (nécessaire au lifespan de l'app)
        from app.models.badge import Badge
        existing = await db.execute(select(Badge))
        if not existing.scalars().all():
            from app.services.seed import seed_badges
            c = await seed_badges(db)
            print(f"Badges créés: {c}")

        from app.models.user import User
        from app.models.ad import Ad

        pw = bcrypt.hashpw(b"ChangeMe2026!", bcrypt.gensalt()).decode()

        # ── 1. Compte admin ──
        admin = User(
            id=uuid.uuid4(),
            email="admin@nearly.app",
            password_hash=pw,
            first_name="Admin",
            username="admin_nearly",
            is_admin=True,
            is_email_verified=True,
            is_verified=True,
            city="Troyes",
            latitude=48.2973,
            longitude=4.0744,
        )
        db.add(admin)

        # ── 2. Compte normal (vérifié, actif) ──
        user_normal = User(
            id=uuid.uuid4(),
            email="marie@nearly.app",
            password_hash=pw,
            first_name="Marie",
            username="marie_trs",
            is_email_verified=True,
            is_verified=True,
            bio="Troyenne, fan de sorties entre potes !",
            city="Troyes",
            latitude=48.2973,
            longitude=4.0744,
        )
        db.add(user_normal)

        # ── 3. Compte premium (vérifié) ──
        user_premium = User(
            id=uuid.uuid4(),
            email="lucas@nearly.app",
            password_hash=pw,
            first_name="Lucas",
            username="lucas_premium",
            is_email_verified=True,
            is_verified=True,
            is_premium=True,
            premium_until=datetime.now(timezone.utc) + timedelta(days=365),
            bio="Premium depuis le jour 1",
            city="Troyes",
            latitude=48.2973,
            longitude=4.0744,
        )
        db.add(user_premium)

        # ── 4. Compte entreprise (vérifié) ──
        user_biz = User(
            id=uuid.uuid4(),
            email="resto@nearly.app",
            password_hash=pw,
            first_name="Pierre",
            username="le_petit_troyen",
            is_email_verified=True,
            is_verified=True,
            city="Troyes",
            latitude=48.2973,
            longitude=4.0744,
        )
        db.add(user_biz)

        await db.flush()

        # Créer le compte business pour Pierre
        from app.models.business import BusinessAccount

        biz = BusinessAccount(
            owner_id=user_biz.id,
            business_name="Le Petit Troyen",
            description="Bar a tapas et cocktails au coeur de Troyes",
            address="12 rue Emile Zola, 10000 Troyes",
            city="Troyes",
            phone="03 25 00 00 00",
            plan="starter",
            sponsored_events_limit=3,
        )
        db.add(biz)

        # ── 5. Fausses publicités ──
        ads = [
            Ad(
                title="Le Petit Troyen - Happy Hour",
                description="Cocktails a 5 euros tous les jeudis de 18h a 20h !",
                link_url="https://lepetittroyen.example.com",
                cta_label="Reserver",
                target_city="Troyes",
                is_active=True,
            ),
            Ad(
                title="Escape Game Troyes",
                description="Nouveau scenario disponible ! Reservez votre session entre amis.",
                image_url="https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=400",
                link_url="https://escape-troyes.example.com",
                cta_label="Voir les salles",
                target_city="Troyes",
                is_active=True,
            ),
            Ad(
                title="Fitness Park Troyes",
                description="1 mois offert pour toute inscription ce mois-ci.",
                link_url="https://fitnesspark.example.com",
                cta_label="Inscription",
                target_city=None,  # Nationale
                is_active=True,
            ),
        ]
        for ad in ads:
            db.add(ad)

        await db.commit()

        print("=== Comptes crees ===")
        print(f"Admin    : admin@nearly.app    / ChangeMe2026!")
        print(f"Normal   : marie@nearly.app    / ChangeMe2026!")
        print(f"Premium  : lucas@nearly.app    / ChangeMe2026!")
        print(f"Business : resto@nearly.app    / ChangeMe2026!")
        print(f"3 publicites creees")
        print()
        print("Le 5eme compte (ton test de A a Z) : tu le crees toi-meme via /register")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
