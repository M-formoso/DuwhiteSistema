"""
Sistema de permisos basado en roles para DUWHITE.
Define qué acciones puede realizar cada rol en cada módulo.
"""

from enum import Enum
from functools import wraps
from typing import Callable, List

from fastapi import HTTPException, status


class Rol(str, Enum):
    """Roles disponibles en el sistema."""

    SUPERADMIN = "superadmin"
    ADMINISTRADOR = "administrador"
    JEFE_PRODUCCION = "jefe_produccion"
    OPERADOR = "operador"
    COMERCIAL = "comercial"
    CONTADOR = "contador"
    SOLO_LECTURA = "solo_lectura"


# Definición de permisos por rol
PERMISOS_POR_ROL: dict[str, List[str]] = {
    Rol.SUPERADMIN: ["*"],  # Acceso total
    Rol.ADMINISTRADOR: [
        # Usuarios (excepto gestión de superadmins)
        "usuarios.ver",
        "usuarios.crear",
        "usuarios.editar",
        "usuarios.eliminar",
        # Stock
        "stock.ver",
        "stock.crear",
        "stock.editar",
        "stock.eliminar",
        # Proveedores
        "proveedores.ver",
        "proveedores.crear",
        "proveedores.editar",
        "proveedores.eliminar",
        # Producción
        "produccion.ver",
        "produccion.crear",
        "produccion.editar",
        "produccion.eliminar",
        # Clientes
        "clientes.ver",
        "clientes.crear",
        "clientes.editar",
        "clientes.eliminar",
        # Pedidos
        "pedidos.ver",
        "pedidos.crear",
        "pedidos.editar",
        "pedidos.eliminar",
        # Cuenta Corriente
        "cuenta_corriente.ver",
        "cuenta_corriente.crear",
        "cuenta_corriente.editar",
        # Listas de Precios
        "listas_precios.ver",
        "listas_precios.crear",
        "listas_precios.editar",
        "listas_precios.eliminar",
        # Empleados
        "empleados.ver",
        "empleados.crear",
        "empleados.editar",
        "empleados.eliminar",
        # Finanzas
        "finanzas.ver",
        "finanzas.crear",
        "finanzas.editar",
        "finanzas.eliminar",
        # Facturación
        "facturacion.ver",
        "facturacion.crear",
        "facturacion.editar",
        "facturacion.eliminar",
        # Costos
        "costos.ver",
        "costos.crear",
        "costos.editar",
        # Actividades
        "actividades.ver",
        "actividades.crear",
        "actividades.editar",
        "actividades.eliminar",
        # Reportes
        "reportes.ver",
        "reportes.exportar",
        # Configuración
        "configuracion.ver",
        "configuracion.editar",
    ],
    Rol.JEFE_PRODUCCION: [
        # Stock
        "stock.ver",
        "stock.crear",
        "stock.editar",
        # Proveedores (solo ver)
        "proveedores.ver",
        # Producción (acceso total)
        "produccion.ver",
        "produccion.crear",
        "produccion.editar",
        "produccion.eliminar",
        # Clientes (solo ver)
        "clientes.ver",
        # Pedidos (solo ver)
        "pedidos.ver",
        # Empleados (ver equipo)
        "empleados.ver",
        # Costos (solo ver)
        "costos.ver",
        # Actividades (equipo)
        "actividades.ver",
        "actividades.crear",
        "actividades.editar",
        # Reportes de producción
        "reportes.ver",
        "reportes.exportar",
    ],
    Rol.OPERADOR: [
        # Stock (solo ver)
        "stock.ver",
        # Producción (registrar etapas)
        "produccion.ver",
        "produccion.registrar",
        # Actividades propias
        "actividades.ver",
        "actividades.editar_propias",
    ],
    Rol.COMERCIAL: [
        # Stock (solo ver)
        "stock.ver",
        # Proveedores (solo ver)
        "proveedores.ver",
        # Clientes (acceso total)
        "clientes.ver",
        "clientes.crear",
        "clientes.editar",
        "clientes.eliminar",
        # Pedidos (acceso total)
        "pedidos.ver",
        "pedidos.crear",
        "pedidos.editar",
        "pedidos.eliminar",
        # Cuenta Corriente (solo ver)
        "cuenta_corriente.ver",
        # Listas de Precios (solo ver)
        "listas_precios.ver",
        # Actividades propias
        "actividades.ver",
        "actividades.crear",
        "actividades.editar_propias",
        # Reportes comerciales
        "reportes.ver",
    ],
    Rol.CONTADOR: [
        # Stock (solo ver)
        "stock.ver",
        # Proveedores
        "proveedores.ver",
        "proveedores.crear",
        "proveedores.editar",
        # Clientes (solo ver)
        "clientes.ver",
        # Cuenta Corriente
        "cuenta_corriente.ver",
        "cuenta_corriente.crear",
        "cuenta_corriente.editar",
        # Listas de Precios
        "listas_precios.ver",
        "listas_precios.crear",
        "listas_precios.editar",
        # Empleados (solo ver)
        "empleados.ver",
        # Finanzas (acceso total)
        "finanzas.ver",
        "finanzas.crear",
        "finanzas.editar",
        "finanzas.eliminar",
        # Facturación (acceso total)
        "facturacion.ver",
        "facturacion.crear",
        "facturacion.editar",
        "facturacion.eliminar",
        # Costos
        "costos.ver",
        "costos.crear",
        "costos.editar",
        # Actividades propias
        "actividades.ver",
        "actividades.editar_propias",
        # Reportes financieros
        "reportes.ver",
        "reportes.exportar",
    ],
    Rol.SOLO_LECTURA: [
        # Solo permisos de lectura en todos los módulos
        "usuarios.ver",
        "stock.ver",
        "proveedores.ver",
        "produccion.ver",
        "clientes.ver",
        "pedidos.ver",
        "cuenta_corriente.ver",
        "listas_precios.ver",
        "empleados.ver",
        "finanzas.ver",
        "facturacion.ver",
        "costos.ver",
        "actividades.ver",
        "reportes.ver",
    ],
}


def tiene_permiso(rol: str, permiso: str) -> bool:
    """
    Verifica si un rol tiene un permiso específico.

    Args:
        rol: Rol del usuario
        permiso: Permiso a verificar (ej: "stock.crear")

    Returns:
        True si tiene el permiso, False si no
    """
    permisos_rol = PERMISOS_POR_ROL.get(rol, [])

    # Superadmin tiene acceso total
    if "*" in permisos_rol:
        return True

    return permiso in permisos_rol


def verificar_permiso(usuario, permiso: str) -> None:
    """
    Verifica si el usuario tiene el permiso requerido.
    Lanza HTTPException si no tiene permiso.

    Args:
        usuario: Usuario actual
        permiso: Permiso requerido
    """
    if not tiene_permiso(usuario.rol, permiso):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No tienes permiso para realizar esta acción: {permiso}",
        )


def require_permissions(permisos: List[str]) -> Callable:
    """
    Decorador para verificar permisos en endpoints.
    Requiere que el usuario tenga AL MENOS UNO de los permisos listados.

    Uso:
        @router.get("/")
        @require_permissions(["stock.ver"])
        async def listar_stock(...):
            pass
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # El current_user debe estar en kwargs (inyectado por Depends)
            current_user = kwargs.get("current_user")
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Usuario no autenticado",
                )

            # Verificar si tiene al menos uno de los permisos
            tiene_algun_permiso = any(
                tiene_permiso(current_user.rol, p) for p in permisos
            )

            if not tiene_algun_permiso:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"No tienes permiso para realizar esta acción. Permisos requeridos: {permisos}",
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator
