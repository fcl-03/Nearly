"""add_event_deletion_polls

Revision ID: g8b3c4d5e6f7
Revises: f7a2b3c4d5e6
Create Date: 2026-03-13 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = 'g8b3c4d5e6f7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'event_deletion_polls',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('votes_keep', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('votes_delete', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('is_resolved', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_id'),
    )


def downgrade() -> None:
    op.drop_table('event_deletion_polls')
