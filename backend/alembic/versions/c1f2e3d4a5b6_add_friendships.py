"""add_friendships

Revision ID: c1f2e3d4a5b6
Revises: b3d78f5fb921
Create Date: 2026-03-10 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1f2e3d4a5b6'
down_revision: Union[str, None] = 'b3d78f5fb921'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # La table friendships existe déjà — on ajoute seulement updated_at si absent
    op.add_column('friendships',
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True)
    )
    # Initialiser updated_at = created_at pour les lignes existantes
    op.execute("UPDATE friendships SET updated_at = created_at")
    op.alter_column('friendships', 'updated_at', nullable=False)


def downgrade() -> None:
    op.drop_column('friendships', 'updated_at')
