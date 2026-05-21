"""add_ads_and_analytics

Revision ID: i0d5e6f7a8b9
Revises: h9c4d5e6f7a8
Create Date: 2026-03-14 22:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = 'i0d5e6f7a8b9'
down_revision: Union[str, None] = 'h9c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Table des publicités natives
    op.create_table(
        'ads',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('title', sa.String(120), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('link_url', sa.String(500), nullable=False),
        sa.Column('cta_label', sa.String(40), nullable=False, server_default='En savoir plus'),
        sa.Column('target_city', sa.String(100), nullable=True),
        sa.Column('impressions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('clicks', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Table des snapshots analytiques
    op.create_table(
        'analytics_snapshots',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('snapshot_date', sa.Date(), nullable=False),
        sa.Column('city', sa.String(100), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('events_created', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_participants', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('avg_group_size', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('peak_hour', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Index pour requêtes fréquentes
    op.create_index('ix_analytics_snapshots_date_city', 'analytics_snapshots', ['snapshot_date', 'city'])
    op.create_index('ix_ads_active', 'ads', ['is_active', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_ads_active')
    op.drop_index('ix_analytics_snapshots_date_city')
    op.drop_table('analytics_snapshots')
    op.drop_table('ads')
