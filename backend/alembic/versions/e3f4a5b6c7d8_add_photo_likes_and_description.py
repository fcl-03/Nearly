"""add_photo_likes_and_description

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-03-10 14:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = 'e3f4a5b6c7d8'
down_revision: Union[str, None] = 'd2e3f4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Description optionnelle sur les photos
    op.add_column('user_photos', sa.Column('description', sa.Text(), nullable=True))

    # Table des likes de photos
    op.create_table(
        'photo_likes',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('photo_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['photo_id'], ['user_photos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'photo_id'),
    )


def downgrade() -> None:
    op.drop_table('photo_likes')
    op.drop_column('user_photos', 'description')
