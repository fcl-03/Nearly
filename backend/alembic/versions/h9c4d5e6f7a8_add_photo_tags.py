"""add_photo_tags

Revision ID: h9c4d5e6f7a8
Revises: g8b3c4d5e6f7
Create Date: 2026-03-13 14:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'h9c4d5e6f7a8'
down_revision: Union[str, None] = 'g8b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'photo_tags',
        sa.Column('photo_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user_photos.id', ondelete='CASCADE'), nullable=False, primary_key=True),
        sa.Column('tagged_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_photo_tags_tagged_user_id', 'photo_tags', ['tagged_user_id'])


def downgrade() -> None:
    op.drop_index('ix_photo_tags_tagged_user_id', 'photo_tags')
    op.drop_table('photo_tags')
