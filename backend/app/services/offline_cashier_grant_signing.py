from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

_EPHEMERAL_PRIVATE_KEY_PEM: str | None = None
_EPHEMERAL_PUBLIC_KEY_PEM: str | None = None


class OfflineGrantSigningConfigError(ValueError):
    pass


def normalize_pem(value: str | None) -> str | None:
    if not value:
        return None
    return value.replace("\\n", "\n").strip()


def should_allow_ephemeral_dev_key(config: Mapping[str, Any]) -> bool:
    return bool(config.get("TESTING")) or bool(config.get("OFFLINE_GRANT_ALLOW_EPHEMERAL_DEV_KEY"))


def _serialize_public_key(public_key) -> str:
    return public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")


def _load_private_key(private_key_pem: str):
    try:
        return serialization.load_pem_private_key(private_key_pem.encode("utf-8"), password=None)
    except (TypeError, ValueError) as exc:
        raise OfflineGrantSigningConfigError("OFFLINE_GRANT_PRIVATE_KEY is not a valid PEM private key") from exc


def _normalize_public_key_pem(public_key_pem: str) -> str:
    try:
        public_key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
    except (TypeError, ValueError) as exc:
        raise OfflineGrantSigningConfigError("OFFLINE_GRANT_PUBLIC_KEY is not a valid PEM public key") from exc
    return _serialize_public_key(public_key)


def _derive_public_key_from_private(private_key_pem: str) -> str:
    private_key = _load_private_key(private_key_pem)
    return _serialize_public_key(private_key.public_key())


def _generate_ephemeral_keypair() -> tuple[str, str]:
    global _EPHEMERAL_PRIVATE_KEY_PEM, _EPHEMERAL_PUBLIC_KEY_PEM
    if _EPHEMERAL_PRIVATE_KEY_PEM and _EPHEMERAL_PUBLIC_KEY_PEM:
        return _EPHEMERAL_PRIVATE_KEY_PEM, _EPHEMERAL_PUBLIC_KEY_PEM

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_pem = _serialize_public_key(private_key.public_key())

    _EPHEMERAL_PRIVATE_KEY_PEM = private_pem
    _EPHEMERAL_PUBLIC_KEY_PEM = public_pem
    return private_pem, public_pem


def resolve_signing_material(config: Mapping[str, Any]) -> tuple[str, str]:
    configured_private = normalize_pem(config.get("OFFLINE_GRANT_PRIVATE_KEY"))
    configured_public = normalize_pem(config.get("OFFLINE_GRANT_PUBLIC_KEY"))

    if configured_public and not configured_private:
        raise OfflineGrantSigningConfigError(
            "OFFLINE_GRANT_PUBLIC_KEY requires OFFLINE_GRANT_PRIVATE_KEY to be configured as well"
        )

    if configured_private:
        derived_public = _derive_public_key_from_private(configured_private)
        if configured_public:
            normalized_public = _normalize_public_key_pem(configured_public)
            if normalized_public != derived_public:
                raise OfflineGrantSigningConfigError(
                    "OFFLINE_GRANT_PUBLIC_KEY does not match OFFLINE_GRANT_PRIVATE_KEY"
                )
            return configured_private, normalized_public
        return configured_private, derived_public

    if should_allow_ephemeral_dev_key(config):
        return _generate_ephemeral_keypair()

    raise OfflineGrantSigningConfigError(
        "Configured offline grant signing keys are required outside explicit dev/test mode. "
        "Set OFFLINE_GRANT_PRIVATE_KEY (and optionally OFFLINE_GRANT_PUBLIC_KEY) or use "
        "OFFLINE_GRANT_ALLOW_EPHEMERAL_DEV_KEY=1 only for explicit local development."
    )


def validate_offline_grant_signing_config(config: Mapping[str, Any]) -> None:
    resolve_signing_material(config)
