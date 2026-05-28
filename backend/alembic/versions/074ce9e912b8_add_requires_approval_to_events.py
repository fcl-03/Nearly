"""add requires_approval to events

Revision ID: 074ce9e912b8
Revises: 41c09ab5d786
Create Date: 2026-05-25 17:33:42.171805

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '074ce9e912b8'
down_revision: Union[str, None] = '41c09ab5d786'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default=false() pour que les lignes existantes prennent False sans planter.
    op.add_column(
        'events',
        sa.Column('requires_approval', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('events', 'requires_approval')
