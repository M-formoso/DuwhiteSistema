"""
Servicio de Usuarios.
CRUD y lógica de negocio para usuarios del sistema.
"""

from typing import List, Optional, Tuple
from uuid import UUID

import bcrypt
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.usuario import Usuario, MODULOS_SISTEMA, PERMISOS_POR_ROL
from app.models.cliente import Cliente
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate, UsuarioCreateForClient, ResetPasswordRequest
from app.services.log_service import log_service


class UsuarioService:
    """Servicio de gestión de usuarios."""

    def obtener_todos(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        activo: Optional[bool] = None,
        rol: Optional[str] = None,
        solo_clientes: bool = False,
    ) -> Tuple[List[Usuario], int]:
        """
        Obtiene lista de usuarios con filtros y paginación.

        Args:
            db: Sesión de base de datos
            skip: Registros a omitir
            limit: Límite de registros
            search: Búsqueda por nombre, apellido o email
            activo: Filtrar por estado activo
            rol: Filtrar por rol
            solo_clientes: Solo usuarios tipo cliente

        Returns:
            Tuple con lista de usuarios y total
        """
        query = db.query(Usuario)

        # Filtro de búsqueda
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    Usuario.nombre.ilike(search_filter),
                    Usuario.apellido.ilike(search_filter),
                    Usuario.email.ilike(search_filter),
                )
            )

        # Filtro por activo
        if activo is not None:
            query = query.filter(Usuario.activo == activo)

        # Filtro por rol
        if rol:
            query = query.filter(Usuario.rol == rol)

        # Solo clientes
        if solo_clientes:
            query = query.filter(Usuario.cliente_id.isnot(None))

        # Total para paginación
        total = query.count()

        # Aplicar paginación
        usuarios = query.order_by(Usuario.created_at.desc()).offset(skip).limit(limit).all()

        return usuarios, total

    def obtener_por_id(self, db: Session, usuario_id: UUID) -> Optional[Usuario]:
        """Obtiene un usuario por su ID."""
        return db.query(Usuario).filter(Usuario.id == usuario_id).first()

    def obtener_por_email(self, db: Session, email: str) -> Optional[Usuario]:
        """Obtiene un usuario por su email."""
        return db.query(Usuario).filter(Usuario.email == email).first()

    def obtener_por_cliente(self, db: Session, cliente_id: UUID) -> List[Usuario]:
        """Obtiene usuarios vinculados a un cliente."""
        return db.query(Usuario).filter(Usuario.cliente_id == cliente_id).all()

    def crear(
        self,
        db: Session,
        data: UsuarioCreate,
        creado_por: UUID,
        ip: Optional[str] = None,
    ) -> Usuario:
        """
        Crea un nuevo usuario.

        Args:
            db: Sesión de base de datos
            data: Datos del usuario a crear
            creado_por: ID del usuario que crea
            ip: IP del cliente

        Returns:
            Usuario creado

        Raises:
            HTTPException 400: Email ya existe
        """
        # Verificar email único
        if self.obtener_por_email(db, data.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe un usuario con este email",
            )

        # Crear usuario
        usuario = Usuario(
            email=data.email,
            password_hash=get_password_hash(data.password),
            nombre=data.nombre,
            apellido=data.apellido,
            telefono=data.telefono,
            pin=data.pin,  # PIN para validación en producción
            rol=data.rol,
            cliente_id=data.cliente_id,
            permisos_modulos=data.permisos_modulos,
            debe_cambiar_password=True,
        )

        # Guardar password visible si se solicita (solo para usuarios cliente)
        if data.guardar_password_visible and data.rol == "cliente":
            usuario.password_visible = data.password

        db.add(usuario)
        db.commit()
        db.refresh(usuario)

        # Registrar creación
        log_service.registrar_creacion(
            db=db,
            usuario_id=creado_por,
            modulo="usuarios",
            entidad_tipo="usuario",
            entidad_id=usuario.id,
            datos={
                "email": usuario.email,
                "nombre": usuario.nombre,
                "apellido": usuario.apellido,
                "rol": usuario.rol,
            },
            ip=ip,
        )

        return usuario

    def crear_para_cliente(
        self,
        db: Session,
        data: UsuarioCreateForClient,
        creado_por: UUID,
        ip: Optional[str] = None,
    ) -> Usuario:
        """
        Crea un usuario vinculado a un cliente existente.

        Args:
            db: Sesión de base de datos
            data: Datos del usuario a crear
            creado_por: ID del usuario que crea
            ip: IP del cliente

        Returns:
            Usuario creado

        Raises:
            HTTPException 400: Email ya existe
            HTTPException 404: Cliente no encontrado
        """
        # Verificar email único
        if self.obtener_por_email(db, data.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe un usuario con este email",
            )

        # Obtener datos del cliente
        cliente = db.query(Cliente).filter(Cliente.id == data.cliente_id).first()
        if not cliente:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cliente no encontrado",
            )

        # Usar datos del cliente si no se proveen
        nombre = data.nombre or cliente.contacto_nombre or cliente.razon_social.split()[0]
        apellido = data.apellido or (cliente.razon_social.split()[1] if len(cliente.razon_social.split()) > 1 else "-")

        # Crear usuario
        usuario = Usuario(
            email=data.email,
            password_hash=get_password_hash(data.password),
            password_visible=data.password,  # Guardar para mostrar en panel admin
            nombre=nombre,
            apellido=apellido,
            telefono=cliente.telefono,
            rol="cliente",
            cliente_id=data.cliente_id,
            permisos_modulos=PERMISOS_POR_ROL["cliente"],
            debe_cambiar_password=False,
        )

        db.add(usuario)
        db.commit()
        db.refresh(usuario)

        # Registrar creación
        log_service.registrar_creacion(
            db=db,
            usuario_id=creado_por,
            modulo="usuarios",
            entidad_tipo="usuario",
            entidad_id=usuario.id,
            datos={
                "email": usuario.email,
                "nombre": usuario.nombre,
                "apellido": usuario.apellido,
                "rol": usuario.rol,
                "cliente_id": str(data.cliente_id),
            },
            ip=ip,
        )

        return usuario

    def actualizar(
        self,
        db: Session,
        usuario_id: UUID,
        data: UsuarioUpdate,
        actualizado_por: UUID,
        ip: Optional[str] = None,
    ) -> Optional[Usuario]:
        """
        Actualiza un usuario existente.

        Args:
            db: Sesión de base de datos
            usuario_id: ID del usuario a actualizar
            data: Datos a actualizar
            actualizado_por: ID del usuario que actualiza
            ip: IP del cliente

        Returns:
            Usuario actualizado o None si no existe

        Raises:
            HTTPException 400: Email ya existe (si se intenta cambiar)
        """
        usuario = self.obtener_por_id(db, usuario_id)
        if not usuario:
            return None

        # Guardar datos anteriores para log
        datos_anteriores = {
            "email": usuario.email,
            "nombre": usuario.nombre,
            "apellido": usuario.apellido,
            "rol": usuario.rol,
            "activo": usuario.activo,
        }

        # Verificar email único si se cambia
        if data.email and data.email != usuario.email:
            if self.obtener_por_email(db, data.email):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ya existe un usuario con este email",
                )

        # Actualizar campos proporcionados
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(usuario, field, value)

        db.commit()
        db.refresh(usuario)

        # Registrar edición
        log_service.registrar_edicion(
            db=db,
            usuario_id=actualizado_por,
            modulo="usuarios",
            entidad_tipo="usuario",
            entidad_id=usuario.id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=update_data,
            ip=ip,
        )

        return usuario

    def resetear_password(
        self,
        db: Session,
        usuario_id: UUID,
        data: ResetPasswordRequest,
        reseteado_por: UUID,
        ip: Optional[str] = None,
    ) -> Optional[Usuario]:
        """
        Resetea la contraseña de un usuario.

        Args:
            db: Sesión de base de datos
            usuario_id: ID del usuario
            data: Datos del nuevo password
            reseteado_por: ID del usuario que resetea
            ip: IP del cliente

        Returns:
            Usuario actualizado o None si no existe
        """
        usuario = self.obtener_por_id(db, usuario_id)
        if not usuario:
            return None

        # Hashear nuevo password
        usuario.password_hash = get_password_hash(data.password_nuevo)
        usuario.debe_cambiar_password = True

        # Guardar password visible si se solicita
        if data.guardar_password_visible:
            usuario.password_visible = data.password_nuevo
        else:
            usuario.password_visible = None

        db.commit()
        db.refresh(usuario)

        # Registrar cambio
        log_service.registrar(
            db=db,
            usuario_id=reseteado_por,
            accion="editar",
            modulo="usuarios",
            entidad_tipo="usuario",
            entidad_id=usuario.id,
            datos_nuevos={"password": "***reseteado***"},
            descripcion="Password reseteado",
            ip=ip,
        )

        return usuario

    def actualizar_permisos(
        self,
        db: Session,
        usuario_id: UUID,
        permisos: dict,
        actualizado_por: UUID,
        ip: Optional[str] = None,
    ) -> Optional[Usuario]:
        """
        Actualiza los permisos de módulos de un usuario.

        Args:
            db: Sesión de base de datos
            usuario_id: ID del usuario
            permisos: Dict de permisos por módulo
            actualizado_por: ID del usuario que actualiza
            ip: IP del cliente

        Returns:
            Usuario actualizado o None si no existe
        """
        usuario = self.obtener_por_id(db, usuario_id)
        if not usuario:
            return None

        # Validar que los módulos sean válidos
        for modulo in permisos.keys():
            if modulo not in MODULOS_SISTEMA:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Módulo inválido: {modulo}",
                )

        permisos_anteriores = usuario.permisos_modulos
        usuario.permisos_modulos = permisos
        db.commit()
        db.refresh(usuario)

        # Registrar cambio
        log_service.registrar(
            db=db,
            usuario_id=actualizado_por,
            accion="editar",
            modulo="usuarios",
            entidad_tipo="usuario",
            entidad_id=usuario.id,
            datos_anteriores={"permisos_modulos": permisos_anteriores},
            datos_nuevos={"permisos_modulos": permisos},
            descripcion="Permisos actualizados",
            ip=ip,
        )

        return usuario

    def eliminar(
        self,
        db: Session,
        usuario_id: UUID,
        eliminado_por: UUID,
        ip: Optional[str] = None,
    ) -> bool:
        """
        Elimina (soft delete) un usuario.

        Args:
            db: Sesión de base de datos
            usuario_id: ID del usuario a eliminar
            eliminado_por: ID del usuario que elimina
            ip: IP del cliente

        Returns:
            True si se eliminó, False si no existía
        """
        usuario = self.obtener_por_id(db, usuario_id)
        if not usuario:
            return False

        # Soft delete
        usuario.activo = False
        db.commit()

        # Registrar eliminación
        log_service.registrar_eliminacion(
            db=db,
            usuario_id=eliminado_por,
            modulo="usuarios",
            entidad_tipo="usuario",
            entidad_id=usuario.id,
            datos={
                "email": usuario.email,
                "nombre": usuario.nombre,
                "apellido": usuario.apellido,
            },
            ip=ip,
        )

        return True

    def toggle_activo(
        self,
        db: Session,
        usuario_id: UUID,
        actualizado_por: UUID,
        ip: Optional[str] = None,
    ) -> Optional[Usuario]:
        """
        Activa/desactiva un usuario.

        Returns:
            Usuario actualizado o None si no existe
        """
        usuario = self.obtener_por_id(db, usuario_id)
        if not usuario:
            return None

        estado_anterior = usuario.activo
        usuario.activo = not usuario.activo
        db.commit()
        db.refresh(usuario)

        # Registrar cambio
        log_service.registrar(
            db=db,
            usuario_id=actualizado_por,
            accion="editar",
            modulo="usuarios",
            entidad_tipo="usuario",
            entidad_id=usuario.id,
            datos_anteriores={"activo": estado_anterior},
            datos_nuevos={"activo": usuario.activo},
            descripcion=f"Usuario {'activado' if usuario.activo else 'desactivado'}",
            ip=ip,
        )

        return usuario

    def get_modulos_y_permisos(self) -> dict:
        """Retorna los módulos disponibles y permisos por rol."""
        return {
            "modulos_disponibles": MODULOS_SISTEMA,
            "permisos_por_rol": PERMISOS_POR_ROL,
        }


# Instancia singleton del servicio
usuario_service = UsuarioService()
