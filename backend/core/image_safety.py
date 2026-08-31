"""Image upload sanitization for MoreFit.

Every user-provided image (progress photos, meal photos, avatars) MUST
go through `sanitize_image_base64()` before being persisted or forwarded
to a third-party. The pipeline:

1. Decode base64 (strict, rejects data-URI prefix that doesn't match a whitelist).
2. Enforce size limits (default: 5 MB per image).
3. Open with Pillow, `verify()` magic bytes match a known format.
4. Re-open (verify closes the file), convert to RGB, resize if huge.
5. **Strip ALL metadata** (EXIF including GPS, IPTC, XMP) via re-encode.
6. Return normalized base64 (JPEG q=85, no metadata).

Also exposes `check_user_quota()` to bail early if the user is at their storage cap.
"""
from __future__ import annotations

import base64
import io
from typing import Optional

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

# -- Public constants (tune if needed) --------------------------------------
MAX_IMAGE_BYTES = 5 * 1024 * 1024        # 5 MB per image (before decode)
MAX_DIMENSION_PX = 2048                   # long-edge cap for storage
DEFAULT_JPEG_QUALITY = 85
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "HEIF", "HEIC"}
# Total storage per user across ALL photo collections (photos + meal photos + avatar):
USER_PHOTOS_QUOTA_BYTES = 50 * 1024 * 1024  # 50 MB


# Optional HEIF support (Pillow needs pillow-heif to open HEIC/HEIF files)
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except Exception:  # pragma: no cover — optional dep
    pass


def _strip_data_uri(s: str) -> str:
    """Accept both `data:image/jpeg;base64,AAAA...` and raw base64."""
    if not isinstance(s, str):
        raise HTTPException(400, "image_base64 must be a string")
    s = s.strip()
    if s.startswith("data:"):
        try:
            header, s = s.split(",", 1)
        except ValueError:
            raise HTTPException(400, "Malformed data URI")
        # only allow image/* content types in the header
        low = header.lower()
        if "image/" not in low:
            raise HTTPException(400, "Somente imagens são aceitas")
    return s


def sanitize_image_base64(
    b64: str,
    *,
    max_bytes: int = MAX_IMAGE_BYTES,
    max_dim: int = MAX_DIMENSION_PX,
    quality: int = DEFAULT_JPEG_QUALITY,
    formats: Optional[set[str]] = None,
) -> tuple[str, int]:
    """Return (sanitized_base64, byte_size_after) or raise HTTPException(400).

    The returned base64 is always a JPEG (RGB, no metadata), safe for storage.
    """
    if not b64:
        raise HTTPException(400, "image_base64 vazio")
    b64 = _strip_data_uri(b64)

    # Base64 decode (fast, doesn't touch pixels)
    try:
        raw = base64.b64decode(b64, validate=True)
    except Exception:
        raise HTTPException(400, "image_base64 inválido")

    if len(raw) > max_bytes:
        raise HTTPException(413, f"Imagem grande demais. Máximo {max_bytes // 1024 // 1024} MB.")

    # Magic-byte + format validation via Pillow.verify()
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            probe.verify()
            fmt = (probe.format or "").upper()
    except (UnidentifiedImageError, Exception):
        raise HTTPException(400, "Formato de imagem não reconhecido")

    allowed = formats or ALLOWED_FORMATS
    if fmt not in allowed:
        raise HTTPException(400, f"Formato {fmt} não permitido. Use JPEG, PNG ou WEBP.")

    # Re-open for actual processing (verify() closes the file handle)
    try:
        img = Image.open(io.BytesIO(raw))
        # Respect EXIF orientation BEFORE stripping metadata (so photo stays upright)
        img = ImageOps.exif_transpose(img)
        # Normalize color mode — drops alpha to avoid oddities
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        # Downscale if very large (keeps aspect ratio)
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    except Exception:
        raise HTTPException(400, "Não foi possível processar a imagem")

    # Re-encode as JPEG WITHOUT metadata (key step for EXIF/GPS strip)
    out = io.BytesIO()
    img.save(
        out,
        format="JPEG",
        quality=quality,
        optimize=True,
        progressive=True,
        exif=b"",   # ⚠️ empties EXIF
        icc_profile=None,
    )
    encoded = base64.b64encode(out.getvalue()).decode()
    return encoded, len(out.getvalue())


async def check_user_quota(db, user_id: str, extra_bytes: int = 0) -> None:
    """Raise 413 if adding `extra_bytes` would exceed the user's total quota.

    Approximates the current usage by summing base64 lengths across the 3 collections
    that store image blobs. Runs a couple of aggregations, cheap enough for a POST path.
    """
    # base64 length ≈ 4/3 of raw bytes. We reverse it for a good enough estimate.
    def _b64_to_bytes(b64_len: int) -> int:
        return int(b64_len * 3 / 4)

    async def _sum(coll: str, field: str) -> int:
        pipeline = [
            {"$match": {"user_id": user_id, field: {"$exists": True, "$ne": None}}},
            {"$project": {"len": {"$strLenCP": {"$ifNull": [f"${field}", ""]}}}},
            {"$group": {"_id": None, "total": {"$sum": "$len"}}},
        ]
        docs = await db[coll].aggregate(pipeline).to_list(1)
        return _b64_to_bytes(docs[0]["total"]) if docs else 0

    total = 0
    total += await _sum("photos", "image_base64")
    total += await _sum("meals", "image_base64")
    # avatar in users doc
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "photo_base64": 1})
    if u and u.get("photo_base64"):
        total += _b64_to_bytes(len(u["photo_base64"]))

    if total + extra_bytes > USER_PHOTOS_QUOTA_BYTES:
        raise HTTPException(
            413,
            f"Cota de imagens excedida (max {USER_PHOTOS_QUOTA_BYTES // 1024 // 1024} MB por usuário)",
        )
