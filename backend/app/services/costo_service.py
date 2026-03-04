"""
Servicio de Costos para DUWHITE ERP
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_, or_, extract
from sqlalchemy.orm import Session

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

    def __init__(self, db: Session):
        self.db = db

    # ==================== COSTOS FIJOS ====================

    def get_costos_fijos(
        self,
        skip: int = 0,
        limit: int = 50,
        categoria: Optional[str] = None,
        solo_vigentes: bool = True
    ) -> Tuple[List[CostoFijo], int]:
        """Lista costos fijos"""
        query = self.db.query(CostoFijo).filter(CostoFijo.activo == True)

        if categoria:
            query = query.filter(CostoFijo.categoria == categoria)

        if solo_vigentes:
            hoy = date.today()
            query = query.filter(
                and_(
                    CostoFijo.fecha_inicio <= hoy,
                    or_(
                        CostoFijo.fecha_fin.is_(None),
                        CostoFijo.fecha_fin >= hoy
                    )
                )
            )

        # Contar
        total = query.count()

        # Paginar
        query = query.order_by(CostoFijo.categoria, CostoFijo.nombre)
        query = query.offset(skip).limit(limit)

        costos = query.all()

        return list(costos), total

    def get_costo_fijo(self, costo_id: UUID) -> Optional[CostoFijo]:
        """Obtiene costo fijo por ID"""
        return self.db.query(CostoFijo).filter(CostoFijo.id == costo_id).first()

    def create_costo_fijo(self, data: CostoFijoCreate) -> CostoFijo:
        """Crea costo fijo"""
        costo = CostoFijo(**data.model_dump())
        self.db.add(costo)
        self.db.commit()
        self.db.refresh(costo)
        return costo

    def update_costo_fijo(self, costo_id: UUID, data: CostoFijoUpdate) -> Optional[CostoFijo]:
        """Actualiza costo fijo"""
        costo = self.get_costo_fijo(costo_id)
        if not costo:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(costo, field, value)

        self.db.commit()
        self.db.refresh(costo)
        return costo

    def delete_costo_fijo(self, costo_id: UUID) -> bool:
        """Elimina costo fijo (soft delete)"""
        costo = self.get_costo_fijo(costo_id)
        if not costo:
            return False

        costo.activo = False
        self.db.commit()
        return True

    def get_total_costos_fijos_mes(self, mes: int, anio: int) -> Decimal:
        """Calcula total de costos fijos para un mes"""
        fecha_inicio_mes = date(anio, mes, 1)
        if mes == 12:
            fecha_fin_mes = date(anio + 1, 1, 1)
        else:
            fecha_fin_mes = date(anio, mes + 1, 1)

        result = self.db.query(func.sum(CostoFijo.monto_mensual)).filter(
            and_(
                CostoFijo.activo == True,
                CostoFijo.fecha_inicio <= fecha_fin_mes,
                or_(
                    CostoFijo.fecha_fin.is_(None),
                    CostoFijo.fecha_fin >= fecha_inicio_mes
                )
            )
        ).scalar()

        return result or Decimal("0")

    # ==================== COSTOS VARIABLES ====================

    def get_costos_variables(
        self,
        skip: int = 0,
        limit: int = 50,
        categoria: Optional[str] = None
    ) -> Tuple[List[CostoVariable], int]:
        """Lista costos variables"""
        query = self.db.query(CostoVariable).filter(CostoVariable.activo == True)

        if categoria:
            query = query.filter(CostoVariable.categoria == categoria)

        # Contar
        total = query.count()

        # Paginar
        query = query.order_by(CostoVariable.categoria, CostoVariable.nombre)
        query = query.offset(skip).limit(limit)

        costos = query.all()

        return list(costos), total

    def get_costo_variable(self, costo_id: UUID) -> Optional[CostoVariable]:
        """Obtiene costo variable por ID"""
        return self.db.query(CostoVariable).filter(CostoVariable.id == costo_id).first()

    def create_costo_variable(self, data: CostoVariableCreate) -> CostoVariable:
        """Crea costo variable"""
        costo = CostoVariable(**data.model_dump())
        self.db.add(costo)
        self.db.commit()
        self.db.refresh(costo)
        return costo

    def update_costo_variable(self, costo_id: UUID, data: CostoVariableUpdate) -> Optional[CostoVariable]:
        """Actualiza costo variable"""
        costo = self.get_costo_variable(costo_id)
        if not costo:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(costo, field, value)

        self.db.commit()
        self.db.refresh(costo)
        return costo

    def delete_costo_variable(self, costo_id: UUID) -> bool:
        """Elimina costo variable (soft delete)"""
        costo = self.get_costo_variable(costo_id)
        if not costo:
            return False

        costo.activo = False
        self.db.commit()
        return True

    # ==================== TARIFAS DE SERVICIO ====================

    def get_tarifas_servicios(
        self,
        servicio_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 50
    ) -> Tuple[List[TarifaServicio], int]:
        """Lista tarifas de servicios"""
        query = self.db.query(TarifaServicio).filter(TarifaServicio.activo == True)

        if servicio_id:
            query = query.filter(TarifaServicio.servicio_id == servicio_id)

        # Contar
        total = query.count()

        # Paginar
        query = query.order_by(TarifaServicio.fecha_vigencia.desc())
        query = query.offset(skip).limit(limit)

        tarifas = query.all()

        return list(tarifas), total

    def get_tarifa_servicio(self, tarifa_id: UUID) -> Optional[TarifaServicio]:
        """Obtiene tarifa de servicio por ID"""
        return self.db.query(TarifaServicio).filter(TarifaServicio.id == tarifa_id).first()

    def get_tarifa_vigente(self, servicio_id: UUID) -> Optional[TarifaServicio]:
        """Obtiene tarifa vigente para un servicio"""
        hoy = date.today()
        return self.db.query(TarifaServicio).filter(
            and_(
                TarifaServicio.servicio_id == servicio_id,
                TarifaServicio.fecha_vigencia <= hoy,
                TarifaServicio.activo == True
            )
        ).order_by(TarifaServicio.fecha_vigencia.desc()).first()

    def create_tarifa_servicio(self, data: TarifaServicioCreate) -> TarifaServicio:
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
        self.db.commit()
        self.db.refresh(tarifa)
        return tarifa

    def update_tarifa_servicio(self, tarifa_id: UUID, data: TarifaServicioUpdate) -> Optional[TarifaServicio]:
        """Actualiza tarifa de servicio"""
        tarifa = self.get_tarifa_servicio(tarifa_id)
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

        self.db.commit()
        self.db.refresh(tarifa)
        return tarifa

    # ==================== ANALISIS DE LOTES ====================

    def create_analisis_lote(self, data: AnalisisCostoLoteCreate) -> AnalisisCostoLote:
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
        self.db.commit()
        self.db.refresh(analisis)
        return analisis

    def get_analisis_lote(self, lote_id: UUID) -> Optional[AnalisisCostoLote]:
        """Obtiene análisis de costo de un lote"""
        return self.db.query(AnalisisCostoLote).filter(AnalisisCostoLote.lote_id == lote_id).first()

    def calcular_costo_lote(self, lote_id: UUID) -> AnalisisCostoLote:
        """Calcula automáticamente los costos de un lote"""
        # Obtener lote
        lote = self.db.query(LoteProduccion).filter(LoteProduccion.id == lote_id).first()
        if not lote:
            raise ValueError("Lote no encontrado")

        # Calcular costo de insumos consumidos
        consumos = self.db.query(ConsumoInsumoLote).filter(
            ConsumoInsumoLote.lote_id == lote_id
        ).all()

        costo_insumos = sum(
            (c.cantidad * c.costo_unitario) if c.costo_unitario else Decimal("0")
            for c in consumos
        )

        # Obtener parámetros de costo
        costo_kwh = self._get_parametro_valor("costo_kwh", Decimal("100"))
        factor_mano_obra = self._get_parametro_valor("factor_mano_obra", Decimal("500"))

        # Estimar costo de energía (basado en kg procesados)
        kg = lote.peso_entrada_kg or Decimal("0")
        costo_energia = kg * Decimal("0.5") * costo_kwh  # Estimado: 0.5 kWh por kg

        # Estimar mano de obra (basado en tiempo de proceso)
        # Asumiendo 1 hora por cada 50 kg
        horas_estimadas = kg / 50 if kg > 0 else Decimal("1")
        costo_mano_obra = horas_estimadas * factor_mano_obra

        # Prorratear costos fijos
        hoy = date.today()
        costos_fijos_mes = self.get_total_costos_fijos_mes(hoy.month, hoy.year)
        capacidad_mes = self._get_parametro_valor("capacidad_kg_mes", Decimal("10000"))
        costo_fijos_por_kg = costos_fijos_mes / capacidad_mes if capacidad_mes > 0 else Decimal("0")
        costo_fijos_prorrateado = kg * costo_fijos_por_kg

        # Obtener ingreso del pedido asociado
        ingreso_total = None
        if lote.pedido_id:
            pedido = self.db.query(Pedido).filter(Pedido.id == lote.pedido_id).first()
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

        return self.create_analisis_lote(data)

    # ==================== PARAMETROS ====================

    def get_parametros(self, categoria: Optional[str] = None) -> List[ParametroCosto]:
        """Lista parámetros de costo"""
        query = self.db.query(ParametroCosto).filter(ParametroCosto.activo == True)

        if categoria:
            query = query.filter(ParametroCosto.categoria == categoria)

        query = query.order_by(ParametroCosto.categoria, ParametroCosto.clave)

        return query.all()

    def get_parametro(self, clave: str) -> Optional[ParametroCosto]:
        """Obtiene parámetro por clave"""
        return self.db.query(ParametroCosto).filter(ParametroCosto.clave == clave).first()

    def _get_parametro_valor(self, clave: str, default: Decimal) -> Decimal:
        """Obtiene valor de parámetro como Decimal"""
        param = self.get_parametro(clave)
        if param:
            try:
                return Decimal(param.valor)
            except:
                return default
        return default

    def set_parametro(self, data: ParametroCostoCreate) -> ParametroCosto:
        """Crea o actualiza parámetro"""
        existing = self.get_parametro(data.clave)
        if existing:
            existing.valor = data.valor
            existing.descripcion = data.descripcion
            self.db.commit()
            self.db.refresh(existing)
            return existing

        param = ParametroCosto(**data.model_dump())
        self.db.add(param)
        self.db.commit()
        self.db.refresh(param)
        return param

    # ==================== REPORTES DE COSTOS ====================

    def get_resumen_costos_mes(self, mes: int, anio: int) -> ResumenCostosMes:
        """Genera resumen de costos del mes"""
        # Costos fijos
        costos_fijos, _ = self.get_costos_fijos(limit=1000, solo_vigentes=True)
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

        analisis_list = self.db.query(AnalisisCostoLote).filter(
            and_(
                AnalisisCostoLote.created_at >= fecha_inicio,
                AnalisisCostoLote.created_at < fecha_fin
            )
        ).all()

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

    def get_rentabilidad_por_cliente(
        self,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
        limit: int = 20
    ) -> List[RentabilidadCliente]:
        """Calcula rentabilidad por cliente"""
        # Consulta de pedidos agrupados por cliente
        query = self.db.query(
            Pedido.cliente_id,
            func.count(Pedido.id).label('cantidad_pedidos'),
            func.sum(Pedido.total).label('ingreso_total')
        ).filter(Pedido.activo == True)

        if fecha_desde:
            query = query.filter(Pedido.fecha_pedido >= fecha_desde)
        if fecha_hasta:
            query = query.filter(Pedido.fecha_pedido <= fecha_hasta)

        query = query.group_by(Pedido.cliente_id)
        query = query.order_by(func.sum(Pedido.total).desc())
        query = query.limit(limit)

        rows = query.all()

        rentabilidades = []
        for row in rows:
            # Obtener cliente
            cliente = self.db.query(Cliente).filter(Cliente.id == row.cliente_id).first()

            ingreso = row.ingreso_total or Decimal("0")
            # Estimar costo como 60% del ingreso (simplificado)
            costo_estimado = ingreso * Decimal("0.6")

            margen = ingreso - costo_estimado
            margen_pct = (margen / ingreso * 100) if ingreso > 0 else Decimal("0")

            rentabilidades.append(RentabilidadCliente(
                cliente_id=row.cliente_id,
                cliente_nombre=cliente.razon_social if cliente else "Desconocido",
                cantidad_pedidos=row.cantidad_pedidos or 0,
                kg_procesados=Decimal("0"),  # No disponible sin lotes
                costo_total=costo_estimado,
                ingreso_total=ingreso,
                margen_bruto=margen,
                margen_porcentaje=margen_pct
            ))

        return rentabilidades

    # ==================== RECOMENDACIÓN DE PRECIOS ====================

    def recomendar_precio_servicio(
        self,
        servicio_id: UUID,
        margen_objetivo: Decimal = Decimal("30"),
        incluir_costos_fijos: bool = True,
    ) -> dict:
        """
        Recomienda un precio de venta para un servicio basado en costos.

        Args:
            servicio_id: ID del servicio
            margen_objetivo: Margen de ganancia deseado en porcentaje (ej: 30 = 30%)
            incluir_costos_fijos: Si se deben prorratear los costos fijos

        Returns:
            Dict con precio recomendado, desglose de costos y análisis
        """
        # Obtener servicio
        servicio = self.db.query(Servicio).filter(Servicio.id == servicio_id).first()
        if not servicio:
            raise ValueError("Servicio no encontrado")

        # Obtener tarifa vigente o calcular costos
        tarifa = self.get_tarifa_vigente(servicio_id)

        if tarifa:
            costo_mano_obra = tarifa.costo_mano_obra
            costo_insumos = tarifa.costo_insumos
            costo_energia = tarifa.costo_energia
            costo_otros = tarifa.costo_otros
        else:
            # Estimar costos basados en parámetros
            costo_mano_obra = self._get_parametro_valor("costo_hora_mano_obra", Decimal("800"))
            costo_insumos = self._get_parametro_valor("costo_insumo_por_kg", Decimal("150"))
            costo_energia = self._get_parametro_valor("costo_energia_por_kg", Decimal("50"))
            costo_otros = Decimal("0")

        # Costo variable total
        costo_variable = costo_mano_obra + costo_insumos + costo_energia + costo_otros

        # Prorrateo de costos fijos si aplica
        costo_fijo_prorrateado = Decimal("0")
        if incluir_costos_fijos:
            hoy = date.today()
            costos_fijos_mes = self.get_total_costos_fijos_mes(hoy.month, hoy.year)
            capacidad_mes = self._get_parametro_valor("capacidad_unidades_mes", Decimal("1000"))
            if capacidad_mes > 0:
                costo_fijo_prorrateado = costos_fijos_mes / capacidad_mes

        # Costo total
        costo_total = costo_variable + costo_fijo_prorrateado

        # Calcular precio recomendado con margen objetivo
        # Precio = Costo / (1 - margen%)
        factor_margen = Decimal("1") - (margen_objetivo / Decimal("100"))
        if factor_margen > 0:
            precio_recomendado = costo_total / factor_margen
        else:
            precio_recomendado = costo_total * Decimal("2")  # Fallback: 100% de margen

        # Precio actual del servicio
        precio_actual = servicio.precio_unitario if hasattr(servicio, 'precio_unitario') else None

        # Análisis de rentabilidad con precio actual
        margen_actual = None
        if precio_actual and precio_actual > 0:
            margen_actual = ((precio_actual - costo_total) / precio_actual) * 100

        return {
            "servicio_id": str(servicio_id),
            "servicio_nombre": servicio.nombre,
            "costo_desglose": {
                "mano_obra": float(costo_mano_obra),
                "insumos": float(costo_insumos),
                "energia": float(costo_energia),
                "otros": float(costo_otros),
                "fijos_prorrateado": float(costo_fijo_prorrateado),
            },
            "costo_total": float(costo_total),
            "margen_objetivo": float(margen_objetivo),
            "precio_recomendado": float(precio_recomendado),
            "precio_actual": float(precio_actual) if precio_actual else None,
            "margen_con_precio_actual": float(margen_actual) if margen_actual else None,
            "diferencia_precio": float(precio_recomendado - precio_actual) if precio_actual else None,
        }

    def recomendar_precios_lista(
        self,
        margen_objetivo: Decimal = Decimal("30"),
    ) -> list:
        """
        Recomienda precios para todos los servicios activos.
        """
        servicios = self.db.query(Servicio).filter(Servicio.activo == True).all()

        recomendaciones = []
        for servicio in servicios:
            try:
                rec = self.recomendar_precio_servicio(
                    servicio_id=servicio.id,
                    margen_objetivo=margen_objetivo,
                )
                recomendaciones.append(rec)
            except Exception as e:
                recomendaciones.append({
                    "servicio_id": str(servicio.id),
                    "servicio_nombre": servicio.nombre,
                    "error": str(e),
                })

        return recomendaciones

    # ==================== SIMULADOR "QUÉ PASA SI" ====================

    def simular_escenario(
        self,
        variacion_costos_fijos: Decimal = Decimal("0"),  # Porcentaje de variación
        variacion_costos_variables: Decimal = Decimal("0"),
        variacion_volumen: Decimal = Decimal("0"),
        variacion_precios: Decimal = Decimal("0"),
    ) -> dict:
        """
        Simula escenarios de "qué pasa si" para análisis de sensibilidad.

        Args:
            variacion_costos_fijos: Porcentaje de cambio en costos fijos (ej: 10 = +10%)
            variacion_costos_variables: Porcentaje de cambio en costos variables
            variacion_volumen: Porcentaje de cambio en volumen de producción
            variacion_precios: Porcentaje de cambio en precios de venta

        Returns:
            Comparación de escenario actual vs simulado
        """
        hoy = date.today()

        # Obtener datos actuales
        resumen_actual = self.get_resumen_costos_mes(hoy.month, hoy.year)

        costos_fijos_actuales = resumen_actual.total_costos_fijos
        costos_variables_actuales = resumen_actual.total_costos_variables
        ingresos_actuales = resumen_actual.total_ingresos
        volumen_actual = resumen_actual.total_kg_procesados

        # Aplicar variaciones
        factor_cf = Decimal("1") + (variacion_costos_fijos / Decimal("100"))
        factor_cv = Decimal("1") + (variacion_costos_variables / Decimal("100"))
        factor_vol = Decimal("1") + (variacion_volumen / Decimal("100"))
        factor_precio = Decimal("1") + (variacion_precios / Decimal("100"))

        costos_fijos_simulados = costos_fijos_actuales * factor_cf
        # Costos variables escalan con volumen
        costos_variables_simulados = costos_variables_actuales * factor_cv * factor_vol
        # Ingresos escalan con volumen y precios
        ingresos_simulados = ingresos_actuales * factor_vol * factor_precio
        volumen_simulado = volumen_actual * factor_vol

        # Calcular resultados
        costo_total_actual = costos_fijos_actuales + costos_variables_actuales
        costo_total_simulado = costos_fijos_simulados + costos_variables_simulados

        margen_actual = ingresos_actuales - costo_total_actual
        margen_simulado = ingresos_simulados - costo_total_simulado

        margen_pct_actual = (margen_actual / ingresos_actuales * 100) if ingresos_actuales > 0 else Decimal("0")
        margen_pct_simulado = (margen_simulado / ingresos_simulados * 100) if ingresos_simulados > 0 else Decimal("0")

        costo_por_kg_actual = costo_total_actual / volumen_actual if volumen_actual > 0 else Decimal("0")
        costo_por_kg_simulado = costo_total_simulado / volumen_simulado if volumen_simulado > 0 else Decimal("0")

        return {
            "parametros_simulacion": {
                "variacion_costos_fijos_pct": float(variacion_costos_fijos),
                "variacion_costos_variables_pct": float(variacion_costos_variables),
                "variacion_volumen_pct": float(variacion_volumen),
                "variacion_precios_pct": float(variacion_precios),
            },
            "escenario_actual": {
                "costos_fijos": float(costos_fijos_actuales),
                "costos_variables": float(costos_variables_actuales),
                "costo_total": float(costo_total_actual),
                "ingresos": float(ingresos_actuales),
                "volumen_kg": float(volumen_actual),
                "margen_bruto": float(margen_actual),
                "margen_porcentaje": float(margen_pct_actual),
                "costo_por_kg": float(costo_por_kg_actual),
            },
            "escenario_simulado": {
                "costos_fijos": float(costos_fijos_simulados),
                "costos_variables": float(costos_variables_simulados),
                "costo_total": float(costo_total_simulado),
                "ingresos": float(ingresos_simulados),
                "volumen_kg": float(volumen_simulado),
                "margen_bruto": float(margen_simulado),
                "margen_porcentaje": float(margen_pct_simulado),
                "costo_por_kg": float(costo_por_kg_simulado),
            },
            "impacto": {
                "cambio_costos_fijos": float(costos_fijos_simulados - costos_fijos_actuales),
                "cambio_costos_variables": float(costos_variables_simulados - costos_variables_actuales),
                "cambio_ingresos": float(ingresos_simulados - ingresos_actuales),
                "cambio_margen_bruto": float(margen_simulado - margen_actual),
                "cambio_margen_pct": float(margen_pct_simulado - margen_pct_actual),
            },
        }

    def simular_punto_equilibrio(self) -> dict:
        """
        Calcula el punto de equilibrio operativo.
        """
        hoy = date.today()

        # Obtener costos fijos mensuales
        costos_fijos = self.get_total_costos_fijos_mes(hoy.month, hoy.year)

        # Obtener precio promedio por kg e ingreso promedio
        resumen = self.get_resumen_costos_mes(hoy.month, hoy.year)

        if resumen.total_kg_procesados > 0:
            precio_promedio_kg = resumen.total_ingresos / resumen.total_kg_procesados
            costo_variable_kg = resumen.total_costos_variables / resumen.total_kg_procesados
        else:
            precio_promedio_kg = self._get_parametro_valor("precio_promedio_kg", Decimal("1500"))
            costo_variable_kg = self._get_parametro_valor("costo_variable_kg", Decimal("600"))

        # Margen de contribución por kg
        margen_contribucion_kg = precio_promedio_kg - costo_variable_kg

        # Punto de equilibrio en kg
        if margen_contribucion_kg > 0:
            punto_equilibrio_kg = costos_fijos / margen_contribucion_kg
            punto_equilibrio_ingresos = punto_equilibrio_kg * precio_promedio_kg
        else:
            punto_equilibrio_kg = Decimal("0")
            punto_equilibrio_ingresos = Decimal("0")

        # Capacidad y cobertura
        capacidad_mes = self._get_parametro_valor("capacidad_kg_mes", Decimal("10000"))
        cobertura_actual = (resumen.total_kg_procesados / punto_equilibrio_kg * 100) if punto_equilibrio_kg > 0 else Decimal("0")
        utilidad_actual = resumen.margen_bruto

        return {
            "costos_fijos_mes": float(costos_fijos),
            "precio_promedio_kg": float(precio_promedio_kg),
            "costo_variable_kg": float(costo_variable_kg),
            "margen_contribucion_kg": float(margen_contribucion_kg),
            "punto_equilibrio_kg": float(punto_equilibrio_kg),
            "punto_equilibrio_ingresos": float(punto_equilibrio_ingresos),
            "volumen_actual_kg": float(resumen.total_kg_procesados),
            "capacidad_mes_kg": float(capacidad_mes),
            "cobertura_punto_equilibrio_pct": float(cobertura_actual),
            "utilidad_sobre_equilibrio": float(utilidad_actual),
        }

    # ==================== ALERTAS DE MARGEN BAJO ====================

    def get_alertas_margen_bajo(
        self,
        margen_minimo: Decimal = Decimal("15"),
        dias_atras: int = 30,
    ) -> list:
        """
        Obtiene alertas de servicios/lotes con margen por debajo del mínimo.

        Args:
            margen_minimo: Margen mínimo aceptable en porcentaje
            dias_atras: Días hacia atrás para analizar

        Returns:
            Lista de alertas con detalles
        """
        alertas = []
        fecha_desde = date.today() - timedelta(days=dias_atras)

        # Alertas de análisis de lotes con margen bajo
        analisis_lotes = self.db.query(AnalisisCostoLote).filter(
            and_(
                AnalisisCostoLote.created_at >= fecha_desde,
                AnalisisCostoLote.margen_porcentaje.isnot(None),
                AnalisisCostoLote.margen_porcentaje < margen_minimo,
            )
        ).all()

        for analisis in analisis_lotes:
            lote = self.db.query(LoteProduccion).filter(LoteProduccion.id == analisis.lote_id).first()

            alertas.append({
                "tipo": "lote_margen_bajo",
                "severidad": "alta" if analisis.margen_porcentaje < 0 else "media",
                "entidad_tipo": "lote",
                "entidad_id": str(analisis.lote_id),
                "entidad_numero": lote.numero if lote else "N/A",
                "descripcion": f"Margen del {float(analisis.margen_porcentaje):.1f}% (mínimo: {float(margen_minimo)}%)",
                "margen_actual": float(analisis.margen_porcentaje),
                "margen_minimo": float(margen_minimo),
                "diferencia": float(analisis.margen_porcentaje - margen_minimo),
                "costo_total": float(analisis.costo_total),
                "ingreso_total": float(analisis.ingreso_total) if analisis.ingreso_total else 0,
                "fecha": analisis.created_at.isoformat(),
            })

        # Alertas de tarifas de servicios con margen bajo
        tarifas = self.db.query(TarifaServicio).filter(
            and_(
                TarifaServicio.activo == True,
                TarifaServicio.margen_objetivo.isnot(None),
            )
        ).all()

        for tarifa in tarifas:
            margen_real = tarifa.margen_real
            if margen_real < margen_minimo:
                servicio = self.db.query(Servicio).filter(Servicio.id == tarifa.servicio_id).first()

                alertas.append({
                    "tipo": "servicio_margen_bajo",
                    "severidad": "alta" if margen_real < 0 else "media",
                    "entidad_tipo": "servicio",
                    "entidad_id": str(tarifa.servicio_id),
                    "entidad_numero": servicio.codigo if servicio else "N/A",
                    "servicio_nombre": servicio.nombre if servicio else "N/A",
                    "descripcion": f"Margen real de {float(margen_real):.1f}% vs objetivo de {float(tarifa.margen_objetivo):.1f}%",
                    "margen_actual": float(margen_real),
                    "margen_objetivo": float(tarifa.margen_objetivo) if tarifa.margen_objetivo else None,
                    "margen_minimo": float(margen_minimo),
                    "costo_total": float(tarifa.costo_total),
                    "precio_sugerido": float(tarifa.precio_sugerido) if tarifa.precio_sugerido else None,
                    "fecha_vigencia": tarifa.fecha_vigencia.isoformat(),
                })

        # Ordenar por severidad y margen
        alertas.sort(key=lambda x: (0 if x["severidad"] == "alta" else 1, x["margen_actual"]))

        return alertas

    def get_resumen_alertas_costos(self) -> dict:
        """
        Obtiene un resumen de todas las alertas de costos.
        """
        margen_minimo = self._get_parametro_valor("margen_minimo", Decimal("15"))

        alertas_margen = self.get_alertas_margen_bajo(margen_minimo=margen_minimo)

        # Contar por tipo y severidad
        por_tipo = {}
        por_severidad = {"alta": 0, "media": 0, "baja": 0}

        for alerta in alertas_margen:
            tipo = alerta["tipo"]
            severidad = alerta["severidad"]

            por_tipo[tipo] = por_tipo.get(tipo, 0) + 1
            por_severidad[severidad] = por_severidad.get(severidad, 0) + 1

        return {
            "total_alertas": len(alertas_margen),
            "por_tipo": por_tipo,
            "por_severidad": por_severidad,
            "margen_minimo_configurado": float(margen_minimo),
            "alertas": alertas_margen[:10],  # Top 10 más críticas
        }
