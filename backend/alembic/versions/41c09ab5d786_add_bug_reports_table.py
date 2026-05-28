"""add bug_reports table

Revision ID: 41c09ab5d786
Revises: a18ba0077dab
Create Date: 2026-05-25 17:25:50.207209

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '41c09ab5d786'
down_revision: Union[str, None] = 'a18ba0077dab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'bug_reports',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('reporter_id', sa.UUID(), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('page_url', sa.String(length=500), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['reporter_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_bug_reports_status_created', 'bug_reports', ['status', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_bug_reports_status_created', table_name='bug_reports')
    op.drop_table('bug_reports')
