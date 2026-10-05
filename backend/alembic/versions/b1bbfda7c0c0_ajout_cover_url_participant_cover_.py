"""ajout cover_url participant + cover_prompt_sent event

Revision ID: b1bbfda7c0c0
Revises: 074ce9e912b8
Create Date: 2026-06-05 00:06:51.181969

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'b1bbfda7c0c0'
down_revision: Union[str, None] = '074ce9e912b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Photo souvenir personnelle du participant + flag de notif souvenir sur l'event.
    # (On ignore volontairement les autres divergences détectées par l'autogenerate :
    #  index/contraintes parasites non liés à cette feature.)
    op.add_column('event_participants', sa.Column('cover_url', sa.String(length=500), nullable=True))
    op.add_column(
        'events',
        sa.Column('cover_prompt_sent', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('events', 'cover_prompt_sent')
    op.drop_column('event_participants', 'cover_url')
