"""TOTP 2FA utilities — secrets, QR codes, backup codes, encryption.

Design decisions:
- Secret is encrypted at rest with Fernet (AES-128-CBC + HMAC).
- Backup codes are stored as SHA-256 hashes only; plaintext shown once to user.
- QR is returned as `data:image/png;base64,...` for direct <Image> rendering.
- Anti-replay: successful timecode is stored, must strictly increase.
- MoreFit is the TOTP issuer name shown in Google Authenticator / Authy.
"""
from __future__ import annotations

import base64
import io
import os
import secrets
from hashlib import sha256
from typing import List, Optional, Tuple

import pyotp
import qrcode
from cryptography.fernet import Fernet, InvalidToken

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
ISSUER = "MoreFit"
TOTP_PERIOD = 30
TOTP_DIGITS = 6
BACKUP_CODE_COUNT = 10
# Roles that MUST have 2FA enabled to access sensitive data.
MANDATORY_2FA_ROLES = {"nutritionist", "personal", "doctor", "admin", "superadmin"}

# ---------------------------------------------------------------------------
# Fernet key (lazy-load so tests can monkeypatch env)
# ---------------------------------------------------------------------------
_FERNET: Optional[Fernet] = None


def _fernet() -> Fernet:
    global _FERNET
    if _FERNET is not None:
        return _FERNET
    key = os.environ.get("TOTP_ENCRYPTION_KEY")
    if not key:
        # Dev fallback — a stable key for local development only.
        # Production MUST set TOTP_ENCRYPTION_KEY explicitly (see .env).
        key = "if2bvgOv_Mn_XDdj4dUiYlZAKrvmondlMMGmcJ3VihQ="
    _FERNET = Fernet(key.encode() if isinstance(key, str) else key)
    return _FERNET


# ---------------------------------------------------------------------------
# Secret handling
# ---------------------------------------------------------------------------
def new_secret() -> str:
    """Return a fresh base32 secret (160 bits of effective entropy)."""
    return pyotp.random_base32()


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_secret(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as e:
        raise ValueError("TOTP secret cannot be decrypted (key rotated?)") from e


# ---------------------------------------------------------------------------
# QR code (Google Authenticator / Authy compatible)
# ---------------------------------------------------------------------------
def provisioning_uri(email: str, secret: str) -> str:
    return pyotp.TOTP(secret, interval=TOTP_PERIOD, digits=TOTP_DIGITS).provisioning_uri(
        name=email, issuer_name=ISSUER
    )


def qr_data_url(email: str, secret: str) -> str:
    """Return a data URL PNG the client can render as an <Image>."""
    uri = provisioning_uri(email, secret)
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# ---------------------------------------------------------------------------
# Backup codes
# ---------------------------------------------------------------------------
def _normalize(code: str) -> str:
    return code.replace("-", "").replace(" ", "").strip().upper()


def code_hash(code: str) -> str:
    return sha256(_normalize(code).encode()).hexdigest()


def new_backup_codes() -> Tuple[List[str], List[str]]:
    """Generate 10 codes. Returns (plaintext_list, hash_list).
    Plaintext must be shown to the user once and never persisted.
    """
    plain = [secrets.token_urlsafe(9)[:12].upper() for _ in range(BACKUP_CODE_COUNT)]
    return plain, [code_hash(x) for x in plain]


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------
def verify_totp_get_timecode(secret: str, code: str, *, valid_window: int = 1) -> Optional[int]:
    """Return the accepted timecode if the code matches, else None.
    valid_window=1 tolerates ±30s clock drift (recommended).
    """
    if not code or not code.isdigit() or len(code) != TOTP_DIGITS:
        return None
    import time as _time
    totp = pyotp.TOTP(secret, interval=TOTP_PERIOD, digits=TOTP_DIGITS)
    current_tc = int(_time.time()) // TOTP_PERIOD
    for offset in range(-valid_window, valid_window + 1):
        tc = current_tc + offset
        try:
            # TOTP.at(unix_ts) generates the code for a given unix timestamp
            expected = totp.at(tc * TOTP_PERIOD)
            if _consteq(expected, code):
                return int(tc)
        except Exception:
            continue
    return None


def _consteq(a: str, b: str) -> bool:
    """Constant-time comparison to prevent timing-based side channels."""
    from hmac import compare_digest
    return compare_digest(a, b)


def verify_totp_simple(secret: str, code: str, *, valid_window: int = 1) -> bool:
    """Boolean-only helper (used for /disable path where anti-replay is less critical)."""
    return verify_totp_get_timecode(secret, code, valid_window=valid_window) is not None


# ---------------------------------------------------------------------------
# Policy helpers
# ---------------------------------------------------------------------------
def is_2fa_mandatory(user: dict) -> bool:
    role = (user.get("role") or "user").lower()
    return role in MANDATORY_2FA_ROLES


def is_2fa_enabled(user: dict) -> bool:
    t = user.get("totp") or {}
    return bool(t.get("enabled"))
