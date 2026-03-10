"""
Servicio de Producción (Lotes, Etapas, Kanban).
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.etapa_produccion import EtapaProduccion
from app.models.maquina import Maquina
from app.models.lote_produccion import (
    LoteProduccion,
    LoteEtapa,
    ConsumoInsumoLote,
    EstadoLote,
    PrioridadLote,
)
from app.models.orden_produccion import (
    OrdenProduccion,
    AsignacionEmpleadoOP,
    IncidenciaProduccion,
    EstadoOrdenProduccion,
)
from app.models.insumo import Insumo
from app.models.movimiento_stock import TipoMovimiento, OrigenMovimiento
from app.schemas.etapa_produccion import EtapaProduccionCreate, EtapaProduccionUpdate
from app.schemas.maquina import MaquinaCreate, MaquinaUpdate
from app.schemas.lote_produccion import (
    LoteProduccionCreate,
    LoteProduccionUpdate,
    LoteEtapaUpdate,
    ConsumoInsumoLoteCreate,
    IniciarEtapaRequest,
    FinalizarEtapaRequest,
    MoverLoteRequest,
    KanbanBoard,
    KanbanColumna,
    KanbanLote,
)
from app.services.log_service import log_service
from app.services.stock_service import StockService
from app.models.usuario import Usuario


class ProduccionService:
    """Servicio para gestión de producción."""

    def __init__(self, db: Session):
        self.db = db
        self.log_service = log_service

    # ==================== VALIDACIÓN DE PIN ====================

    def validar_pin_operario(
        self,
        operario_id: UUID,
        pin: str,
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Valida el PIN de un operario.

        Returns:
            Tuple[valido, operario_nombre, mensaje_error]
        """
        usuario = self.db.query(Usuario).filter(Usuario.id == operario_id).first()

        if not usuario:
            return (False, None, "Operario no encontrado")

        if not usuario.activo:
            return (False, None, "Usuario inactivo")

        if not usuario.pin:
            return (False, usuario.nombre_completo, "El operario no tiene PIN configurado")

        if usuario.pin != pin:
            return (False, usuario.nombre_completo, "PIN incorrecto")

        return (True, usuario.nombre_completo, None)

    def _validar_pin_si_requerido(
        self,
        operario_id: Optional[UUID],
        pin: Optional[str],
    ) -> Tuple[bool, Optional[str]]:
        """
        Valida el PIN si se proporcionaron los datos.
        Retorna (valido, mensaje_error)
        """
        if operario_id and pin:
            valido, nombre, error = self.validar_pin_operario(operario_id, pin)
            if not valido:
                return (False, error)
        return (True, None)

    def get_operarios_con_pin(self) -> List[dict]:
        """Obtiene lista de operarios que tienen PIN configurado."""
        usuarios = (
            self.db.query(Usuario)
            .filter(
                Usuario.activo == True,
                Usuario.pin.isnot(None),
                Usuario.rol.in_(["operador", "jefe_produccion", "administrador", "superadmin"])
            )
            .all()
        )

        return [
            {
                "id": str(u.id),
                "nombre": u.nombre_completo,
                "rol": u.rol,
            }
            for u in usuarios
        ]

    # ==================== ETAPAS ====================

    def get_etapas(
        self,
        solo_activas: bool = True,
    ) -> List[EtapaProduccion]:
        """Obtiene lista de etapas ordenadas."""
        query = self.db.query(EtapaProduccion)

        if solo_activas:
            query = query.filter(EtapaProduccion.activo == True)

        return query.order_by(EtapaProduccion.orden).all()

    def get_etapa(self, etapa_id: UUID) -> Optional[EtapaProduccion]:
        """Obtiene una etapa por ID."""
        return self.db.query(EtapaProduccion).filter(EtapaProduccion.id == etapa_id).first()

    def create_etapa(self, data: EtapaProduccionCreate, usuario_id: UUID) -> EtapaProduccion:
        """Crea una nueva etapa."""
        etapa = EtapaProduccion(**data.model_dump())
        self.db.add(etapa)
        self.db.commit()
        self.db.refresh(etapa)

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="crear",
            entidad="EtapaProduccion",
            entidad_id=etapa.id,
            datos_nuevos=data.model_dump(),
        )

        return etapa

    def update_etapa(
        self,
        etapa_id: UUID,
        data: EtapaProduccionUpdate,
        usuario_id: UUID,
    ) -> Optional[EtapaProduccion]:
        """Actualiza una etapa."""
        etapa = self.get_etapa(etapa_id)
        if not etapa:
            return None

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(etapa, field, value)

        self.db.commit()
        self.db.refresh(etapa)

        return etapa

    # ==================== MÁQUINAS ====================

    def get_maquinas(
        self,
        tipo: Optional[str] = None,
        estado: Optional[str] = None,
        solo_activas: bool = True,
    ) -> List[Maquina]:
        """Obtiene lista de máquinas."""
        query = self.db.query(Maquina)

        if solo_activas:
            query = query.filter(Maquina.activo == True)

        if tipo:
            query = query.filter(Maquina.tipo == tipo)

        if estado:
            query = query.filter(Maquina.estado == estado)

        return query.order_by(Maquina.codigo).all()

    def get_maquina(self, maquina_id: UUID) -> Optional[Maquina]:
        """Obtiene una máquina por ID."""
        return self.db.query(Maquina).filter(Maquina.id == maquina_id).first()

    def create_maquina(self, data: MaquinaCreate, usuario_id: UUID) -> Maquina:
        """Crea una nueva máquina."""
        maquina = Maquina(**data.model_dump())
        self.db.add(maquina)
        self.db.commit()
        self.db.refresh(maquina)

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="crear",
            entidad="Maquina",
            entidad_id=maquina.id,
            datos_nuevos=data.model_dump(),
        )

        return maquina

    def update_maquina(
        self,
        maquina_id: UUID,
        data: MaquinaUpdate,
        usuario_id: UUID,
    ) -> Optional[Maquina]:
        """Actualiza una máquina."""
        maquina = self.get_maquina(maquina_id)
        if not maquina:
            return None

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(maquina, field, value)

        self.db.commit()
        self.db.refresh(maquina)

        return maquina

    def cambiar_estado_maquina(
        self,
        maquina_id: UUID,
        estado: str,
        usuario_id: UUID,
    ) -> Optional[Maquina]:
        """Cambia el estado de una máquina."""
        maquina = self.get_maquina(maquina_id)
        if not maquina:
            return None

        maquina.estado = estado
        self.db.commit()
        self.db.refresh(maquina)

        return maquina

    def is_maquina_disponible(self, maquina_id: UUID) -> bool:
        """Verifica si una máquina está disponible para asignación."""
        maquina = self.get_maquina(maquina_id)
        if not maquina:
            return False
        return maquina.estado == "disponible" and maquina.activo

    def get_maquinas_disponibles(self, tipo: Optional[str] = None) -> List[Maquina]:
        """Obtiene máquinas disponibles para asignar."""
        query = self.db.query(Maquina).filter(
            Maquina.activo == True,
            Maquina.estado == "disponible",
        )

        if tipo:
            query = query.filter(Maquina.tipo == tipo)

        return query.order_by(Maquina.codigo).all()

    def get_lote_usando_maquina(self, maquina_id: UUID) -> Optional[dict]:
        """Obtiene el lote que está usando una máquina."""
        lote_etapa = (
            self.db.query(LoteEtapa)
            .join(LoteProduccion, LoteEtapa.lote_id == LoteProduccion.id)
            .filter(
                LoteEtapa.maquina_id == maquina_id,
                LoteEtapa.estado == "en_proceso",
            )
            .first()
        )

        if not lote_etapa:
            return None

        lote = self.get_lote(lote_etapa.lote_id)
        if not lote:
            return None

        return {
            "lote_id": str(lote.id),
            "lote_numero": lote.numero,
            "etapa_id": str(lote_etapa.etapa_id),
            "fecha_inicio": lote_etapa.fecha_inicio.isoformat() if lote_etapa.fecha_inicio else None,
        }

    # ==================== LOTES ====================

    def get_lotes(
        self,
        skip: int = 0,
        limit: int = 50,
        estado: Optional[EstadoLote] = None,
        etapa_id: Optional[UUID] = None,
        cliente_id: Optional[UUID] = None,
        prioridad: Optional[PrioridadLote] = None,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
        solo_atrasados: bool = False,
    ) -> Tuple[List[LoteProduccion], int]:
        """Obtiene lista de lotes con filtros."""
        query = self.db.query(LoteProduccion).options(
            joinedload(LoteProduccion.cliente),
            joinedload(LoteProduccion.etapa_actual),
            joinedload(LoteProduccion.creado_por),
        )

        query = query.filter(LoteProduccion.activo == True)

        if estado:
            query = query.filter(LoteProduccion.estado == estado.value)

        if etapa_id:
            query = query.filter(LoteProduccion.etapa_actual_id == etapa_id)

        if cliente_id:
            query = query.filter(LoteProduccion.cliente_id == cliente_id)

        if prioridad:
            query = query.filter(LoteProduccion.prioridad == prioridad.value)

        if fecha_desde:
            query = query.filter(func.date(LoteProduccion.fecha_ingreso) >= fecha_desde)

        if fecha_hasta:
            query = query.filter(func.date(LoteProduccion.fecha_ingreso) <= fecha_hasta)

        if solo_atrasados:
            query = query.filter(
                and_(
                    LoteProduccion.fecha_compromiso != None,
                    LoteProduccion.fecha_compromiso < datetime.utcnow(),
                    LoteProduccion.estado != EstadoLote.COMPLETADO.value,
                )
            )

        total = query.count()
        lotes = (
            query.order_by(
                LoteProduccion.prioridad.desc(),
                LoteProduccion.fecha_ingreso,
            )
            .offset(skip)
            .limit(limit)
            .all()
        )

        return lotes, total

    def get_lote(self, lote_id: UUID) -> Optional[LoteProduccion]:
        """Obtiene un lote por ID con todas sus relaciones."""
        return (
            self.db.query(LoteProduccion)
            .options(
                joinedload(LoteProduccion.cliente),
                joinedload(LoteProduccion.pedido),
                joinedload(LoteProduccion.etapa_actual),
                joinedload(LoteProduccion.creado_por),
                joinedload(LoteProduccion.etapas).joinedload(LoteEtapa.etapa),
                joinedload(LoteProduccion.etapas).joinedload(LoteEtapa.responsable),
                joinedload(LoteProduccion.etapas).joinedload(LoteEtapa.maquina),
            )
            .filter(LoteProduccion.id == lote_id)
            .first()
        )

    def get_lote_by_numero(self, numero: str) -> Optional[LoteProduccion]:
        """Obtiene un lote por número."""
        return self.db.query(LoteProduccion).filter(LoteProduccion.numero == numero).first()

    def create_lote(self, data: LoteProduccionCreate, usuario_id: UUID) -> LoteProduccion:
        """Crea un nuevo lote de producción."""
        # Generar número de lote
        numero = self._generar_numero_lote()

        # Obtener etapa inicial
        etapa_inicial = (
            self.db.query(EtapaProduccion)
            .filter(EtapaProduccion.es_inicial == True, EtapaProduccion.activo == True)
            .first()
        )

        lote = LoteProduccion(
            numero=numero,
            cliente_id=data.cliente_id,
            pedido_id=data.pedido_id,
            tipo_servicio=data.tipo_servicio.value,
            estado=EstadoLote.PENDIENTE.value,
            prioridad=data.prioridad.value,
            etapa_actual_id=etapa_inicial.id if etapa_inicial else None,
            peso_entrada_kg=data.peso_entrada_kg,
            cantidad_prendas=data.cantidad_prendas,
            fecha_compromiso=data.fecha_compromiso,
            creado_por_id=usuario_id,
            descripcion=data.descripcion,
            notas_internas=data.notas_internas,
            notas_cliente=data.notas_cliente,
            tiene_manchas=data.tiene_manchas,
            tiene_roturas=data.tiene_roturas,
        )

        self.db.add(lote)
        self.db.flush()

        # Crear registros de etapas
        etapas = self.get_etapas(solo_activas=True)
        for i, etapa in enumerate(etapas):
            lote_etapa = LoteEtapa(
                lote_id=lote.id,
                etapa_id=etapa.id,
                orden=i,
                estado="pendiente",
            )
            self.db.add(lote_etapa)

        self.db.commit()
        self.db.refresh(lote)

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="crear",
            entidad="LoteProduccion",
            entidad_id=lote.id,
            datos_nuevos={"numero": numero},
        )

        return lote

    def update_lote(
        self,
        lote_id: UUID,
        data: LoteProduccionUpdate,
        usuario_id: UUID,
    ) -> Optional[LoteProduccion]:
        """Actualiza un lote."""
        lote = self.get_lote(lote_id)
        if not lote:
            return None

        for field, value in data.model_dump(exclude_unset=True).items():
            if hasattr(value, 'value'):  # Es un Enum
                setattr(lote, field, value.value)
            else:
                setattr(lote, field, value)

        self.db.commit()
        self.db.refresh(lote)

        return lote

    def cambiar_estado_lote(
        self,
        lote_id: UUID,
        estado: EstadoLote,
        usuario_id: UUID,
        observaciones: Optional[str] = None,
    ) -> Optional[LoteProduccion]:
        """Cambia el estado de un lote."""
        lote = self.get_lote(lote_id)
        if not lote:
            return None

        estado_anterior = lote.estado
        lote.estado = estado.value

        if estado == EstadoLote.EN_PROCESO and not lote.fecha_inicio_proceso:
            lote.fecha_inicio_proceso = datetime.utcnow()

        if estado == EstadoLote.COMPLETADO:
            lote.fecha_fin_proceso = datetime.utcnow()

        if observaciones:
            lote.notas_internas = (lote.notas_internas or "") + f"\n[{datetime.utcnow()}] {observaciones}"

        self.db.commit()
        self.db.refresh(lote)

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="cambiar_estado",
            entidad="LoteProduccion",
            entidad_id=lote.id,
            datos_anteriores={"estado": estado_anterior},
            datos_nuevos={"estado": estado.value},
        )

        return lote

    # ==================== ETAPAS DE LOTE ====================

    def iniciar_etapa(
        self,
        lote_id: UUID,
        etapa_id: UUID,
        data: IniciarEtapaRequest,
        usuario_id: UUID,
    ) -> Optional[LoteEtapa]:
        """Inicia una etapa para un lote."""
        lote_etapa = (
            self.db.query(LoteEtapa)
            .filter(LoteEtapa.lote_id == lote_id, LoteEtapa.etapa_id == etapa_id)
            .first()
        )

        if not lote_etapa:
            return None

        # Verificar si la máquina está disponible
        if data.maquina_id:
            if not self.is_maquina_disponible(data.maquina_id):
                lote_en_uso = self.get_lote_usando_maquina(data.maquina_id)
                if lote_en_uso:
                    raise ValueError(
                        f"La máquina está siendo usada por el lote {lote_en_uso['lote_numero']}"
                    )
                raise ValueError("La máquina no está disponible")

        lote_etapa.estado = "en_proceso"
        lote_etapa.fecha_inicio = datetime.utcnow()
        lote_etapa.responsable_id = data.responsable_id or usuario_id
        lote_etapa.maquina_id = data.maquina_id
        lote_etapa.observaciones = data.observaciones

        # Actualizar máquina a "en_uso"
        if data.maquina_id:
            maquina = self.get_maquina(data.maquina_id)
            if maquina:
                maquina.estado = "en_uso"

        # Actualizar etapa actual del lote
        lote = self.get_lote(lote_id)
        if lote:
            lote.etapa_actual_id = etapa_id
            if lote.estado == EstadoLote.PENDIENTE.value:
                lote.estado = EstadoLote.EN_PROCESO.value
                lote.fecha_inicio_proceso = datetime.utcnow()

        self.db.commit()
        self.db.refresh(lote_etapa)

        return lote_etapa

    def finalizar_etapa(
        self,
        lote_id: UUID,
        etapa_id: UUID,
        data: FinalizarEtapaRequest,
        usuario_id: UUID,
    ) -> Optional[LoteEtapa]:
        """Finaliza una etapa para un lote."""
        lote_etapa = (
            self.db.query(LoteEtapa)
            .filter(LoteEtapa.lote_id == lote_id, LoteEtapa.etapa_id == etapa_id)
            .first()
        )

        if not lote_etapa:
            return None

        lote_etapa.estado = "completado"
        lote_etapa.fecha_fin = datetime.utcnow()
        lote_etapa.peso_kg = data.peso_kg

        if data.observaciones:
            lote_etapa.observaciones = (lote_etapa.observaciones or "") + f"\n{data.observaciones}"

        # Liberar máquina
        if lote_etapa.maquina_id:
            maquina = self.get_maquina(lote_etapa.maquina_id)
            if maquina:
                maquina.estado = "disponible"
                # Actualizar horas de uso
                if lote_etapa.fecha_inicio:
                    horas = (lote_etapa.fecha_fin - lote_etapa.fecha_inicio).total_seconds() / 3600
                    maquina.horas_uso_totales += int(horas)

        # Verificar si hay siguiente etapa
        lote = self.get_lote(lote_id)
        if lote:
            siguiente_etapa = self._get_siguiente_etapa(lote, etapa_id)
            if siguiente_etapa:
                lote.etapa_actual_id = siguiente_etapa.id
            else:
                # Es la última etapa, completar el lote
                lote.estado = EstadoLote.COMPLETADO.value
                lote.fecha_fin_proceso = datetime.utcnow()
                lote.peso_salida_kg = data.peso_kg

        self.db.commit()
        self.db.refresh(lote_etapa)

        return lote_etapa

    def mover_lote_a_etapa(
        self,
        lote_id: UUID,
        data: MoverLoteRequest,
        usuario_id: UUID,
    ) -> Optional[LoteProduccion]:
        """Mueve un lote directamente a otra etapa."""
        lote = self.get_lote(lote_id)
        if not lote:
            return None

        # Finalizar etapa actual si está en proceso
        etapa_actual = None
        for le in lote.etapas:
            if le.estado == "en_proceso":
                le.estado = "completado"
                le.fecha_fin = datetime.utcnow()
                etapa_actual = le
                break

        # Iniciar nueva etapa
        for le in lote.etapas:
            if le.etapa_id == data.etapa_destino_id:
                le.estado = "en_proceso"
                le.fecha_inicio = datetime.utcnow()
                le.responsable_id = data.responsable_id or usuario_id
                break

        lote.etapa_actual_id = data.etapa_destino_id

        if data.observaciones:
            lote.notas_internas = (lote.notas_internas or "") + f"\n[Movido] {data.observaciones}"

        self.db.commit()
        self.db.refresh(lote)

        return lote

    # ==================== CONSUMO DE INSUMOS ====================

    def registrar_consumo_insumo(
        self,
        lote_id: UUID,
        data: ConsumoInsumoLoteCreate,
        usuario_id: UUID,
    ) -> ConsumoInsumoLote:
        """Registra consumo de insumo en un lote."""
        # Obtener insumo para precio
        insumo = self.db.query(Insumo).filter(Insumo.id == data.insumo_id).first()
        if not insumo:
            raise ValueError("Insumo no encontrado")

        costo_unitario = insumo.precio_promedio_ponderado or insumo.precio_unitario_costo or Decimal("0")
        costo_total = data.cantidad * costo_unitario

        consumo = ConsumoInsumoLote(
            lote_id=lote_id,
            insumo_id=data.insumo_id,
            etapa_id=data.etapa_id,
            cantidad=data.cantidad,
            unidad=data.unidad,
            costo_unitario=costo_unitario,
            costo_total=costo_total,
            registrado_por_id=usuario_id,
            notas=data.notas,
        )

        self.db.add(consumo)

        # Descontar del stock
        stock_service = StockService(self.db)
        lote = self.get_lote(lote_id)

        stock_service.registrar_salida(
            insumo_id=data.insumo_id,
            cantidad=data.cantidad,
            usuario_id=usuario_id,
            origen=OrigenMovimiento.PRODUCCION,
            documento_tipo="lote_produccion",
            documento_id=lote_id,
            numero_documento=lote.numero if lote else None,
            notas=f"Consumo en producción - Lote {lote.numero if lote else 'N/A'}",
        )

        self.db.commit()
        self.db.refresh(consumo)

        return consumo

    def get_consumos_lote(self, lote_id: UUID) -> List[ConsumoInsumoLote]:
        """Obtiene los consumos de un lote."""
        return (
            self.db.query(ConsumoInsumoLote)
            .options(
                joinedload(ConsumoInsumoLote.insumo),
                joinedload(ConsumoInsumoLote.registrado_por),
            )
            .filter(ConsumoInsumoLote.lote_id == lote_id)
            .order_by(ConsumoInsumoLote.created_at)
            .all()
        )

    # ==================== KANBAN ====================

    def get_kanban_board(self) -> KanbanBoard:
        """Obtiene el tablero Kanban completo."""
        etapas = self.get_etapas(solo_activas=True)

        columnas = []
        total_lotes = 0
        lotes_atrasados = 0

        for etapa in etapas:
            # Obtener lotes en esta etapa
            lotes_en_etapa = (
                self.db.query(LoteProduccion)
                .options(joinedload(LoteProduccion.cliente))
                .filter(
                    LoteProduccion.etapa_actual_id == etapa.id,
                    LoteProduccion.activo == True,
                    LoteProduccion.estado.in_([
                        EstadoLote.PENDIENTE.value,
                        EstadoLote.EN_PROCESO.value,
                        EstadoLote.PAUSADO.value,
                    ]),
                )
                .order_by(
                    LoteProduccion.prioridad.desc(),
                    LoteProduccion.fecha_ingreso,
                )
                .all()
            )

            kanban_lotes = []
            for lote in lotes_en_etapa:
                # Calcular tiempo en etapa
                lote_etapa = (
                    self.db.query(LoteEtapa)
                    .filter(
                        LoteEtapa.lote_id == lote.id,
                        LoteEtapa.etapa_id == etapa.id,
                    )
                    .first()
                )

                tiempo_en_etapa = 0
                if lote_etapa and lote_etapa.fecha_inicio:
                    delta = datetime.utcnow() - lote_etapa.fecha_inicio
                    tiempo_en_etapa = int(delta.total_seconds() / 60)

                kanban_lotes.append(KanbanLote(
                    id=lote.id,
                    numero=lote.numero,
                    cliente_nombre=lote.cliente.razon_social if lote.cliente else None,
                    tipo_servicio=lote.tipo_servicio,
                    prioridad=lote.prioridad,
                    peso_entrada_kg=lote.peso_entrada_kg,
                    cantidad_prendas=lote.cantidad_prendas,
                    fecha_compromiso=lote.fecha_compromiso,
                    esta_atrasado=lote.esta_atrasado,
                    tiempo_en_etapa_minutos=tiempo_en_etapa,
                ))

                total_lotes += 1
                if lote.esta_atrasado:
                    lotes_atrasados += 1

            columnas.append(KanbanColumna(
                etapa_id=etapa.id,
                etapa_codigo=etapa.codigo,
                etapa_nombre=etapa.nombre,
                etapa_color=etapa.color,
                orden=etapa.orden,
                tiempo_estimado_minutos=etapa.tiempo_estimado_minutos,
                lotes=kanban_lotes,
            ))

        return KanbanBoard(
            columnas=columnas,
            total_lotes=total_lotes,
            lotes_atrasados=lotes_atrasados,
        )

    # ==================== HELPERS ====================

    def _generar_numero_lote(self) -> str:
        """Genera el número del siguiente lote."""
        today = date.today()
        prefijo = f"L{today.strftime('%y%m%d')}-"

        ultimo = (
            self.db.query(LoteProduccion)
            .filter(LoteProduccion.numero.like(f"{prefijo}%"))
            .order_by(LoteProduccion.numero.desc())
            .first()
        )

        if ultimo:
            ultimo_num = int(ultimo.numero.split("-")[-1])
            nuevo_num = ultimo_num + 1
        else:
            nuevo_num = 1

        return f"{prefijo}{nuevo_num:04d}"

    def _get_siguiente_etapa(
        self,
        lote: LoteProduccion,
        etapa_actual_id: UUID,
    ) -> Optional[EtapaProduccion]:
        """Obtiene la siguiente etapa en el flujo."""
        etapas_lote = sorted(lote.etapas, key=lambda x: x.orden)

        encontrado = False
        for le in etapas_lote:
            if encontrado and le.estado != "completado":
                return le.etapa
            if le.etapa_id == etapa_actual_id:
                encontrado = True

        return None

    # ==================== ÓRDENES DE PRODUCCIÓN ====================

    def get_ordenes_produccion(
        self,
        skip: int = 0,
        limit: int = 50,
        estado: Optional[str] = None,
        cliente_id: Optional[UUID] = None,
        search: Optional[str] = None,
        solo_activas: bool = True,
    ) -> Tuple[List[OrdenProduccion], int]:
        """Obtiene lista de órdenes de producción."""
        query = self.db.query(OrdenProduccion)

        if solo_activas:
            query = query.filter(OrdenProduccion.activo == True)

        if estado:
            query = query.filter(OrdenProduccion.estado == estado)

        if cliente_id:
            query = query.filter(OrdenProduccion.cliente_id == cliente_id)

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    OrdenProduccion.numero.ilike(search_term),
                    OrdenProduccion.descripcion.ilike(search_term),
                )
            )

        total = query.count()
        ordenes = (
            query.options(
                joinedload(OrdenProduccion.cliente),
                joinedload(OrdenProduccion.responsable),
            )
            .order_by(OrdenProduccion.fecha_emision.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return ordenes, total

    def get_orden_produccion(self, orden_id: UUID) -> Optional[OrdenProduccion]:
        """Obtiene una orden de producción por ID."""
        return (
            self.db.query(OrdenProduccion)
            .options(
                joinedload(OrdenProduccion.cliente),
                joinedload(OrdenProduccion.responsable),
                joinedload(OrdenProduccion.lotes),
            )
            .filter(OrdenProduccion.id == orden_id)
            .first()
        )

    def create_orden_produccion(
        self,
        data,  # OrdenProduccionCreate
        usuario_id: UUID,
    ) -> OrdenProduccion:
        """Crea una nueva orden de producción."""
        numero = self._generar_numero_orden_produccion()

        orden = OrdenProduccion(
            numero=numero,
            cliente_id=data.cliente_id,
            pedido_id=data.pedido_id,
            prioridad=data.prioridad,
            fecha_programada_inicio=data.fecha_programada_inicio,
            fecha_programada_fin=data.fecha_programada_fin,
            descripcion=data.descripcion,
            instrucciones_especiales=data.instrucciones_especiales,
            cantidad_prendas_estimada=data.cantidad_prendas_estimada,
            peso_estimado_kg=data.peso_estimado_kg,
            responsable_id=data.responsable_id,
            creado_por_id=usuario_id,
            notas_internas=data.notas_internas,
            notas_produccion=data.notas_produccion,
        )

        self.db.add(orden)
        self.db.flush()

        # Asociar lotes existentes si se proporcionaron
        if hasattr(data, 'lotes_ids') and data.lotes_ids:
            for lote_id in data.lotes_ids:
                lote = self.get_lote(lote_id)
                if lote:
                    lote.orden_produccion_id = orden.id

        self.db.commit()
        self.db.refresh(orden)

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="crear",
            entidad="OrdenProduccion",
            entidad_id=orden.id,
            datos_nuevos={"numero": numero},
        )

        return orden

    def update_orden_produccion(
        self,
        orden_id: UUID,
        data,  # OrdenProduccionUpdate
        usuario_id: UUID,
    ) -> Optional[OrdenProduccion]:
        """Actualiza una orden de producción."""
        orden = self.get_orden_produccion(orden_id)
        if not orden:
            return None

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(orden, field, value)

        self.db.commit()
        self.db.refresh(orden)

        return orden

    def cambiar_estado_orden_produccion(
        self,
        orden_id: UUID,
        nuevo_estado: EstadoOrdenProduccion,
        usuario_id: UUID,
    ) -> Optional[OrdenProduccion]:
        """Cambia el estado de una orden de producción."""
        orden = self.get_orden_produccion(orden_id)
        if not orden:
            return None

        estado_anterior = orden.estado
        orden.estado = nuevo_estado.value

        if nuevo_estado == EstadoOrdenProduccion.EN_PROCESO and not orden.fecha_inicio_real:
            orden.fecha_inicio_real = datetime.utcnow()
        elif nuevo_estado == EstadoOrdenProduccion.COMPLETADA:
            orden.fecha_fin_real = datetime.utcnow()

        self.db.commit()
        self.db.refresh(orden)

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="cambiar_estado",
            entidad="OrdenProduccion",
            entidad_id=orden.id,
            datos_anteriores={"estado": estado_anterior},
            datos_nuevos={"estado": nuevo_estado.value},
        )

        return orden

    def _generar_numero_orden_produccion(self) -> str:
        """Genera el número de la siguiente orden de producción (OP-YYYY-NNNNN)."""
        year = date.today().year
        prefijo = f"OP-{year}-"

        ultima = (
            self.db.query(OrdenProduccion)
            .filter(OrdenProduccion.numero.like(f"{prefijo}%"))
            .order_by(OrdenProduccion.numero.desc())
            .first()
        )

        if ultima:
            ultimo_num = int(ultima.numero.split("-")[-1])
            nuevo_num = ultimo_num + 1
        else:
            nuevo_num = 1

        return f"{prefijo}{nuevo_num:05d}"

    # ==================== ASIGNACIÓN DE EMPLEADOS ====================

    def get_asignaciones_orden(self, orden_id: UUID) -> List[AsignacionEmpleadoOP]:
        """Obtiene las asignaciones de empleados de una orden."""
        return (
            self.db.query(AsignacionEmpleadoOP)
            .options(
                joinedload(AsignacionEmpleadoOP.empleado),
                joinedload(AsignacionEmpleadoOP.etapa),
            )
            .filter(
                AsignacionEmpleadoOP.orden_id == orden_id,
                AsignacionEmpleadoOP.activo == True,
            )
            .order_by(AsignacionEmpleadoOP.fecha_asignacion)
            .all()
        )

    def crear_asignacion_empleado(
        self,
        data,  # AsignacionEmpleadoCreate
        usuario_id: UUID,
    ) -> AsignacionEmpleadoOP:
        """Crea una asignación de empleado a una orden."""
        asignacion = AsignacionEmpleadoOP(
            orden_id=data.orden_id,
            empleado_id=data.empleado_id,
            etapa_id=data.etapa_id,
            fecha_asignacion=data.fecha_asignacion,
            fecha_fin_asignacion=data.fecha_fin_asignacion,
            turno=data.turno,
            horas_estimadas=data.horas_estimadas,
            notas=data.notas,
        )

        self.db.add(asignacion)
        self.db.commit()
        self.db.refresh(asignacion)

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="crear",
            entidad="AsignacionEmpleadoOP",
            entidad_id=asignacion.id,
            datos_nuevos={"orden_id": str(data.orden_id), "empleado_id": str(data.empleado_id)},
        )

        return asignacion

    def actualizar_asignacion_empleado(
        self,
        asignacion_id: UUID,
        data,  # AsignacionEmpleadoUpdate
        usuario_id: UUID,
    ) -> Optional[AsignacionEmpleadoOP]:
        """Actualiza una asignación de empleado."""
        asignacion = (
            self.db.query(AsignacionEmpleadoOP)
            .filter(AsignacionEmpleadoOP.id == asignacion_id)
            .first()
        )

        if not asignacion:
            return None

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(asignacion, field, value)

        self.db.commit()
        self.db.refresh(asignacion)

        return asignacion

    def eliminar_asignacion_empleado(
        self,
        asignacion_id: UUID,
        usuario_id: UUID,
    ) -> bool:
        """Elimina (soft delete) una asignación."""
        asignacion = (
            self.db.query(AsignacionEmpleadoOP)
            .filter(AsignacionEmpleadoOP.id == asignacion_id)
            .first()
        )

        if not asignacion:
            return False

        asignacion.activo = False
        self.db.commit()

        return True

    # ==================== INCIDENCIAS ====================

    def get_incidencias(
        self,
        skip: int = 0,
        limit: int = 50,
        orden_id: Optional[UUID] = None,
        estado: Optional[str] = None,
        severidad: Optional[str] = None,
    ) -> Tuple[List[IncidenciaProduccion], int]:
        """Obtiene lista de incidencias."""
        query = self.db.query(IncidenciaProduccion)

        if orden_id:
            query = query.filter(IncidenciaProduccion.orden_id == orden_id)

        if estado:
            query = query.filter(IncidenciaProduccion.estado == estado)

        if severidad:
            query = query.filter(IncidenciaProduccion.severidad == severidad)

        total = query.count()
        incidencias = (
            query.options(
                joinedload(IncidenciaProduccion.orden),
                joinedload(IncidenciaProduccion.lote),
                joinedload(IncidenciaProduccion.reportado_por),
            )
            .order_by(IncidenciaProduccion.fecha_incidencia.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return incidencias, total

    def get_incidencia(self, incidencia_id: UUID) -> Optional[IncidenciaProduccion]:
        """Obtiene una incidencia por ID."""
        return (
            self.db.query(IncidenciaProduccion)
            .options(
                joinedload(IncidenciaProduccion.orden),
                joinedload(IncidenciaProduccion.lote),
                joinedload(IncidenciaProduccion.etapa),
                joinedload(IncidenciaProduccion.reportado_por),
                joinedload(IncidenciaProduccion.resuelto_por),
            )
            .filter(IncidenciaProduccion.id == incidencia_id)
            .first()
        )

    def crear_incidencia(
        self,
        data,  # IncidenciaCreate
        usuario_id: UUID,
    ) -> IncidenciaProduccion:
        """Crea una nueva incidencia."""
        fotos_str = None
        if hasattr(data, 'fotos') and data.fotos:
            fotos_str = ",".join(data.fotos)

        incidencia = IncidenciaProduccion(
            orden_id=data.orden_id,
            lote_id=data.lote_id,
            etapa_id=data.etapa_id,
            tipo=data.tipo,
            severidad=data.severidad,
            titulo=data.titulo,
            descripcion=data.descripcion,
            reportado_por_id=usuario_id,
            fotos=fotos_str,
        )

        self.db.add(incidencia)
        self.db.commit()
        self.db.refresh(incidencia)

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="crear",
            entidad="IncidenciaProduccion",
            entidad_id=incidencia.id,
            datos_nuevos={"titulo": data.titulo, "tipo": data.tipo, "severidad": data.severidad},
        )

        return incidencia

    def actualizar_incidencia(
        self,
        incidencia_id: UUID,
        data,  # IncidenciaUpdate
        usuario_id: UUID,
    ) -> Optional[IncidenciaProduccion]:
        """Actualiza una incidencia."""
        incidencia = self.get_incidencia(incidencia_id)
        if not incidencia:
            return None

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(incidencia, field, value)

        self.db.commit()
        self.db.refresh(incidencia)

        return incidencia

    def resolver_incidencia(
        self,
        incidencia_id: UUID,
        data,  # IncidenciaResolverRequest
        usuario_id: UUID,
    ) -> Optional[IncidenciaProduccion]:
        """Resuelve una incidencia."""
        incidencia = self.get_incidencia(incidencia_id)
        if not incidencia:
            return None

        incidencia.estado = "resuelta"
        incidencia.fecha_resolucion = datetime.utcnow()
        incidencia.resuelto_por_id = usuario_id
        incidencia.acciones_tomadas = data.acciones_tomadas
        incidencia.tiempo_perdido_minutos = data.tiempo_perdido_minutos
        incidencia.costo_estimado = data.costo_estimado

        self.db.commit()
        self.db.refresh(incidencia)

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="resolver",
            entidad="IncidenciaProduccion",
            entidad_id=incidencia.id,
            datos_nuevos={"acciones_tomadas": data.acciones_tomadas},
        )

        return incidencia

    def agregar_foto_incidencia(
        self,
        incidencia_id: UUID,
        ruta_foto: str,
        usuario_id: UUID,
    ) -> Optional[IncidenciaProduccion]:
        """Agrega una foto a una incidencia."""
        incidencia = self.get_incidencia(incidencia_id)
        if not incidencia:
            return None

        incidencia.agregar_foto(ruta_foto)
        self.db.commit()
        self.db.refresh(incidencia)

        return incidencia
