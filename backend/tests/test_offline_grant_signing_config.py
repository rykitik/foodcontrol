from __future__ import annotations

import pytest

from app import create_app
from app.services.offline_cashier_grant_signing import OfflineGrantSigningConfigError


def test_create_app_requires_signing_keys_outside_dev_and_test():
    with pytest.raises(OfflineGrantSigningConfigError, match="Configured offline grant signing keys are required"):
        create_app(
            config_overrides={
                "TESTING": False,
                "SQLALCHEMY_DATABASE_URI": "sqlite://",
                "OFFLINE_GRANT_ALLOW_EPHEMERAL_DEV_KEY": False,
                "OFFLINE_GRANT_PRIVATE_KEY": None,
                "OFFLINE_GRANT_PUBLIC_KEY": None,
            }
        )


def test_create_app_allows_explicit_dev_ephemeral_signing_key():
    application = create_app(
        config_overrides={
            "TESTING": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "OFFLINE_GRANT_ALLOW_EPHEMERAL_DEV_KEY": True,
            "OFFLINE_GRANT_PRIVATE_KEY": None,
            "OFFLINE_GRANT_PUBLIC_KEY": None,
        }
    )

    assert application is not None


def test_create_app_rejects_public_key_without_private_key():
    with pytest.raises(OfflineGrantSigningConfigError, match="OFFLINE_GRANT_PUBLIC_KEY requires OFFLINE_GRANT_PRIVATE_KEY"):
        create_app(
            config_overrides={
                "TESTING": False,
                "SQLALCHEMY_DATABASE_URI": "sqlite://",
                "OFFLINE_GRANT_ALLOW_EPHEMERAL_DEV_KEY": False,
                "OFFLINE_GRANT_PRIVATE_KEY": None,
                "OFFLINE_GRANT_PUBLIC_KEY": "-----BEGIN PUBLIC KEY-----\ninvalid\n-----END PUBLIC KEY-----",
            }
        )
