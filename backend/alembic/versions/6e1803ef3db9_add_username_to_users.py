"""add_username_to_users

Revision ID: 6e1803ef3db9
Revises: 814b772dcf63
Create Date: 2026-03-12 12:04:23.400522

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '6e1803ef3db9'
down_revision: Union[str, None] = '814b772dcf63'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('username', sa.String(length=30), nullable=True))
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_column('users', 'username')
