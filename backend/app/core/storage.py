"""
Almacenamiento de archivos adjuntos (imágenes, PDFs).

Estrategia actual: disco local del backend, con ruta configurable por env
UPLOAD_DIR (default: /app/uploads en Railway, ./uploads en dev).

⚠️ IMPORTANTE en Railway: para que los archivos persistan entre redeploys
hay que montar un Persistent Volume en la ruta de UPLOAD_DIR. Sin volumen
los adjuntos se pierden en cada deploy.

Migración futura sugerida: mover a S3 / Cloudflare R2 detrás de la misma
API pública (guardar_archivo / abrir_archivo).
"""

from __future__ import annotations

import os
import re
from datetime import date
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status


# Ruta base de almacenamiento — configurable por env var.
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads")).resolve()

# Tamaño máximo por archivo (10 MB).
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

# Extensiones permitidas por tipo de adjunto.
EXTENSIONES_IMAGEN_CHEQUE = {"jpg", "jpeg", "png", "webp", "pdf"}


def _safe_ext(nombre: str) -> str:
    """Extrae la extensión (sin punto, en minúsculas) del nombre original."""
    if "." not in nombre:
        return ""
    ext = nombre.rsplit(".", 1)[1].lower()
    # Sanitizar: solo alfanumérico
    if not re.fullmatch(r"[a-z0-9]{1,10}", ext):
        return ""
    return ext


def guardar_archivo_cheque(archivo: UploadFile) -> str:
    """
    Guarda un archivo de cheque en disco y devuelve la ruta relativa
    (a UPLOAD_DIR) para persistir en la BD.

    Estructura: cheques/{YYYY}/{MM}/{uuid}.{ext}

    Raises:
        HTTPException 400: extensión inválida, archivo vacío, tamaño excedido.
    """
    ext = _safe_ext(archivo.filename or "")
    if ext not in EXTENSIONES_IMAGEN_CHEQUE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Tipo de archivo no permitido para cheques. "
                f"Extensiones válidas: {', '.join(sorted(EXTENSIONES_IMAGEN_CHEQUE))}"
            ),
        )

    hoy = date.today()
    subdir = Path("cheques") / f"{hoy.year:04d}" / f"{hoy.month:02d}"
    nombre_final = f"{uuid4().hex}.{ext}"
    ruta_relativa = subdir / nombre_final
    ruta_absoluta = UPLOAD_DIR / ruta_relativa

    ruta_absoluta.parent.mkdir(parents=True, exist_ok=True)

    # Streaming write con chequeo de tamaño.
    total = 0
    with ruta_absoluta.open("wb") as f:
        while True:
            chunk = archivo.file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_UPLOAD_BYTES:
                f.close()
                ruta_absoluta.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Archivo demasiado grande. Máximo permitido: {MAX_UPLOAD_BYTES // (1024*1024)} MB",
                )
            f.write(chunk)

    if total == 0:
        ruta_absoluta.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo está vacío",
        )

    return str(ruta_relativa).replace("\\", "/")


def abrir_archivo_cheque(ruta_relativa: str) -> Path:
    """
    Devuelve la ruta absoluta a un archivo de cheque, verificando que
    esté dentro de UPLOAD_DIR (protección contra path traversal).
    """
    if not ruta_relativa:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    ruta = (UPLOAD_DIR / ruta_relativa).resolve()
    try:
        ruta.relative_to(UPLOAD_DIR)
    except ValueError:
        # Ruta fuera de UPLOAD_DIR → path traversal
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    if not ruta.is_file():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    return ruta


def content_type_por_extension(ruta: Path) -> str:
    """Devuelve el content-type según la extensión del archivo."""
    ext = ruta.suffix.lower().lstrip(".")
    return {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
        "pdf": "application/pdf",
    }.get(ext, "application/octet-stream")


def eliminar_archivo(ruta_relativa: Optional[str]) -> None:
    """Elimina un archivo si existe. Silencioso ante errores."""
    if not ruta_relativa:
        return
    try:
        ruta = (UPLOAD_DIR / ruta_relativa).resolve()
        ruta.relative_to(UPLOAD_DIR)
        ruta.unlink(missing_ok=True)
    except (ValueError, OSError):
        pass
