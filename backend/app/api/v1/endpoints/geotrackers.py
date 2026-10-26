"""
Endpoints proxy a la API de GeoTrackers.

Toda la lógica de auth (X-API-Key), cache y rate limit vive en el cliente
`app.integrations.geotrackers.client`. Acá sólo adaptamos el request del
frontend al llamador y traducimos errores HTTP.

El frontend NUNCA llama directo a GeoTrackers — llama acá con su JWT y
este proxy inyecta la API key.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_db, get_current_user, require_permission
from app.integrations.geotrackers import client as gt_client
from app.integrations.geotrackers.client import GeoTrackersError
from app.models.cliente import Cliente
from app.models.lote_produccion import LoteProduccion, EstadoLote
from app.models.remito import Remito, EstadoRemito
from app.models.usuario import Usuario
from app.models.vehiculo import Vehiculo


router = APIRouter()

# Roles con acceso al módulo de geolocalización. Operador queda afuera
# por default — si en el futuro los choferes necesitan ver el mapa se agrega.
REQUIERE_ROL = require_permission(
    "superadmin",
    "administrador",
    "jefe_produccion",
    "comercial",
)


def _traducir_error(exc: GeoTrackersError) -> HTTPException:
    """Reempaqueta un error del cliente como HTTPException para FastAPI."""
    code = exc.status_code or 500
    # Mapeo explícito: evitamos exponer 401 "upstream" como si fuera nuestro,
    # porque confunde al operador (parece que su token DUWHITE expiró).
    if code == 401:
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="API Key de GeoTrackers inválida o no autorizada",
        )
    if code == 429:
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        )
    if code == 503:
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    return HTTPException(status_code=code if 400 <= code < 600 else 500, detail=str(exc))


@router.get("/ubicaciones")
def obtener_ubicaciones(
    limit: int = Query(200, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(REQUIERE_ROL),
):
    """
    Última ubicación de TODOS los vehículos de la flota.
    Es el endpoint que alimenta el mapa principal.
    """
    try:
        return gt_client.ubicaciones_todos(limit=limit, offset=offset)
    except GeoTrackersError as exc:
        raise _traducir_error(exc)


@router.get("/vehiculos")
def listar_vehiculos(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(REQUIERE_ROL),
):
    """Catálogo de vehículos de GeoTrackers (sin posiciones)."""
    try:
        return gt_client.listar_dispositivos(limit=limit, offset=offset)
    except GeoTrackersError as exc:
        raise _traducir_error(exc)


@router.get("/vehiculos/{dispositivo_id}")
def obtener_vehiculo(
    dispositivo_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(REQUIERE_ROL),
):
    """Datos de un vehículo por ID."""
    try:
        return gt_client.info_dispositivo(dispositivo_id)
    except GeoTrackersError as exc:
        raise _traducir_error(exc)


@router.get("/vehiculos/{dispositivo_id}/ubicacion")
def obtener_ubicacion_vehiculo(
    dispositivo_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(REQUIERE_ROL),
):
    """Última ubicación de un vehículo específico."""
    try:
        return gt_client.ubicacion_dispositivo(dispositivo_id)
    except GeoTrackersError as exc:
        raise _traducir_error(exc)


@router.get("/vehiculos/{dispositivo_id}/historial")
def obtener_historial_vehiculo(
    dispositivo_id: int,
    desde: str = Query(..., description="YYYY-MM-DD o YYYY-MM-DD HH:MM:SS"),
    hasta: str = Query(..., description="YYYY-MM-DD o YYYY-MM-DD HH:MM:SS"),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(REQUIERE_ROL),
):
    """
    Historial de posiciones GPS de un vehículo entre dos fechas.
    Útil para dibujar el recorrido en el mapa de detalle.
    """
    try:
        return gt_client.historial_dispositivo(
            dispositivo_id=dispositivo_id,
            desde=desde,
            hasta=hasta,
            limit=limit,
            offset=offset,
        )
    except GeoTrackersError as exc:
        raise _traducir_error(exc)


# ==================== CATÁLOGO LOCAL DE VEHÍCULOS ====================
#
# Vehiculo (modelo local) es el "puente" entre la telemetría de GeoTrackers
# y la lógica de negocio DUWHITE. El frontend consume `/local` para armar
# los selectores de "¿qué vehículo lo lleva?" en los formularios de
# recolección y de remito.
#
# `POST /sincronizar` trae el listado de GeoTrackers y lo persiste en la
# tabla local: inserta los nuevos, actualiza patente/nombre/imei de los
# existentes, y marca como inactivos los que GeoTrackers ya no reporta.


@router.get("/local")
def listar_vehiculos_locales(
    solo_activos: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(REQUIERE_ROL),
):
    """Catálogo local sincronizado con GeoTrackers (alimenta los selectores)."""
    query = db.query(Vehiculo)
    if solo_activos:
        query = query.filter(Vehiculo.activo == True)
    vehiculos = query.order_by(Vehiculo.patente).all()
    return [
        {
            "id": str(v.id),
            "geotrackers_id": v.geotrackers_id,
            "patente": v.patente,
            "nombre": v.nombre,
            "chofer_default": v.chofer_default,
            "activo": v.activo,
        }
        for v in vehiculos
    ]


@router.post("/sincronizar", status_code=status.HTTP_200_OK)
def sincronizar_vehiculos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador")),
):
    """
    Sincroniza el catálogo local con GeoTrackers:
    - crea vehículos nuevos (los que están en GeoTrackers y no en la tabla local),
    - actualiza patente / nombre / imei si cambiaron,
    - marca como inactivos los que GeoTrackers ya no reporta.
    """
    try:
        payload = gt_client.listar_dispositivos(limit=200, offset=0)
    except GeoTrackersError as exc:
        raise _traducir_error(exc)

    remotos = payload.get("data", []) or []
    remotos_por_id: Dict[int, Dict[str, Any]] = {
        int(d["id"]): d for d in remotos if "id" in d
    }

    locales = db.query(Vehiculo).all()
    locales_por_gt_id: Dict[int, Vehiculo] = {v.geotrackers_id: v for v in locales}

    creados = 0
    actualizados = 0
    desactivados = 0

    # Alta + update
    for gt_id, data in remotos_por_id.items():
        existing = locales_por_gt_id.get(gt_id)
        if existing is None:
            db.add(
                Vehiculo(
                    id=uuid4(),
                    geotrackers_id=gt_id,
                    patente=str(data.get("patente") or "").strip(),
                    nombre=str(data.get("nombre") or "").strip() or None,
                    imei=str(data.get("imei") or "").strip() or None,
                    activo=True,
                )
            )
            creados += 1
        else:
            cambio = False
            nueva_patente = str(data.get("patente") or "").strip()
            nuevo_nombre = str(data.get("nombre") or "").strip() or None
            nuevo_imei = str(data.get("imei") or "").strip() or None
            if existing.patente != nueva_patente and nueva_patente:
                existing.patente = nueva_patente
                cambio = True
            if existing.nombre != nuevo_nombre:
                existing.nombre = nuevo_nombre
                cambio = True
            if existing.imei != nuevo_imei:
                existing.imei = nuevo_imei
                cambio = True
            if not existing.activo:
                existing.activo = True
                cambio = True
            if cambio:
                actualizados += 1

    # Soft-delete de los que ya no están en GeoTrackers
    for gt_id, local in locales_por_gt_id.items():
        if gt_id not in remotos_por_id and local.activo:
            local.activo = False
            desactivados += 1

    db.commit()

    return {
        "creados": creados,
        "actualizados": actualizados,
        "desactivados": desactivados,
        "total_remotos": len(remotos_por_id),
    }


# ==================== ASIGNACIONES VEHÍCULO ↔ LOTE/REMITO ====================


@router.get("/vehiculos/{geotrackers_id}/asignaciones")
def obtener_asignaciones_vehiculo(
    geotrackers_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(REQUIERE_ROL),
):
    """
    Qué pedidos tiene asignados ACTUALMENTE este vehículo:
    - Lotes activos cuya recolección está asignada a este vehículo.
    - Remitos activos (emitido / entregado) con este vehículo asignado para la entrega.

    Este es el endpoint que alimenta el popup del marker en el mapa.
    `geotrackers_id` es el ID del dispositivo tal cual lo reporta GeoTrackers
    (= Vehiculo.geotrackers_id del catálogo local).
    """
    vehiculo = (
        db.query(Vehiculo)
        .filter(Vehiculo.geotrackers_id == geotrackers_id)
        .first()
    )
    if not vehiculo:
        return {
            "vehiculo": None,
            "recolecciones": [],
            "entregas": [],
            "mensaje": "Este vehículo todavía no fue sincronizado en el catálogo local.",
        }

    # RECOLECCIONES — lotes asignados a este vehículo que no están completados
    recolecciones_q = (
        db.query(LoteProduccion)
        .options(joinedload(LoteProduccion.cliente))
        .filter(
            LoteProduccion.vehiculo_recoleccion_id == vehiculo.id,
            LoteProduccion.activo == True,
            LoteProduccion.estado.in_([
                EstadoLote.EN_CAMINO.value,
                EstadoLote.PENDIENTE.value,
                EstadoLote.EN_PROCESO.value,
                EstadoLote.PAUSADO.value,
                EstadoLote.PARCIALMENTE_COMPLETADO.value,
            ]),
        )
        .order_by(LoteProduccion.fecha_ingreso.desc())
        .limit(20)
        .all()
    )

    # ENTREGAS — remitos con este vehículo asignado, aún no entregados
    entregas_q = (
        db.query(Remito)
        .options(joinedload(Remito.cliente))
        .filter(
            Remito.vehiculo_id == vehiculo.id,
            Remito.activo == True,
            Remito.estado.in_([
                EstadoRemito.EMITIDO.value,
                EstadoRemito.ENTREGADO.value,
            ]),
        )
        .order_by(Remito.fecha_emision.desc())
        .limit(20)
        .all()
    )

    return {
        "vehiculo": {
            "id": str(vehiculo.id),
            "geotrackers_id": vehiculo.geotrackers_id,
            "patente": vehiculo.patente,
            "nombre": vehiculo.nombre,
        },
        "recolecciones": [
            {
                "lote_id": str(l.id),
                "numero": l.numero,
                "cliente": (
                    l.cliente.nombre_fantasia or l.cliente.razon_social
                    if l.cliente else None
                ),
                "estado": l.estado,
                "fecha_ingreso": l.fecha_ingreso.isoformat() if l.fecha_ingreso else None,
            }
            for l in recolecciones_q
        ],
        "entregas": [
            {
                "remito_id": str(r.id),
                "numero": r.numero,
                "cliente": (
                    r.cliente.nombre_fantasia or r.cliente.razon_social
                    if r.cliente else None
                ),
                "estado": r.estado,
                "fecha_emision": r.fecha_emision.isoformat() if r.fecha_emision else None,
            }
            for r in entregas_q
        ],
    }
