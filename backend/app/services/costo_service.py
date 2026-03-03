"""
Servicio de Costos para DUWHITE ERP
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_, or_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.costo import (
    CostoFijo, CostoVariable, TarifaServicio, AnalisisCostoLote, ParametroCosto
)
from app.models.lote_produccion import LoteProduccion, ConsumoInsumoLote
from app.models.pedido import Pedido, DetallePedido
from app.models.cliente import Cliente
from app.models.lista_precios import Servicio
from app.schemas.costo import (
    CostoFijoCreate, CostoFijoUpdate,
    CostoVariableCreate, CostoVariableUpdate,
    TarifaServicioCreate, TarifaServicioUpdate,
    AnalisisCostoLoteCreate,
    ParametroCostoCreate, ParametroCostoUpdate,
    ResumenCostosMes, RentabilidadServicio, RentabilidadCliente
)


class CostoService:
    """Servicio para gestión de costos"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ==================== COSTOS FIJOS ====================

    async def get_costos_fijos(
        self,
        skip: int = 0,
        limit: int = 50,
        categoria: Optional[str] = None,
        solo_vigentes: bool = True
    ) -> Tuple[List[CostoFijo], int]:
        """Lista costos fijos"""
        query = select(CostoFijo).where(CostoFijo.is_active == True)

        if categoria:
            query = query.where(CostoFijo.categoria == categoria)

        if solo_vigentes:
            hoy = date.today()
            query = query.where(
                and_(
                    CostoFijo.fecha_inicio <= hoy,
                    or_(
                        CostoFijo.fecha_fin.is_(None),
                        CostoFijo.fecha_fin >= hoy
                    )
                )
            )

        # Contar
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginar
        query = query.order_by(CostoFijo.categoria, CostoFijo.nombre)
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        costos = result.scalars().all()

        return list(costos), total

    async def get_costo_fijo(self, costo_id: UUID) -> Optional[CostoFijo]:
        """Obtiene costo fijo por ID"""
        result = await self.db.execute(
            select(CostoFijo).where(CostoFijo.id == costo_id)
        )
        return result.scalar_one_or_none()

    async def create_costo_fijo(self, data: CostoFijoCreate) -> CostoFijo:
        """Crea costo fijo"""
        costo = CostoFijo(**data.model_dump())
        self.db.add(costo)
        await self.db.commit()
        await self.db.refresh(costo)
        return costo

    async def update_costo_fijo(self, costo_id: UUID, data: CostoFijoUpdate) -> Optional[CostoFijo]:
        """Actualiza costo fijo"""
        costo = await self.get_costo_fijo(costo_id)
        if not costo:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(costo, field, value)

        await self.db.commit()
        await self.db.refresh(costo)
        return costo

    async def delete_costo_fijo(self, costo_id: UUID) -> bool:
        """Elimina costo fijo (soft delete)"""
        costo = await self.get_costo_fijo(costo_id)
        if not costo:
            return False

        costo.is_active = False
        await self.db.commit()
        return True

    async def get_total_costos_fijos_mes(self, mes: int, anio: int) -> Decimal:
        """Calcula total de costos fijos para un mes"""
        fecha_inicio_mes = date(anio, mes, 1)
        if mes == 12:
            fecha_fin_mes = date(anio + 1, 1, 1)
        else:
            fecha_fin_mes = date(anio, mes + 1, 1)

        result = await self.db.execute(
            select(func.sum(CostoFijo.monto_mensual))
            .where(and_(
                CostoFijo.is_active == True,
                CostoFijo.fecha_inicio <= fecha_fin_mes,
                or_(
                    CostoFijo.fecha_fin.is_(None),
                    CostoFijo.fecha_fin >= fecha_inicio_mes
                )
            ))
        )
        return result.scalar() or Decimal("0")

    # ==================== COSTOS VARIABLES ====================

    async def get_costos_variables(
        self,
        skip: int = 0,
        limit: int = 50,
        categoria: Optional[str] = None
    ) -> Tuple[List[CostoVariable], int]:
        """Lista costos variables"""
        query = select(CostoVariable).where(CostoVariable.is_active == True)

        if categoria:
            query = query.where(CostoVariable.categoria == categoria)

        # Contar
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginar
        query = query.order_by(CostoVariable.categoria, CostoVariable.nombre)
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        costos = result.scalars().all()

        return list(costos), total

    async def get_costo_variable(self, costo_id: UUID) -> Optional[CostoVariable]:
        """Obtiene costo variable por ID"""
        result = await self.db.execute(
            select(CostoVariable).where(CostoVariable.id == costo_id)
        )
        return result.scalar_one_or_none()

    async def create_costo_variable(self, data: CostoVariableCreate) -> CostoVariable:
        """Crea costo variable"""
        costo = CostoVariable(**data.model_dump())
        self.db.add(costo)
        await self.db.commit()
        await self.db.refresh(costo)
        return costo

    async def update_costo_variable(self, costo_id: UUID, data: CostoVariableUpdate) -> Optional[CostoVariable]:
        """Actualiza costo variable"""
        costo = await self.get_costo_variable(costo_id)
        if not costo:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(costo, field, value)

        await self.db.commit()
        await self.db.refresh(costo)
        return costo

    async def delete_costo_variable(self, costo_id: UUID) -> bool:
        """Elimina costo variable (soft delete)"""
        costo = await self.get_costo_variable(costo_id)
        if not costo:
            return False

        costo.is_active = False
        await self.db.commit()
        return True

    # ==================== TARIFAS DE SERVICIO ====================

    async def get_tarifas_servicios(
        self,
        servicio_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 50
    ) -> Tuple[List[TarifaServicio], int]:
        """Lista tarifas de servicios"""
        query = select(TarifaServicio).where(TarifaServicio.is_active == True)

        if servicio_id:
            query = query.where(TarifaServicio.servicio_id == servicio_id)

        # Contar
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginar
        query = query.order_by(TarifaServicio.fecha_vigencia.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        tarifas = result.scalars().all()

        return list(tarifas), total

    async def get_tarifa_servicio(self, tarifa_id: UUID) -> Optional[TarifaServicio]:
        """Obtiene tarifa de servicio por ID"""
        result = await self.db.execute(
            select(TarifaServicio).where(TarifaServicio.id == tarifa_id)
        )
        return result.scalar_one_or_none()

    async def get_tarifa_vigente(self, servicio_id: UUID) -> Optional[TarifaServicio]:
        """Obtiene tarifa vigente para un servicio"""
        hoy = date.today()
        result = await self.db.execute(
            select(TarifaServicio)
            .where(and_(
                TarifaServicio.servicio_id == servicio_id,
                TarifaServicio.fecha_vigencia <= hoy,
                TarifaServicio.is_active == True
            ))
            .order_by(TarifaServicio.fecha_vigencia.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create_tarifa_servicio(self, data: TarifaServicioCreate) -> TarifaServicio:
        """Crea tarifa de servicio"""
        # Calcular costo total
        costo_total = (
            data.costo_mano_obra +
            data.costo_insumos +
            data.costo_energia +
            data.costo_otros
        )

        tarifa = TarifaServicio(
            **data.model_dump(),
            costo_total=costo_total
        )
        self.db.add(tarifa)
        await self.db.commit()
        await self.db.refresh(tarifa)
        return tarifa

    async def update_tarifa_servicio(self, tarifa_id: UUID, data: TarifaServicioUpdate) -> Optional[TarifaServicio]:
        """Actualiza tarifa de servicio"""
        tarifa = await self.get_tarifa_servicio(tarifa_id)
        if not tarifa:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(tarifa, field, value)

        # Recalcular costo total
        tarifa.costo_total = (
            tarifa.costo_mano_obra +
            tarifa.costo_insumos +
            tarifa.costo_energia +
            tarifa.costo_otros
        )

        await self.db.commit()
        await self.db.refresh(tarifa)
        return tarifa

    # ==================== ANALISIS DE LOTES ====================

    async def create_analisis_lote(self, data: AnalisisCostoLoteCreate) -> AnalisisCostoLote:
        """Crea análisis de costo para un lote"""
        # Calcular totales
        costo_total = (
            data.costo_insumos +
            data.costo_mano_obra +
            data.costo_energia +
            data.costo_fijos_prorrateado +
            data.costo_otros
        )

        costo_por_kg = None
        if data.kg_procesados and data.kg_procesados > 0:
            costo_por_kg = costo_total / data.kg_procesados

        margen_bruto = None
        margen_porcentaje = None
        if data.ingreso_total:
            margen_bruto = data.ingreso_total - costo_total
            if data.ingreso_total > 0:
                margen_porcentaje = (margen_bruto / data.ingreso_total) * 100

        variacion = None
        if data.costo_estimado:
            variacion = costo_total - data.costo_estimado

        analisis = AnalisisCostoLote(
            lote_id=data.lote_id,
            costo_insumos=data.costo_insumos,
            costo_mano_obra=data.costo_mano_obra,
            costo_energia=data.costo_energia,
            costo_fijos_prorrateado=data.costo_fijos_prorrateado,
            costo_otros=data.costo_otros,
            costo_total=costo_total,
            kg_procesados=data.kg_procesados,
            costo_por_kg=costo_por_kg,
            ingreso_total=data.ingreso_total,
            margen_bruto=margen_bruto,
            margen_porcentaje=margen_porcentaje,
            costo_estimado=data.costo_estimado,
            variacion=variacion,
            notas=data.notas
        )

        self.db.add(analisis)
        await self.db.commit()
        await self.db.refresh(analisis)
        return analisis

    async def get_analisis_lote(self, lote_id: UUID) -> Optional[AnalisisCostoLote]:
        """Obtiene análisis de costo de un lote"""
        result = await self.db.execute(
            select(AnalisisCostoLote).where(AnalisisCostoLote.lote_id == lote_id)
        )
        return result.scalar_one_or_none()

    async def calcular_costo_lote(self, lote_id: UUID) -> AnalisisCostoLote:
        """Calcula automáticamente los costos de un lote"""
        # Obtener lote
        lote_result = await self.db.execute(
            select(LoteProduccion).where(LoteProduccion.id == lote_id)
        )
        lote = lote_result.scalar_one_or_none()
        if not lote:
            raise ValueError("Lote no encontrado")

        # Calcular costo de insumos consumidos
        consumos_result = await self.db.execute(
            select(ConsumoInsumoLote)
            .where(ConsumoInsumoLote.lote_id == lote_id)
        )
        consumos = consumos_result.scalars().all()

        costo_insumos = sum(
            (c.cantidad * c.costo_unitario) if c.costo_unitario else Decimal("0")
            for c in consumos
        )

        # Obtener parámetros de costo
        costo_kwh = await self._get_parametro_valor("costo_kwh", Decimal("100"))
        factor_mano_obra = await self._get_parametro_valor("factor_mano_obra", Decimal("500"))

        # Estimar costo de energía (basado en kg procesados)
        kg = lote.peso_total or Decimal("0")
        costo_energia = kg * Decimal("0.5") * costo_kwh  # Estimado: 0.5 kWh por kg

        # Estimar mano de obra (basado en tiempo de proceso)
        # Asumiendo 1 hora por cada 50 kg
        horas_estimadas = kg / 50 if kg > 0 else Decimal("1")
        costo_mano_obra = horas_estimadas * factor_mano_obra

        # Prorratear costos fijos
        hoy = date.today()
        costos_fijos_mes = await self.get_total_costos_fijos_mes(hoy.month, hoy.year)
        capacidad_mes = await self._get_parametro_valor("capacidad_kg_mes", Decimal("10000"))
        costo_fijos_por_kg = costos_fijos_mes / capacidad_mes if capacidad_mes > 0 else Decimal("0")
        costo_fijos_prorrateado = kg * costo_fijos_por_kg

        # Obtener ingreso del pedido asociado
        ingreso_total = None
        if lote.pedido_id:
            pedido_result = await self.db.execute(
                select(Pedido).where(Pedido.id == lote.pedido_id)
            )
            pedido = pedido_result.scalar_one_or_none()
            if pedido:
                ingreso_total = pedido.total

        # Crear análisis
        data = AnalisisCostoLoteCreate(
            lote_id=lote_id,
            costo_insumos=costo_insumos,
            costo_mano_obra=costo_mano_obra,
            costo_energia=costo_energia,
            costo_fijos_prorrateado=costo_fijos_prorrateado,
            costo_otros=Decimal("0"),
            kg_procesados=kg,
            ingreso_total=ingreso_total
        )

        return await self.create_analisis_lote(data)

    # ==================== PARAMETROS ====================

    async def get_parametros(self, categoria: Optional[str] = None) -> List[ParametroCosto]:
        """Lista parámetros de costo"""
        query = select(ParametroCosto).where(ParametroCosto.is_active == True)

        if categoria:
            query = query.where(ParametroCosto.categoria == categoria)

        query = query.order_by(ParametroCosto.categoria, ParametroCosto.clave)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_parametro(self, clave: str) -> Optional[ParametroCosto]:
        """Obtiene parámetro por clave"""
        result = await self.db.execute(
            select(ParametroCosto).where(ParametroCosto.clave == clave)
        )
        return result.scalar_one_or_none()

    async def _get_parametro_valor(self, clave: str, default: Decimal) -> Decimal:
        """Obtiene valor de parámetro como Decimal"""
        param = await self.get_parametro(clave)
        if param:
            try:
                return Decimal(param.valor)
            except:
                return default
        return default

    async def set_parametro(self, data: ParametroCostoCreate) -> ParametroCosto:
        """Crea o actualiza parámetro"""
        existing = await self.get_parametro(data.clave)
        if existing:
            existing.valor = data.valor
            existing.descripcion = data.descripcion
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        param = ParametroCosto(**data.model_dump())
        self.db.add(param)
        await self.db.commit()
        await self.db.refresh(param)
        return param

    # ==================== REPORTES DE COSTOS ====================

    async def get_resumen_costos_mes(self, mes: int, anio: int) -> ResumenCostosMes:
        """Genera resumen de costos del mes"""
        # Costos fijos
        costos_fijos, _ = await self.get_costos_fijos(limit=1000, solo_vigentes=True)
        total_fijos = sum(c.monto_mensual for c in costos_fijos)

        fijos_por_categoria: dict[str, Decimal] = {}
        for c in costos_fijos:
            if c.categoria not in fijos_por_categoria:
                fijos_por_categoria[c.categoria] = Decimal("0")
            fijos_por_categoria[c.categoria] += c.monto_mensual

        # Análisis de lotes del mes
        fecha_inicio = date(anio, mes, 1)
        if mes == 12:
            fecha_fin = date(anio + 1, 1, 1)
        else:
            fecha_fin = date(anio, mes + 1, 1)

        analisis_result = await self.db.execute(
            select(AnalisisCostoLote)
            .where(and_(
                AnalisisCostoLote.created_at >= fecha_inicio,
                AnalisisCostoLote.created_at < fecha_fin
            ))
        )
        analisis_list = analisis_result.scalars().all()

        total_variables = sum(
            (a.costo_insumos + a.costo_energia + a.costo_otros)
            for a in analisis_list
        )

        total_kg = sum(a.kg_procesados or Decimal("0") for a in analisis_list)
        total_ingresos = sum(a.ingreso_total or Decimal("0") for a in analisis_list)

        costo_total = total_fijos + total_variables
        costo_por_kg = costo_total / total_kg if total_kg > 0 else Decimal("0")
        margen_bruto = total_ingresos - costo_total
        margen_porcentaje = (margen_bruto / total_ingresos * 100) if total_ingresos > 0 else Decimal("0")

        return ResumenCostosMes(
            periodo_mes=mes,
            periodo_anio=anio,
            total_costos_fijos=total_fijos,
            costos_fijos_por_categoria=fijos_por_categoria,
            total_costos_variables=total_variables,
            costos_variables_por_categoria={
                "insumos": sum(a.costo_insumos for a in analisis_list),
                "energia": sum(a.costo_energia for a in analisis_list),
                "otros": sum(a.costo_otros for a in analisis_list),
            },
            total_kg_procesados=total_kg,
            costo_promedio_por_kg=costo_por_kg,
            total_ingresos=total_ingresos,
            margen_bruto=margen_bruto,
            margen_porcentaje=margen_porcentaje
        )

    async def get_rentabilidad_por_cliente(
        self,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
        limit: int = 20
    ) -> List[RentabilidadCliente]:
        """Calcula rentabilidad por cliente"""
        # Consulta de pedidos agrupados por cliente
        query = select(
            Pedido.cliente_id,
            func.count(Pedido.id).label('cantidad_pedidos'),
            func.sum(Pedido.peso_total).label('kg_procesados'),
            func.sum(Pedido.total).label('ingreso_total')
        ).where(Pedido.is_active == True)

        if fecha_desde:
            query = query.where(Pedido.fecha_pedido >= fecha_desde)
        if fecha_hasta:
            query = query.where(Pedido.fecha_pedido <= fecha_hasta)

        query = query.group_by(Pedido.cliente_id)
        query = query.order_by(func.sum(Pedido.total).desc())
        query = query.limit(limit)

        result = await self.db.execute(query)
        rows = result.all()

        rentabilidades = []
        for row in rows:
            # Obtener cliente
            cliente_result = await self.db.execute(
                select(Cliente).where(Cliente.id == row.cliente_id)
            )
            cliente = cliente_result.scalar_one_or_none()

            # Estimar costo (simplificado)
            kg = row.kg_procesados or Decimal("0")
            costo_estimado = kg * Decimal("150")  # Costo estimado por kg

            ingreso = row.ingreso_total or Decimal("0")
            margen = ingreso - costo_estimado
            margen_pct = (margen / ingreso * 100) if ingreso > 0 else Decimal("0")

            rentabilidades.append(RentabilidadCliente(
                cliente_id=row.cliente_id,
                cliente_nombre=cliente.razon_social if cliente else "Desconocido",
                cantidad_pedidos=row.cantidad_pedidos or 0,
                kg_procesados=kg,
                costo_total=costo_estimado,
                ingreso_total=ingreso,
                margen_bruto=margen,
                margen_porcentaje=margen_pct
            ))

        return rentabilidades
