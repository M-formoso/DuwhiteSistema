"""
Servicio de Empleados para DUWHITE ERP
"""

from datetime import date, time, datetime
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

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

    def __init__(self, db: AsyncSession):
        self.db = db

    # ==================== EMPLEADOS ====================

    async def _generate_codigo(self) -> str:
        """Genera código único para empleado"""
        result = await self.db.execute(
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
        count_result = await self.db.execute(select(func.count(Empleado.id)))
        count = count_result.scalar() or 0
        return f"EMP-{str(count + 1).zfill(4)}"

    async def get_empleados(
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
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Aplicar paginación
        query = query.order_by(Empleado.apellido, Empleado.nombre)
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        empleados = result.scalars().all()

        return list(empleados), total

    async def get_empleado(self, empleado_id: UUID) -> Optional[Empleado]:
        """Obtiene empleado por ID"""
        result = await self.db.execute(
            select(Empleado).where(Empleado.id == empleado_id)
        )
        return result.scalar_one_or_none()

    async def get_empleado_by_dni(self, dni: str) -> Optional[Empleado]:
        """Obtiene empleado por DNI"""
        result = await self.db.execute(
            select(Empleado).where(Empleado.dni == dni)
        )
        return result.scalar_one_or_none()

    async def create_empleado(self, data: EmpleadoCreate) -> Empleado:
        """Crea nuevo empleado"""
        codigo = data.codigo or await self._generate_codigo()

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
        await self.db.commit()
        await self.db.refresh(empleado)
        return empleado

    async def update_empleado(self, empleado_id: UUID, data: EmpleadoUpdate) -> Optional[Empleado]:
        """Actualiza empleado"""
        empleado = await self.get_empleado(empleado_id)
        if not empleado:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(empleado, field, value)

        await self.db.commit()
        await self.db.refresh(empleado)
        return empleado

    async def delete_empleado(self, empleado_id: UUID) -> bool:
        """Elimina empleado (soft delete)"""
        empleado = await self.get_empleado(empleado_id)
        if not empleado:
            return False

        empleado.activo = False
        empleado.estado = EstadoEmpleado.DESVINCULADO.value
        empleado.fecha_egreso = date.today()

        await self.db.commit()
        return True

    # ==================== ASISTENCIA ====================

    async def registrar_asistencia(
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
        await self.db.commit()
        await self.db.refresh(asistencia)

        # Actualizar jornada laboral si corresponde
        await self._actualizar_jornada(data.empleado_id, asistencia.fecha)

        return asistencia

    async def get_asistencias(
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
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginar
        query = query.order_by(Asistencia.fecha.desc(), Asistencia.hora.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        asistencias = result.scalars().all()

        return list(asistencias), total

    async def _actualizar_jornada(self, empleado_id: UUID, fecha: date):
        """Actualiza o crea jornada laboral basada en asistencias"""
        # Obtener todas las asistencias del día
        result = await self.db.execute(
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
        jornada_result = await self.db.execute(
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
        empleado = await self.get_empleado(empleado_id)
        if empleado and empleado.horario_entrada and hora_entrada:
            if hora_entrada > empleado.horario_entrada:
                jornada.llegada_tarde = True

        await self.db.commit()

    # ==================== JORNADAS ====================

    async def get_jornadas(
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
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginar
        query = query.order_by(JornadaLaboral.fecha.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        jornadas = result.scalars().all()

        return list(jornadas), total

    async def justificar_jornada(
        self,
        jornada_id: UUID,
        data: JornadaJustificacion
    ) -> Optional[JornadaLaboral]:
        """Justifica ausencia o tardanza"""
        result = await self.db.execute(
            select(JornadaLaboral).where(JornadaLaboral.id == jornada_id)
        )
        jornada = result.scalar_one_or_none()

        if not jornada:
            return None

        jornada.justificado = data.justificado
        jornada.motivo_justificacion = data.motivo_justificacion

        await self.db.commit()
        await self.db.refresh(jornada)
        return jornada

    # ==================== MOVIMIENTOS NOMINA ====================

    async def create_movimiento_nomina(
        self,
        data: MovimientoNominaCreate,
        registrado_por_id: UUID
    ) -> MovimientoNomina:
        """Crea movimiento de nómina"""
        # Si es adelanto, validar que no supere el máximo permitido
        if data.tipo == TipoMovimientoNomina.ADELANTO.value:
            empleado = await self.get_empleado(data.empleado_id)
            if not empleado:
                raise ValueError("Empleado no encontrado")

            # Calcular adelantos ya registrados en el período
            adelantos_existentes = await self.db.execute(
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
        await self.db.commit()
        await self.db.refresh(movimiento)
        return movimiento

    async def get_movimientos_nomina(
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
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginar
        query = query.order_by(MovimientoNomina.created_at.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        movimientos = result.scalars().all()

        return list(movimientos), total

    async def pagar_movimiento(
        self,
        movimiento_id: UUID,
        data: PagarMovimientoRequest
    ) -> Optional[MovimientoNomina]:
        """Marca movimiento como pagado"""
        result = await self.db.execute(
            select(MovimientoNomina).where(MovimientoNomina.id == movimiento_id)
        )
        movimiento = result.scalar_one_or_none()

        if not movimiento:
            return None

        movimiento.pagado = True
        movimiento.fecha_pago = data.fecha_pago
        movimiento.medio_pago = data.medio_pago
        movimiento.comprobante = data.comprobante

        await self.db.commit()
        await self.db.refresh(movimiento)
        return movimiento

    # ==================== LIQUIDACIONES ====================

    async def _get_next_numero_liquidacion(self) -> int:
        """Obtiene siguiente número de liquidación"""
        result = await self.db.execute(
            select(func.max(Liquidacion.numero))
        )
        last_num = result.scalar()
        return (last_num or 0) + 1

    async def create_liquidacion(
        self,
        data: LiquidacionCreate,
        generada_por_id: UUID
    ) -> Liquidacion:
        """Genera liquidación de sueldo"""
        # Obtener empleado
        empleado = await self.get_empleado(data.empleado_id)
        if not empleado:
            raise ValueError("Empleado no encontrado")

        # Calcular horas extra del período
        jornadas_result = await self.db.execute(
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
        adelantos_result = await self.db.execute(
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

        numero = await self._get_next_numero_liquidacion()

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
        await self.db.commit()
        await self.db.refresh(liquidacion)
        return liquidacion

    async def get_liquidaciones(
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
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginar
        query = query.order_by(Liquidacion.numero.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        liquidaciones = result.scalars().all()

        return list(liquidaciones), total

    async def pagar_liquidacion(
        self,
        liquidacion_id: UUID,
        fecha_pago: date
    ) -> Optional[Liquidacion]:
        """Marca liquidación como pagada"""
        result = await self.db.execute(
            select(Liquidacion).where(Liquidacion.id == liquidacion_id)
        )
        liquidacion = result.scalar_one_or_none()

        if not liquidacion:
            return None

        liquidacion.pagada = True
        liquidacion.fecha_pago = fecha_pago

        await self.db.commit()
        await self.db.refresh(liquidacion)
        return liquidacion

    # ==================== DEPARTAMENTOS ====================

    async def get_departamentos(self) -> List[str]:
        """Lista departamentos únicos"""
        result = await self.db.execute(
            select(Empleado.departamento)
            .where(and_(
                Empleado.activo == True,
                Empleado.departamento.isnot(None)
            ))
            .distinct()
        )
        departamentos = result.scalars().all()
        return [d for d in departamentos if d]
