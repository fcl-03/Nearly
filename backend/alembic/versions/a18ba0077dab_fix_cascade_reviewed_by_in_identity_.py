"""fix cascade reviewed_by in identity_verifications

Revision ID: a18ba0077dab
Revises: 0835ee8d3faf
Create Date: 2026-05-25 16:03:21.304255

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a18ba0077dab'
down_revision: Union[str, None] = '0835ee8d3faf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Permettre la suppression d'un compte admin sans bloquer sur les vérifs qu'il a reviewées.
    # reviewed_by passe de FK NO ACTION (default) à FK SET NULL.
    op.drop_constraint('identity_verifications_reviewed_by_fkey', 'identity_verifications', type_='foreignkey')
    op.create_foreign_key(
        'identity_verifications_reviewed_by_fkey',
        'identity_verifications', 'users',
        ['reviewed_by'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('identity_verifications_reviewed_by_fkey', 'identity_verifications', type_='foreignkey')
    op.create_foreign_key(
        'identity_verifications_reviewed_by_fkey',
        'identity_verifications', 'users',
        ['reviewed_by'], ['id'],
    )
