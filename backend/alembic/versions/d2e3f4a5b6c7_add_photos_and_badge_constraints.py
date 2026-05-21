"""add_photos_and_badge_constraints

Revision ID: d2e3f4a5b6c7
Revises: c1f2e3d4a5b6
Create Date: 2026-03-10 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = 'd2e3f4a5b6c7'
down_revision: Union[str, None] = 'c1f2e3d4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Table photos de profil
    op.create_table(
        'user_photos',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('url', sa.String(length=500), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_photos_user_id', 'user_photos', ['user_id'])

    # Contrainte UNIQUE : un badge par type par paire d'utilisateurs
    op.create_unique_constraint(
        'uq_user_badge_per_pair',
        'user_badges',
        ['giver_id', 'receiver_id', 'badge_id'],
    )

    # Seed des 6 badges prédéfinis (INSERT si la table est vide)
    op.execute("""
        INSERT INTO badges (name, emoji)
        SELECT * FROM (VALUES
            ('Solaire',   '☀️'),
            ('Ponctuel',  '⏰'),
            ('Culture',   '🎭'),
            ('Drôle',     '😂'),
            ('Fiable',    '💪'),
            ('Énergie',   '⚡')
        ) AS v(name, emoji)
        WHERE NOT EXISTS (SELECT 1 FROM badges LIMIT 1)
    """)


def downgrade() -> None:
    op.drop_constraint('uq_user_badge_per_pair', 'user_badges', type_='unique')
    op.drop_index('ix_user_photos_user_id', 'user_photos')
    op.drop_table('user_photos')
