"""
Servicio de Empleados para DUWHITE ERP
"""

from datetime import date, time, datetime
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session

from app.models.empleado import (
    Empleado, Asistencia, JornadaLaboral, MovimientoNomina, Liquidacion,
    TipoEmpleado, TipoContrato, TipoContratacion, EstadoEmpleado, TipoAsistencia, TipoMovimientoNomina
)
from app.schemas.empleado import (
    EmpleadoCreate, EmpleadoUpdate,
    AsistenciaCreate,
    MovimientoNominaCreate, MovimientoNominaUpdate, PagarMovimientoRequest,
    LiquidacionCreate, JornadaJustificacion
)


class EmpleadoService:
    """Servicio para gestión de empleados"""

    def __init__(self, db: Session):
        self.db = db

    # ==================== EMPLEADOS ====================

    def _generate_codigo(self) -> str:
        """Genera código único para empleado"""
        result = self.db.execute(
            select(func.max(Empleado.codigo))
            .where(Empleado.codigo.like("EMP-%"))
        )
        last_code = result.scalar()

        if last_code:
            try:
                last_num = int(last_code.split("-")[1])
                return f"EMP-{str(last_num + 1).zfill(4)}"
            except (ValueError, IndexError):
                pass

        # Contar empleados para generar código
        count_result = self.db.execute(select(func.count(Empleado.id)))
        count = count_result.scalar() or 0
        return f"EMP-{str(count + 1).zfill(4)}"

    def get_empleados(
        self,
        skip: int = 0,
        limit: int = 50,
        tipo: Optional[str] = None,
        estado: Optional[str] = None,
        departamento: Optional[str] = None,
        search: Optional[str] = None,
        solo_activos: bool = True
    ) -> Tuple[List[Empleado], int]:
        """Lista empleados con filtros"""
        query = select(Empleado)

        if solo_activos:
            query = query.where(Empleado.activo == True)

        if tipo:
            query = query.where(Empleado.tipo == tipo)

        if estado:
            query = query.where(Empleado.estado == estado)

        if departamento:
            query = query.where(Empleado.departamento == departamento)

        if search:
            search_filter = or_(
                Empleado.nombre.ilike(f"%{search}%"),
                Empleado.apellido.ilike(f"%{search}%"),
                Empleado.dni.ilike(f"%{search}%"),
                Empleado.codigo.ilike(f"%{search}%")
            )
            query = query.where(search_filter)

        # Contar total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Aplicar paginación
        query = query.order_by(Empleado.apellido, Empleado.nombre)
        query = query.offset(skip).limit(limit)

        result = self.db.execute(query)
        empleados = result.scalars().all()

        return list(empleados), total

    def get_empleado(self, empleado_id: UUID) -> Optional[Empleado]:
        """Obtiene empleado por ID"""
        result = self.db.execute(
            select(Empleado).where(Empleado.id == empleado_id)
        )
        return result.scalar_one_or_none()

    def get_empleado_by_dni(self, dni: str) -> Optional[Empleado]:
        """Obtiene empleado por DNI"""
        result = self.db.execute(
            select(Empleado).where(Empleado.dni == dni)
        )
        return result.scalar_one_or_none()

    def create_empleado(self, data: EmpleadoCreate) -> Empleado:
        """Crea nuevo empleado"""
        codigo = data.codigo or self._generate_codigo()

        empleado = Empleado(
            codigo=codigo,
            nombre=data.nombre,
            apellido=data.apellido,
            dni=data.dni,
            cuil=data.cuil,
            fecha_nacimiento=data.fecha_nacimiento,
            email=data.email,
            telefono=data.telefono,
            telefono_emergencia=data.telefono_emergencia,
            contacto_emergencia=data.contacto_emergencia,
            direccion=data.direccion,
            barrio=data.barrio,
            localidad=data.localidad,
            ciudad=data.ciudad,
            codigo_postal=data.codigo_postal,
            tipo=data.tipo,
            tipo_contrato=data.tipo_contrato,
            estado=EstadoEmpleado.ACTIVO.value,
            puesto=data.puesto,
            departamento=data.departamento,
            fecha_ingreso=data.fecha_ingreso,
            horario_entrada=data.horario_entrada,
            horario_salida=data.horario_salida,
            dias_trabajo=data.dias_trabajo,
            salario_base=data.salario_base,
            salario_hora=data.salario_hora,
            tipo_contratacion=data.tipo_contratacion,
            dia_pago=data.dia_pago,
            jornada_horas=data.jornada_horas,
            adelanto_maximo_porcentaje=data.adelanto_maximo_porcentaje,
            banco=data.banco,
            tipo_cuenta_banco=data.tipo_cuenta_banco,
            numero_cuenta_banco=data.numero_cuenta_banco,
            cbu=data.cbu,
            alias_cbu=data.alias_cbu,
            obra_social=data.obra_social,
            numero_afiliado_os=data.numero_afiliado_os,
            art=data.art,
            user_id=data.user_id,
            notas=data.notas
        )

        self.db.add(empleado)
        self.db.commit()
        self.db.refresh(empleado)
        return empleado

    def update_empleado(self, empleado_id: UUID, data: EmpleadoUpdate) -> Optional[Empleado]:
        """Actualiza empleado"""
        empleado = self.get_empleado(empleado_id)
        if not empleado:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(empleado, field, value)

        self.db.commit()
        self.db.refresh(empleado)
        return empleado

    def delete_empleado(self, empleado_id: UUID) -> bool:
        """Elimina empleado (soft delete)"""
        empleado = self.get_empleado(empleado_id)
        if not empleado:
            return False

        empleado.activo = False
        empleado.estado = EstadoEmpleado.DESVINCULADO.value
        empleado.fecha_egreso = date.today()

        self.db.commit()
        return True

    # ==================== ASISTENCIA ====================

    def registrar_asistencia(
        self,
        data: AsistenciaCreate,
        registrado_por_id: UUID,
        es_manual: bool = False
    ) -> Asistencia:
        """Registra asistencia de empleado"""
        now = datetime.now()

        asistencia = Asistencia(
            empleado_id=data.empleado_id,
            fecha=data.fecha or now.date(),
            tipo=data.tipo,
            hora=data.hora or now.time(),
            latitud=data.latitud,
            longitud=data.longitud,
            es_manual=es_manual,
            registrado_por_id=registrado_por_id if es_manual else None,
            observaciones=data.observaciones
        )

        self.db.add(asistencia)
        self.db.commit()
        self.db.refresh(asistencia)

        # Actualizar jornada laboral si corresponde
        self._actualizar_jornada(data.empleado_id, asistencia.fecha)

        return asistencia

    def get_asistencias(
        self,
        empleado_id: Optional[UUID] = None,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[Asistencia], int]:
        """Lista registros de asistencia"""
        query = select(Asistencia).where(Asistencia.activo == True)

        if empleado_id:
            query = query.where(Asistencia.empleado_id == empleado_id)

        if fecha_desde:
            query = query.where(Asistencia.fecha >= fecha_desde)

        if fecha_hasta:
            query = query.where(Asistencia.fecha <= fecha_hasta)

        # Contar
        count_query = select(func.count()).select_from(query.subquery())
        total_result = self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginar
        query = query.order_by(Asistencia.fecha.desc(), Asistencia.hora.desc())
        query = query.offset(skip).limit(limit)

        result = self.db.execute(query)
        asistencias = result.scalars().all()

        return list(asistencias), total

    def _actualizar_jornada(self, empleado_id: UUID, fecha: date):
        """Actualiza o crea jornada laboral basada en asistencias"""
        # Obtener todas las asistencias del día
        result = self.db.execute(
            select(Asistencia)
            .where(and_(
                Asistencia.empleado_id == empleado_id,
                Asistencia.fecha == fecha,
                Asistencia.activo == True
            ))
            .order_by(Asistencia.hora)
        )
        asistencias = result.scalars().all()

        if not asistencias:
            return

        # Buscar o crear jornada
        jornada_result = self.db.execute(
            select(JornadaLaboral)
            .where(and_(
                JornadaLaboral.empleado_id == empleado_id,
                JornadaLaboral.fecha == fecha
            ))
        )
        jornada = jornada_result.scalar_one_or_none()

        if not jornada:
            jornada = JornadaLaboral(
                empleado_id=empleado_id,
                fecha=fecha
            )
            self.db.add(jornada)

        # Procesar asistencias
        hora_entrada = None
        hora_salida = None
        inicio_break = None
        minutos_break = 0

        for asist in asistencias:
            if asist.tipo == TipoAsistencia.ENTRADA.value and not hora_entrada:
                hora_entrada = asist.hora
            elif asist.tipo == TipoAsistencia.SALIDA.value:
                hora_salida = asist.hora
            elif asist.tipo == TipoAsistencia.INICIO_BREAK.value:
                inicio_break = asist.hora
            elif asist.tipo == TipoAsistencia.FIN_BREAK.value and inicio_break:
                # Calcular minutos de break
                inicio_dt = datetime.combine(fecha, inicio_break)
                fin_dt = datetime.combine(fecha, asist.hora)
                minutos_break += int((fin_dt - inicio_dt).total_seconds() / 60)
                inicio_break = None

        jornada.hora_entrada = hora_entrada
        jornada.hora_salida = hora_salida
        jornada.minutos_break = minutos_break

        # Obtener empleado para jornada configurada
        empleado = self.get_empleado(empleado_id)

        # Calcular horas trabajadas
        if hora_entrada and hora_salida:
            entrada_dt = datetime.combine(fecha, hora_entrada)
            salida_dt = datetime.combine(fecha, hora_salida)
            total_minutos = (salida_dt - entrada_dt).total_seconds() / 60
            total_minutos -= minutos_break
            jornada.horas_trabajadas = Decimal(str(round(total_minutos / 60, 2)))

            # Verificar horas extra (más de la jornada configurada del empleado)
            jornada_normal = empleado.jornada_horas if empleado and empleado.jornada_horas else Decimal("8")
            if jornada.horas_trabajadas > jornada_normal:
                jornada.horas_extra = jornada.horas_trabajadas - jornada_normal
            else:
                jornada.horas_extra = Decimal("0")

        # Verificar tardanza
        if empleado and empleado.horario_entrada and hora_entrada:
            if hora_entrada > empleado.horario_entrada:
                jornada.llegada_tarde = True

        self.db.commit()

    # ==================== JORNADAS ====================

    def get_jornadas(
        self,
        empleado_id: Optional[UUID] = None,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[JornadaLaboral], int]:
        """Lista jornadas laborales"""
        query = select(JornadaLaboral)

        if empleado_id:
            query = query.where(JornadaLaboral.empleado_id == empleado_id)

        if fecha_desde:
            query = query.where(JornadaLaboral.fecha >= fecha_desde)

        if fecha_hasta:
            query = query.where(JornadaLaboral.fecha <= fecha_hasta)

        # Contar
        count_query = select(func.count()).select_from(query.subquery())
        total_result = self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginar
        query = query.order_by(JornadaLaboral.fecha.desc())
        query = query.offset(skip).limit(limit)

        result = self.db.execute(query)
        jornadas = result.scalars().all()

        return list(jornadas), total

    def justificar_jornada(
        self,
        jornada_id: UUID,
        data: JornadaJustificacion
    ) -> Optional[JornadaLaboral]:
        """Justifica ausencia o tardanza"""
        result = self.db.execute(
            select(JornadaLaboral).where(JornadaLaboral.id == jornada_id)
        )
        jornada = result.scalar_one_or_none()

        if not jornada:
            return None

        jornada.justificado = data.justificado
        jornada.motivo_justificacion = data.motivo_justificacion

        self.db.commit()
        self.db.refresh(jornada)
        return jornada

    # ==================== MOVIMIENTOS NOMINA ====================

    def create_movimiento_nomina(
        self,
        data: MovimientoNominaCreate,
        registrado_por_id: UUID
    ) -> MovimientoNomina:
        """Crea movimiento de nómina"""
        # Si es adelanto, validar que no supere el máximo permitido
        if data.tipo == TipoMovimientoNomina.ADELANTO.value:
            empleado = self.get_empleado(data.empleado_id)
            if not empleado:
                raise ValueError("Empleado no encontrado")

            # Calcular adelantos ya registrados en el período
            adelantos_existentes = self.db.execute(
                select(func.sum(MovimientoNomina.monto))
                .where(and_(
                    MovimientoNomina.empleado_id == data.empleado_id,
                    MovimientoNomina.periodo_mes == data.periodo_mes,
                    MovimientoNomina.periodo_anio == data.periodo_anio,
                    MovimientoNomina.tipo == TipoMovimientoNomina.ADELANTO.value,
                    MovimientoNomina.activo == True
                ))
            )
            total_adelantos = adelantos_existentes.scalar() or Decimal("0")

            # Calcular máximo permitido
            porcentaje_maximo = empleado.adelanto_maximo_porcentaje or 50
            monto_maximo = empleado.salario_base * Decimal(str(porcentaje_maximo)) / Decimal("100")

            # Verificar si el nuevo adelanto supera el límite
            if total_adelantos + data.monto > monto_maximo:
                disponible = monto_maximo - total_adelantos
                raise ValueError(
                    f"El adelanto supera el máximo permitido. "
                    f"Máximo: ${monto_maximo:.2f} ({porcentaje_maximo}% del salario). "
                    f"Ya adelantado: ${total_adelantos:.2f}. "
                    f"Disponible: ${disponible:.2f}"
                )

        movimiento = MovimientoNomina(
            empleado_id=data.empleado_id,
            tipo=data.tipo,
            concepto=data.concepto,
            descripcion=data.descripcion,
            periodo_mes=data.periodo_mes,
            periodo_anio=data.periodo_anio,
            monto=data.monto,
            es_debito=data.es_debito,
            registrado_por_id=registrado_por_id
        )

        self.db.add(movimiento)
        self.db.commit()
        self.db.refresh(movimiento)
        return movimiento

    def get_movimientos_nomina(
        self,
        empleado_id: Optional[UUID] = None,
        periodo_mes: Optional[int] = None,
        periodo_anio: Optional[int] = None,
        tipo: Optional[str] = None,
        pagado: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[MovimientoNomina], int]:
        """Lista movimientos de nómina"""
        query = select(MovimientoNomina).where(MovimientoNomina.activo == True)

        if empleado_id:
            query = query.where(MovimientoNomina.empleado_id == empleado_id)

        if periodo_mes:
            query = query.where(MovimientoNomina.periodo_mes == periodo_mes)

        if periodo_anio:
            query = query.where(MovimientoNomina.periodo_anio == periodo_anio)

        if tipo:
            query = query.where(MovimientoNomina.tipo == tipo)

        if pagado is not None:
            query = query.where(MovimientoNomina.pagado == pagado)

        # Contar
        count_query = select(func.count()).select_from(query.subquery())
        total_result = self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Ordenar por fecha del movimiento (más reciente primero), luego por created_at
        query = query.order_by(MovimientoNomina.fecha.desc(), MovimientoNomina.created_at.desc())
        query = query.offset(skip).limit(limit)

        result = self.db.execute(query)
        movimientos = result.scalars().all()

        return list(movimientos), total

    def pagar_movimiento(
        self,
        movimiento_id: UUID,
        data: PagarMovimientoRequest
    ) -> Optional[MovimientoNomina]:
        """Marca movimiento como pagado"""
        result = self.db.execute(
            select(MovimientoNomina).where(MovimientoNomina.id == movimiento_id)
        )
        movimiento = result.scalar_one_or_none()

        if not movimiento:
            return None

        movimiento.pagado = True
        movimiento.fecha_pago = data.fecha_pago
        movimiento.medio_pago = data.medio_pago
        movimiento.comprobante = data.comprobante

        self.db.commit()
        self.db.refresh(movimiento)
        return movimiento

    def get_movimiento_nomina(self, movimiento_id: UUID) -> Optional[MovimientoNomina]:
        """Obtiene un movimiento de nómina por ID"""
        result = self.db.execute(
            select(MovimientoNomina).where(
                and_(
                    MovimientoNomina.id == movimiento_id,
                    MovimientoNomina.activo == True
                )
            )
        )
        return result.scalar_one_or_none()

    def update_movimiento_nomina(
        self,
        movimiento_id: UUID,
        monto: Optional[Decimal] = None,
        cantidad_horas: Optional[Decimal] = None,
        concepto: Optional[str] = None,
        descripcion: Optional[str] = None,
        fecha: Optional[date] = None
    ) -> Optional[MovimientoNomina]:
        """Actualiza un movimiento de nómina (adelanto o hora extra)"""
        movimiento = self.get_movimiento_nomina(movimiento_id)
        if not movimiento:
            return None

        # No permitir editar si ya está pagado
        if movimiento.pagado:
            raise ValueError("No se puede editar un movimiento ya pagado")

        if concepto is not None:
            movimiento.concepto = concepto
        if descripcion is not None:
            movimiento.descripcion = descripcion

        # Si se cambia la fecha, actualizar fecha, semana, periodo_mes y periodo_anio
        if fecha is not None:
            movimiento.fecha = fecha
            # Calcular la semana del mes (día 1-7 = semana 1, 8-14 = semana 2, etc.)
            movimiento.semana = (fecha.day - 1) // 7 + 1
            movimiento.periodo_mes = fecha.month
            movimiento.periodo_anio = fecha.year

        # Para adelantos, actualizar el monto directamente
        if movimiento.tipo == TipoMovimientoNomina.ADELANTO.value:
            if monto is not None:
                movimiento.monto = monto

        # Para horas extras, actualizar cantidad y recalcular monto
        elif movimiento.tipo == TipoMovimientoNomina.HORA_EXTRA.value:
            if cantidad_horas is not None:
                movimiento.cantidad_horas = cantidad_horas
                # Recalcular monto basado en valor_hora
                if movimiento.valor_hora:
                    movimiento.monto = cantidad_horas * movimiento.valor_hora

        movimiento.updated_at = func.now()
        self.db.commit()
        self.db.refresh(movimiento)
        return movimiento

    def delete_movimiento_nomina(self, movimiento_id: UUID) -> bool:
        """Elimina un movimiento de nómina (soft delete)"""
        movimiento = self.get_movimiento_nomina(movimiento_id)
        if not movimiento:
            return False

        # No permitir eliminar si ya está pagado
        if movimiento.pagado:
            raise ValueError("No se puede eliminar un movimiento ya pagado")

        movimiento.activo = False
        movimiento.updated_at = func.now()
        self.db.commit()
        return True

    # ==================== LIQUIDACIONES ====================

    def _get_next_numero_liquidacion(self) -> int:
        """Obtiene siguiente número de liquidación"""
        result = self.db.execute(
            select(func.max(Liquidacion.numero))
        )
        last_num = result.scalar()
        return (last_num or 0) + 1

    def create_liquidacion(
        self,
        data: LiquidacionCreate,
        generada_por_id: UUID
    ) -> Liquidacion:
        """Genera liquidación de sueldo"""
        # Obtener empleado
        empleado = self.get_empleado(data.empleado_id)
        if not empleado:
            raise ValueError("Empleado no encontrado")

        # Calcular horas extra del período
        jornadas_result = self.db.execute(
            select(JornadaLaboral)
            .where(and_(
                JornadaLaboral.empleado_id == data.empleado_id,
                func.extract('month', JornadaLaboral.fecha) == data.periodo_mes,
                func.extract('year', JornadaLaboral.fecha) == data.periodo_anio
            ))
        )
        jornadas = jornadas_result.scalars().all()

        horas_extra_total = sum(
            j.horas_extra or Decimal("0")
            for j in jornadas
        )
        valor_hora_extra = (empleado.salario_hora or (empleado.salario_base / 200)) * Decimal("1.5")
        monto_horas_extra = horas_extra_total * valor_hora_extra

        # Calcular adelantos del período
        adelantos_result = self.db.execute(
            select(func.sum(MovimientoNomina.monto))
            .where(and_(
                MovimientoNomina.empleado_id == data.empleado_id,
                MovimientoNomina.periodo_mes == data.periodo_mes,
                MovimientoNomina.periodo_anio == data.periodo_anio,
                MovimientoNomina.tipo == TipoMovimientoNomina.ADELANTO.value,
                MovimientoNomina.activo == True
            ))
        )
        adelantos = adelantos_result.scalar() or Decimal("0")

        # Calcular haberes
        total_haberes = (
            empleado.salario_base +
            monto_horas_extra +
            data.bonificaciones +
            data.otros_haberes
        )

        # Calcular deducciones legales según tipo de contratación
        # Solo empleados "en blanco" tienen aportes legales
        jubilacion = Decimal("0")
        obra_social_deduccion = Decimal("0")

        if empleado.tipo_contratacion == TipoContratacion.BLANCO.value:
            # Empleado registrado - deducciones legales Argentina
            jubilacion = total_haberes * Decimal("0.11")  # 11%
            obra_social_deduccion = total_haberes * Decimal("0.03")  # 3%
        # Para "negro" y "monotributo" no se aplican deducciones automáticas

        total_deducciones = (
            jubilacion +
            obra_social_deduccion +
            adelantos +
            data.otras_deducciones
        )

        neto = total_haberes - total_deducciones

        numero = self._get_next_numero_liquidacion()

        liquidacion = Liquidacion(
            numero=numero,
            empleado_id=data.empleado_id,
            periodo_mes=data.periodo_mes,
            periodo_anio=data.periodo_anio,
            fecha_liquidacion=data.fecha_liquidacion,
            salario_base=empleado.salario_base,
            horas_extra_cantidad=horas_extra_total,
            horas_extra_monto=monto_horas_extra,
            bonificaciones=data.bonificaciones,
            otros_haberes=data.otros_haberes,
            total_haberes=total_haberes,
            jubilacion=jubilacion,
            obra_social=obra_social_deduccion,
            adelantos=adelantos,
            otras_deducciones=data.otras_deducciones,
            total_deducciones=total_deducciones,
            neto_a_pagar=neto,
            observaciones=data.observaciones,
            generada_por_id=generada_por_id
        )

        self.db.add(liquidacion)
        self.db.commit()
        self.db.refresh(liquidacion)
        return liquidacion

    def get_liquidaciones(
        self,
        empleado_id: Optional[UUID] = None,
        periodo_mes: Optional[int] = None,
        periodo_anio: Optional[int] = None,
        pagada: Optional[bool] = None,
        skip: int = 0,
        limit: int = 50
    ) -> Tuple[List[Liquidacion], int]:
        """Lista liquidaciones"""
        query = select(Liquidacion).where(Liquidacion.activo == True)

        if empleado_id:
            query = query.where(Liquidacion.empleado_id == empleado_id)

        if periodo_mes:
            query = query.where(Liquidacion.periodo_mes == periodo_mes)

        if periodo_anio:
            query = query.where(Liquidacion.periodo_anio == periodo_anio)

        if pagada is not None:
            query = query.where(Liquidacion.pagada == pagada)

        # Contar
        count_query = select(func.count()).select_from(query.subquery())
        total_result = self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginar
        query = query.order_by(Liquidacion.numero.desc())
        query = query.offset(skip).limit(limit)

        result = self.db.execute(query)
        liquidaciones = result.scalars().all()

        return list(liquidaciones), total

    def pagar_liquidacion(
        self,
        liquidacion_id: UUID,
        fecha_pago: date
    ) -> Optional[Liquidacion]:
        """Marca liquidación como pagada"""
        result = self.db.execute(
            select(Liquidacion).where(Liquidacion.id == liquidacion_id)
        )
        liquidacion = result.scalar_one_or_none()

        if not liquidacion:
            return None

        liquidacion.pagada = True
        liquidacion.fecha_pago = fecha_pago

        self.db.commit()
        self.db.refresh(liquidacion)
        return liquidacion

    # ==================== JORNALES (Adelantos + HS Extras) ====================

    def _get_semana_del_mes(self, fecha: date) -> int:
        """Calcula el número de semana del mes (1-4) basado en rangos fijos de días.

        - Días 1-7: Semana 1
        - Días 8-14: Semana 2
        - Días 15-21: Semana 3
        - Días 22-31: Semana 4
        """
        dia = fecha.day
        if dia <= 7:
            return 1
        elif dia <= 14:
            return 2
        elif dia <= 21:
            return 3
        else:
            return 4

    def registrar_jornal(
        self,
        data,  # RegistroJornalCreate
        registrado_por_id: UUID
    ) -> MovimientoNomina:
        """
        Registra un adelanto o horas extras para un empleado en una fecha específica.
        """
        empleado = self.get_empleado(data.empleado_id)
        if not empleado:
            raise ValueError("Empleado no encontrado")

        semana = self._get_semana_del_mes(data.fecha)

        if data.tipo == "adelanto":
            if not data.monto or data.monto <= 0:
                raise ValueError("Monto de adelanto debe ser mayor a 0")

            movimiento = MovimientoNomina(
                empleado_id=data.empleado_id,
                tipo=TipoMovimientoNomina.ADELANTO.value,
                concepto=f"Adelanto {data.fecha.strftime('%d/%m/%Y')}",
                descripcion=data.notas,
                periodo_mes=data.fecha.month,
                periodo_anio=data.fecha.year,
                fecha=data.fecha,
                semana=semana,
                monto=data.monto,
                es_debito=True,  # Adelanto se descuenta del sueldo
                registrado_por_id=registrado_por_id
            )

        elif data.tipo == "hora_extra":
            if not data.cantidad_horas or data.cantidad_horas <= 0:
                raise ValueError("Cantidad de horas debe ser mayor a 0")

            # Usar valor hora extra del empleado
            valor_hora = empleado.valor_hora_extra or empleado.salario_hora or Decimal("0")
            if valor_hora <= 0:
                raise ValueError("El empleado no tiene configurado un valor de hora extra")

            monto = data.cantidad_horas * valor_hora

            movimiento = MovimientoNomina(
                empleado_id=data.empleado_id,
                tipo=TipoMovimientoNomina.HORA_EXTRA.value,
                concepto=f"HS Extras {data.fecha.strftime('%d/%m/%Y')} ({data.cantidad_horas}hs)",
                descripcion=data.notas,
                periodo_mes=data.fecha.month,
                periodo_anio=data.fecha.year,
                fecha=data.fecha,
                semana=semana,
                cantidad_horas=data.cantidad_horas,
                valor_hora=valor_hora,
                monto=monto,
                es_debito=False,  # Horas extras se suman
                registrado_por_id=registrado_por_id
            )
        else:
            raise ValueError(f"Tipo de jornal inválido: {data.tipo}")

        self.db.add(movimiento)
        self.db.commit()
        self.db.refresh(movimiento)
        return movimiento

    def get_resumen_mensual_jornales(self, mes: int, anio: int) -> dict:
        """
        Obtiene resumen mensual de adelantos y horas extras de todos los empleados.
        Estructura similar al Excel de ADELANTO + HS. EXTRAS.
        """
        # Obtener empleados activos
        empleados_result = self.db.execute(
            select(Empleado)
            .where(Empleado.activo == True)
            .order_by(Empleado.nombre, Empleado.apellido)
        )
        empleados = empleados_result.scalars().all()

        resumen_empleados = []
        total_adelantos_global = Decimal("0")
        total_horas_global = Decimal("0")
        total_monto_extras_global = Decimal("0")

        for empleado in empleados:
            resumen_emp = self.get_resumen_empleado_jornales(empleado.id, mes, anio)
            resumen_empleados.append(resumen_emp)

            total_adelantos_global += resumen_emp["total_adelantos"]
            total_horas_global += resumen_emp["total_horas_extras"]
            total_monto_extras_global += resumen_emp["total_monto_extras"]

        return {
            "periodo_mes": mes,
            "periodo_anio": anio,
            "empleados": resumen_empleados,
            "total_adelantos": total_adelantos_global,
            "total_horas_extras": total_horas_global,
            "total_monto_extras": total_monto_extras_global,
            "total_general": total_adelantos_global + total_monto_extras_global
        }

    def get_resumen_empleado_jornales(self, empleado_id: UUID, mes: int, anio: int) -> dict:
        """
        Obtiene resumen mensual de adelantos y horas extras de un empleado.
        """
        empleado = self.get_empleado(empleado_id)
        if not empleado:
            raise ValueError("Empleado no encontrado")

        # Obtener movimientos del mes (adelantos y horas extras)
        result = self.db.execute(
            select(MovimientoNomina)
            .where(and_(
                MovimientoNomina.empleado_id == empleado_id,
                MovimientoNomina.periodo_mes == mes,
                MovimientoNomina.periodo_anio == anio,
                MovimientoNomina.tipo.in_([
                    TipoMovimientoNomina.ADELANTO.value,
                    TipoMovimientoNomina.HORA_EXTRA.value
                ]),
                MovimientoNomina.activo == True
            ))
            .order_by(MovimientoNomina.fecha)
        )
        movimientos = result.scalars().all()

        # Agrupar por semana
        semanas_dict = {}
        for mov in movimientos:
            semana = mov.semana or 1
            if semana not in semanas_dict:
                semanas_dict[semana] = {
                    "empleado_id": str(empleado_id),
                    "empleado_nombre": empleado.nombre_completo,
                    "semana": semana,
                    "periodo_mes": mes,
                    "periodo_anio": anio,
                    "total_adelantos": Decimal("0"),
                    "total_horas_extras": Decimal("0"),
                    "total_monto_extras": Decimal("0"),
                    "dias_con_movimiento": 0
                }

            if mov.tipo == TipoMovimientoNomina.ADELANTO.value:
                semanas_dict[semana]["total_adelantos"] += mov.monto
            elif mov.tipo == TipoMovimientoNomina.HORA_EXTRA.value:
                semanas_dict[semana]["total_horas_extras"] += mov.cantidad_horas or Decimal("0")
                semanas_dict[semana]["total_monto_extras"] += mov.monto

            semanas_dict[semana]["dias_con_movimiento"] += 1

        # Crear lista de semanas (1-5)
        semanas = []
        for i in range(1, 6):
            if i in semanas_dict:
                semanas.append(semanas_dict[i])
            else:
                semanas.append({
                    "empleado_id": str(empleado_id),
                    "empleado_nombre": empleado.nombre_completo,
                    "semana": i,
                    "periodo_mes": mes,
                    "periodo_anio": anio,
                    "total_adelantos": Decimal("0"),
                    "total_horas_extras": Decimal("0"),
                    "total_monto_extras": Decimal("0"),
                    "dias_con_movimiento": 0
                })

        # Calcular totales
        total_adelantos = sum(s["total_adelantos"] for s in semanas)
        total_horas = sum(s["total_horas_extras"] for s in semanas)
        total_monto = sum(s["total_monto_extras"] for s in semanas)

        salario_base = empleado.salario_base or Decimal("0")
        sueldo_final = salario_base - total_adelantos

        return {
            "empleado_id": str(empleado_id),
            "empleado_nombre": empleado.nombre_completo,
            "valor_hora_extra": empleado.valor_hora_extra,
            "salario_base": salario_base,
            "periodo_mes": mes,
            "periodo_anio": anio,
            "semanas": semanas,
            "total_adelantos": total_adelantos,
            "total_horas_extras": total_horas,
            "total_monto_extras": total_monto,
            "total_general": total_adelantos + total_monto,
            "sueldo_final": sueldo_final,
        }

    # ==================== DEPARTAMENTOS ====================

    def get_departamentos(self) -> List[str]:
        """Lista departamentos únicos"""
        result = self.db.execute(
            select(Empleado.departamento)
            .where(and_(
                Empleado.activo == True,
                Empleado.departamento.isnot(None)
            ))
            .distinct()
        )
        departamentos = result.scalars().all()
        return [d for d in departamentos if d]
