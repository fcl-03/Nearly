"""add_stripe_customer_id

Revision ID: a1b2c3d4e5f6
Revises: f7a2b3c4d5e6
Create Date: 2026-03-12 18:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f7a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('stripe_customer_id', sa.String(100), nullable=True))
    op.create_index('ix_users_stripe_customer_id', 'users', ['stripe_customer_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_users_stripe_customer_id', table_name='users')
    op.drop_column('users', 'stripe_customer_id')
