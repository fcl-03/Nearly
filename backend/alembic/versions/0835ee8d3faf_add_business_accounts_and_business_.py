"""add business_accounts and business_sponsored_events tables

Revision ID: 0835ee8d3faf
Revises: i0d5e6f7a8b9
Create Date: 2026-03-15 19:47:05.005035

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = '0835ee8d3faf'
down_revision: Union[str, None] = 'i0d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('business_accounts',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('owner_id', sa.UUID(), nullable=False),
    sa.Column('business_name', sa.String(length=150), nullable=False),
    sa.Column('siren', sa.String(length=14), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('logo_url', sa.String(length=500), nullable=True),
    sa.Column('address', sa.String(length=300), nullable=True),
    sa.Column('city', sa.String(length=100), nullable=True),
    sa.Column('phone', sa.String(length=20), nullable=True),
    sa.Column('website', sa.String(length=300), nullable=True),
    sa.Column('plan', sa.String(length=20), nullable=False),
    sa.Column('stripe_customer_id', sa.String(length=100), nullable=True),
    sa.Column('stripe_subscription_id', sa.String(length=100), nullable=True),
    sa.Column('sponsored_events_limit', sa.Integer(), nullable=True),
    sa.Column('sponsored_events_used', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('stripe_customer_id'),
    sa.UniqueConstraint('stripe_subscription_id')
    )
    op.create_table('business_sponsored_events',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('business_id', sa.UUID(), nullable=False),
    sa.Column('event_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['business_id'], ['business_accounts.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('event_id')
    )


def downgrade() -> None:
    op.drop_table('business_sponsored_events')
    op.drop_table('business_accounts')
