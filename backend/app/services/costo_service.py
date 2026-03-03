"""
Servicio de Costos para DUWHITE ERP
"""

from datetime import date, datetime
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
