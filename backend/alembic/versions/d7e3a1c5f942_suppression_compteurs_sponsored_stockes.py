"""suppression compteurs sponsored stockés (limite mensuelle calculée dynamiquement)

Revision ID: d7e3a1c5f942
Revises: b1bbfda7c0c0
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'd7e3a1c5f942'
down_revision: Union[str, None] = 'b1bbfda7c0c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # La limite et l'usage mensuel sont désormais calculés à la volée :
    # PLAN_LIMITS[plan] + COUNT des business_sponsored_events du mois calendaire courant.
    # Plus de compteur stocké à réinitialiser ni de limite figée par compte.
    op.drop_column('business_accounts', 'sponsored_events_limit')
    op.drop_column('business_accounts', 'sponsored_events_used')


def downgrade() -> None:
    op.add_column(
        'business_accounts',
        sa.Column('sponsored_events_limit', sa.Integer(), nullable=True),
    )
    op.add_column(
        'business_accounts',
        sa.Column('sponsored_events_used', sa.Integer(), nullable=False, server_default='0'),
    )
