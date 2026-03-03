"""
Endpoint para cargar datos de prueba.
Solo accesible por superadmin.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_permission
from app.models.usuario import Usuario
from app.models.cliente import Cliente
from app.models.insumo import Insumo
from app.models.categoria_insumo import CategoriaInsumo
from app.models.proveedor import Proveedor
from app.models.empleado import Empleado
from app.models.etapa_produccion import EtapaProduccion
from app.models.maquina import Maquina
from app.models.costo import CostoFijo, ParametroCosto
from app.schemas.common import MessageResponse

router = APIRouter()


@router.post("/datos-prueba", response_model=MessageResponse)
def cargar_datos_prueba(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("admin", "crear")),
):
    """
    Carga datos de prueba en la base de datos.
    Solo para desarrollo/demo.
    """
    try:
        # Verificar si ya hay datos
        clientes_existentes = db.query(Cliente).count()
        if clientes_existentes > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existen datos en la base de datos. Operación cancelada.",
            )

        # ==================== CATEGORÍAS DE INSUMOS ====================
        categorias = [
            CategoriaInsumo(
                id=uuid4(),
                codigo="QUIM",
                nombre="Productos Químicos",
                descripcion="Detergentes, blanqueadores, suavizantes",
                color="#3B82F6",
                orden=1,
            ),
            CategoriaInsumo(
                id=uuid4(),
                codigo="EMBA",
                nombre="Embalaje",
                descripcion="Bolsas, cajas, film",
                color="#10B981",
                orden=2,
            ),
            CategoriaInsumo(
                id=uuid4(),
                codigo="MANT",
                nombre="Mantenimiento",
                descripcion="Repuestos y materiales de mantenimiento",
                color="#F59E0B",
                orden=3,
            ),
            CategoriaInsumo(
                id=uuid4(),
                codigo="LIMP",
                nombre="Limpieza General",
                descripcion="Productos de limpieza de instalaciones",
                color="#8B5CF6",
                orden=4,
            ),
        ]
        for cat in categorias:
            db.add(cat)
        db.flush()

        # ==================== PROVEEDORES ====================
        proveedores = [
            Proveedor(
                id=uuid4(),
                codigo="P001",
                razon_social="Química Industrial del Centro S.A.",
                nombre_fantasia="QuimiCentro",
                cuit="30-71234567-8",
                condicion_iva="responsable_inscripto",
                email="ventas@quimicentro.com.ar",
                telefono="0351-4567890",
                direccion="Av. Colón 1234",
                ciudad="Córdoba",
                provincia="Córdoba",
                rubro="quimicos",
                notas="Proveedor principal de químicos",
            ),
            Proveedor(
                id=uuid4(),
                codigo="P002",
                razon_social="Distribuidora de Embalajes Córdoba S.R.L.",
                nombre_fantasia="EmbalaCBA",
                cuit="30-72345678-9",
                condicion_iva="responsable_inscripto",
                email="pedidos@embalacba.com",
                telefono="0351-5678901",
                direccion="Ruta 9 Norte Km 5",
                ciudad="Córdoba",
                provincia="Córdoba",
                rubro="embalaje",
            ),
            Proveedor(
                id=uuid4(),
                codigo="P003",
                razon_social="Técnica Lavandera Argentina",
                nombre_fantasia="TecLav",
                cuit="30-73456789-0",
                condicion_iva="responsable_inscripto",
                email="info@teclav.com.ar",
                telefono="011-4567-8901",
                direccion="Av. Rivadavia 5678",
                ciudad="CABA",
                provincia="Buenos Aires",
                rubro="maquinaria",
                notas="Servicio técnico y repuestos de máquinas",
            ),
        ]
        for prov in proveedores:
            db.add(prov)
        db.flush()

        # ==================== INSUMOS ====================
        insumos = [
            Insumo(
                id=uuid4(),
                codigo="INS001",
                nombre="Detergente Industrial Concentrado",
                categoria_id=categorias[0].id,
                unidad="litros",
                stock_actual=Decimal("150"),
                stock_minimo=Decimal("50"),
                stock_maximo=Decimal("300"),
                precio_unitario_costo=Decimal("850"),
                proveedor_habitual_id=proveedores[0].id,
                ubicacion_deposito="Estante A1",
            ),
            Insumo(
                id=uuid4(),
                codigo="INS002",
                nombre="Blanqueador con Cloro",
                categoria_id=categorias[0].id,
                unidad="litros",
                stock_actual=Decimal("80"),
                stock_minimo=Decimal("30"),
                stock_maximo=Decimal("200"),
                precio_unitario_costo=Decimal("650"),
                proveedor_habitual_id=proveedores[0].id,
                ubicacion_deposito="Estante A2",
            ),
            Insumo(
                id=uuid4(),
                codigo="INS003",
                nombre="Suavizante Textil Premium",
                categoria_id=categorias[0].id,
                unidad="litros",
                stock_actual=Decimal("100"),
                stock_minimo=Decimal("40"),
                stock_maximo=Decimal("250"),
                precio_unitario_costo=Decimal("720"),
                proveedor_habitual_id=proveedores[0].id,
                ubicacion_deposito="Estante A3",
            ),
            Insumo(
                id=uuid4(),
                codigo="INS004",
                nombre="Quitamanchas Enzimático",
                categoria_id=categorias[0].id,
                unidad="litros",
                stock_actual=Decimal("25"),
                stock_minimo=Decimal("20"),
                stock_maximo=Decimal("100"),
                precio_unitario_costo=Decimal("1200"),
                proveedor_habitual_id=proveedores[0].id,
                ubicacion_deposito="Estante A4",
            ),
            Insumo(
                id=uuid4(),
                codigo="INS005",
                nombre="Bolsa Plástica 60x90",
                categoria_id=categorias[1].id,
                unidad="unidades",
                stock_actual=Decimal("500"),
                stock_minimo=Decimal("200"),
                stock_maximo=Decimal("1000"),
                precio_unitario_costo=Decimal("15"),
                proveedor_habitual_id=proveedores[1].id,
                ubicacion_deposito="Estante B1",
            ),
            Insumo(
                id=uuid4(),
                codigo="INS006",
                nombre="Film Stretch Rollo 500m",
                categoria_id=categorias[1].id,
                unidad="rollos",
                stock_actual=Decimal("8"),
                stock_minimo=Decimal("5"),
                stock_maximo=Decimal("20"),
                precio_unitario_costo=Decimal("4500"),
                proveedor_habitual_id=proveedores[1].id,
                ubicacion_deposito="Estante B2",
            ),
            Insumo(
                id=uuid4(),
                codigo="INS007",
                nombre="Correa Lavadora Industrial",
                categoria_id=categorias[2].id,
                unidad="unidades",
                stock_actual=Decimal("3"),
                stock_minimo=Decimal("2"),
                stock_maximo=Decimal("10"),
                precio_unitario_costo=Decimal("8500"),
                proveedor_habitual_id=proveedores[2].id,
                ubicacion_deposito="Depósito Mantenimiento",
            ),
            Insumo(
                id=uuid4(),
                codigo="INS008",
                nombre="Filtro Secadora",
                categoria_id=categorias[2].id,
                unidad="unidades",
                stock_actual=Decimal("5"),
                stock_minimo=Decimal("3"),
                stock_maximo=Decimal("15"),
                precio_unitario_costo=Decimal("3200"),
                proveedor_habitual_id=proveedores[2].id,
                ubicacion_deposito="Depósito Mantenimiento",
            ),
        ]
        for insumo in insumos:
            db.add(insumo)
        db.flush()

        # ==================== CLIENTES ====================
        clientes = [
            Cliente(
                id=uuid4(),
                codigo="C001",
                tipo="hotel",
                razon_social="Hotel Sheraton Córdoba",
                nombre_fantasia="Sheraton",
                cuit="30-65432100-1",
                condicion_iva="responsable_inscripto",
                email="servicios@sheraton-cba.com",
                telefono="0351-5261000",
                celular="351-1234567",
                contacto_nombre="María García",
                contacto_cargo="Gerente de Operaciones",
                direccion="Av. San Juan 165",
                ciudad="Córdoba",
                provincia="Córdoba",
                codigo_postal="5000",
                descuento_general=Decimal("10"),
                limite_credito=Decimal("500000"),
                dias_credito=30,
                dia_retiro_preferido="lunes",
                horario_retiro_preferido="8:00 - 10:00",
                requiere_factura=True,
                fecha_alta=date.today() - timedelta(days=365),
            ),
            Cliente(
                id=uuid4(),
                codigo="C002",
                tipo="hotel",
                razon_social="Amérian Córdoba Park Hotel",
                nombre_fantasia="Amérian Park",
                cuit="30-65432101-2",
                condicion_iva="responsable_inscripto",
                email="ropa@amerian.com",
                telefono="0351-5200000",
                contacto_nombre="Carlos López",
                direccion="Bv. San Juan 137",
                ciudad="Córdoba",
                provincia="Córdoba",
                codigo_postal="5000",
                descuento_general=Decimal("8"),
                limite_credito=Decimal("350000"),
                dias_credito=30,
                requiere_factura=True,
                fecha_alta=date.today() - timedelta(days=200),
            ),
            Cliente(
                id=uuid4(),
                codigo="C003",
                tipo="restaurante",
                razon_social="La Mamma Pasta S.R.L.",
                nombre_fantasia="La Mamma",
                cuit="30-71234568-9",
                condicion_iva="responsable_inscripto",
                email="admin@lamamma.com.ar",
                telefono="0351-4251234",
                direccion="Av. Rafael Núñez 4320",
                ciudad="Córdoba",
                provincia="Córdoba",
                descuento_general=Decimal("5"),
                limite_credito=Decimal("100000"),
                dias_credito=15,
                requiere_factura=True,
                fecha_alta=date.today() - timedelta(days=150),
            ),
            Cliente(
                id=uuid4(),
                codigo="C004",
                tipo="hospital",
                razon_social="Sanatorio Allende S.A.",
                nombre_fantasia="Sanatorio Allende",
                cuit="30-50123456-7",
                condicion_iva="responsable_inscripto",
                email="compras@sanatorioallende.com.ar",
                telefono="0351-4269200",
                celular="351-5678901",
                contacto_nombre="Ana Martínez",
                contacto_cargo="Jefa de Compras",
                direccion="Av. Hipólito Yrigoyen 384",
                ciudad="Córdoba",
                provincia="Córdoba",
                codigo_postal="5000",
                descuento_general=Decimal("12"),
                limite_credito=Decimal("800000"),
                dias_credito=45,
                dia_retiro_preferido="martes",
                horario_retiro_preferido="7:00 - 9:00",
                requiere_factura=True,
                fecha_alta=date.today() - timedelta(days=500),
                notas="Cliente prioritario - requiere servicio rápido",
            ),
            Cliente(
                id=uuid4(),
                codigo="C005",
                tipo="gimnasio",
                razon_social="Fitness Center Córdoba",
                nombre_fantasia="FitCenter",
                cuit="20-32145678-9",
                condicion_iva="monotributo",
                email="info@fitcentercba.com",
                telefono="0351-4891234",
                direccion="Av. Colón 2345",
                ciudad="Córdoba",
                provincia="Córdoba",
                descuento_general=Decimal("0"),
                limite_credito=Decimal("50000"),
                dias_credito=15,
                fecha_alta=date.today() - timedelta(days=90),
            ),
            Cliente(
                id=uuid4(),
                codigo="C006",
                tipo="particular",
                razon_social="Juan Pérez",
                condicion_iva="consumidor_final",
                email="juan.perez@gmail.com",
                celular="351-9876543",
                direccion="Bv. Los Alemanes 1234",
                ciudad="Córdoba",
                provincia="Córdoba",
                fecha_alta=date.today() - timedelta(days=30),
            ),
            Cliente(
                id=uuid4(),
                codigo="C007",
                tipo="empresa",
                razon_social="Textiles del Sur S.A.",
                nombre_fantasia="TexSur",
                cuit="30-70987654-3",
                condicion_iva="responsable_inscripto",
                email="produccion@texsur.com.ar",
                telefono="0351-4567123",
                direccion="Parque Industrial Ferreyra",
                ciudad="Ferreyra",
                provincia="Córdoba",
                descuento_general=Decimal("15"),
                limite_credito=Decimal("1000000"),
                dias_credito=60,
                requiere_factura=True,
                fecha_alta=date.today() - timedelta(days=400),
                notas="Cliente mayorista - grandes volúmenes",
            ),
        ]
        for cliente in clientes:
            db.add(cliente)
        db.flush()

        # ==================== EMPLEADOS ====================
        empleados = [
            Empleado(
                id=uuid4(),
                legajo="EMP001",
                nombre="Roberto",
                apellido="Fernández",
                dni="25678901",
                cuil="20-25678901-3",
                email="roberto.fernandez@duwhite.com",
                telefono="351-1112233",
                direccion="Barrio Alta Córdoba",
                ciudad="Córdoba",
                fecha_nacimiento=date(1985, 3, 15),
                fecha_ingreso=date(2018, 6, 1),
                cargo="Jefe de Producción",
                area="produccion",
                tipo_contrato="efectivo",
                salario_base=Decimal("450000"),
                estado="activo",
            ),
            Empleado(
                id=uuid4(),
                legajo="EMP002",
                nombre="Laura",
                apellido="Gómez",
                dni="30456789",
                cuil="27-30456789-4",
                email="laura.gomez@duwhite.com",
                telefono="351-2223344",
                fecha_nacimiento=date(1990, 7, 22),
                fecha_ingreso=date(2020, 3, 15),
                cargo="Operaria de Lavado",
                area="produccion",
                tipo_contrato="efectivo",
                salario_base=Decimal("280000"),
                estado="activo",
            ),
            Empleado(
                id=uuid4(),
                legajo="EMP003",
                nombre="Martín",
                apellido="Silva",
                dni="32789012",
                cuil="20-32789012-5",
                telefono="351-3334455",
                fecha_nacimiento=date(1992, 11, 8),
                fecha_ingreso=date(2021, 8, 1),
                cargo="Operario de Secado",
                area="produccion",
                tipo_contrato="efectivo",
                salario_base=Decimal("280000"),
                estado="activo",
            ),
            Empleado(
                id=uuid4(),
                legajo="EMP004",
                nombre="Valentina",
                apellido="Ruiz",
                dni="35123456",
                cuil="27-35123456-6",
                email="valentina.ruiz@duwhite.com",
                telefono="351-4445566",
                fecha_nacimiento=date(1995, 4, 30),
                fecha_ingreso=date(2022, 2, 1),
                cargo="Administrativa Comercial",
                area="comercial",
                tipo_contrato="efectivo",
                salario_base=Decimal("320000"),
                estado="activo",
            ),
            Empleado(
                id=uuid4(),
                legajo="EMP005",
                nombre="Diego",
                apellido="Moreno",
                dni="28901234",
                cuil="20-28901234-7",
                telefono="351-5556677",
                fecha_nacimiento=date(1988, 9, 12),
                fecha_ingreso=date(2019, 11, 15),
                cargo="Chofer de Reparto",
                area="logistica",
                tipo_contrato="efectivo",
                salario_base=Decimal("300000"),
                estado="activo",
            ),
        ]
        for emp in empleados:
            db.add(emp)
        db.flush()

        # ==================== ETAPAS DE PRODUCCIÓN ====================
        etapas = [
            EtapaProduccion(
                id=uuid4(),
                codigo="RECEP",
                nombre="Recepción",
                descripcion="Recepción y clasificación de prendas",
                orden=1,
                color="#6366F1",
                tiempo_estimado_minutos=30,
                requiere_maquina=False,
            ),
            EtapaProduccion(
                id=uuid4(),
                codigo="LAVADO",
                nombre="Lavado",
                descripcion="Proceso de lavado según tipo de prenda",
                orden=2,
                color="#3B82F6",
                tiempo_estimado_minutos=90,
                requiere_maquina=True,
            ),
            EtapaProduccion(
                id=uuid4(),
                codigo="SECADO",
                nombre="Secado",
                descripcion="Secado industrial",
                orden=3,
                color="#F59E0B",
                tiempo_estimado_minutos=60,
                requiere_maquina=True,
            ),
            EtapaProduccion(
                id=uuid4(),
                codigo="PLANCH",
                nombre="Planchado",
                descripcion="Planchado y terminación",
                orden=4,
                color="#10B981",
                tiempo_estimado_minutos=45,
                requiere_maquina=True,
            ),
            EtapaProduccion(
                id=uuid4(),
                codigo="EMBAL",
                nombre="Embalaje",
                descripcion="Empaque y etiquetado",
                orden=5,
                color="#8B5CF6",
                tiempo_estimado_minutos=20,
                requiere_maquina=False,
            ),
            EtapaProduccion(
                id=uuid4(),
                codigo="LISENT",
                nombre="Listo para Entrega",
                descripcion="Lote listo para entregar al cliente",
                orden=6,
                color="#22C55E",
                tiempo_estimado_minutos=0,
                requiere_maquina=False,
                es_etapa_final=True,
            ),
        ]
        for etapa in etapas:
            db.add(etapa)
        db.flush()

        # ==================== MÁQUINAS ====================
        maquinas = [
            Maquina(
                id=uuid4(),
                codigo="LAV01",
                nombre="Lavadora Industrial 50kg",
                tipo="lavadora",
                marca="Milnor",
                modelo="36026V6J",
                capacidad_kg=Decimal("50"),
                estado="operativa",
                ubicacion="Sala de Lavado",
            ),
            Maquina(
                id=uuid4(),
                codigo="LAV02",
                nombre="Lavadora Industrial 35kg",
                tipo="lavadora",
                marca="Milnor",
                modelo="30022T6X",
                capacidad_kg=Decimal("35"),
                estado="operativa",
                ubicacion="Sala de Lavado",
            ),
            Maquina(
                id=uuid4(),
                codigo="SEC01",
                nombre="Secadora Industrial 50kg",
                tipo="secadora",
                marca="Chicago Dryer",
                modelo="CT50",
                capacidad_kg=Decimal("50"),
                estado="operativa",
                ubicacion="Sala de Secado",
            ),
            Maquina(
                id=uuid4(),
                codigo="SEC02",
                nombre="Secadora Industrial 35kg",
                tipo="secadora",
                marca="Chicago Dryer",
                modelo="CT35",
                capacidad_kg=Decimal("35"),
                estado="operativa",
                ubicacion="Sala de Secado",
            ),
            Maquina(
                id=uuid4(),
                codigo="PLA01",
                nombre="Planchadora de Rodillo",
                tipo="planchadora",
                marca="Girbau",
                modelo="PB5120",
                estado="operativa",
                ubicacion="Sala de Planchado",
            ),
            Maquina(
                id=uuid4(),
                codigo="PLA02",
                nombre="Plancha Manual Industrial",
                tipo="planchadora",
                marca="Veit",
                modelo="8380",
                estado="operativa",
                ubicacion="Sala de Planchado",
            ),
        ]
        for maq in maquinas:
            db.add(maq)
        db.flush()

        # ==================== COSTOS FIJOS ====================
        costos_fijos = [
            CostoFijo(
                id=uuid4(),
                nombre="Alquiler Local",
                categoria="infraestructura",
                monto_mensual=Decimal("450000"),
                fecha_inicio=date(2024, 1, 1),
                notas="Contrato anual renovable",
            ),
            CostoFijo(
                id=uuid4(),
                nombre="Servicio de Luz",
                categoria="servicios",
                monto_mensual=Decimal("180000"),
                fecha_inicio=date(2024, 1, 1),
            ),
            CostoFijo(
                id=uuid4(),
                nombre="Servicio de Gas",
                categoria="servicios",
                monto_mensual=Decimal("120000"),
                fecha_inicio=date(2024, 1, 1),
            ),
            CostoFijo(
                id=uuid4(),
                nombre="Servicio de Agua",
                categoria="servicios",
                monto_mensual=Decimal("45000"),
                fecha_inicio=date(2024, 1, 1),
            ),
            CostoFijo(
                id=uuid4(),
                nombre="Internet y Telefonía",
                categoria="servicios",
                monto_mensual=Decimal("25000"),
                fecha_inicio=date(2024, 1, 1),
            ),
            CostoFijo(
                id=uuid4(),
                nombre="Seguro Integral",
                categoria="seguros",
                monto_mensual=Decimal("85000"),
                fecha_inicio=date(2024, 1, 1),
            ),
            CostoFijo(
                id=uuid4(),
                nombre="Mantenimiento Preventivo",
                categoria="mantenimiento",
                monto_mensual=Decimal("60000"),
                fecha_inicio=date(2024, 1, 1),
            ),
        ]
        for costo in costos_fijos:
            db.add(costo)
        db.flush()

        # ==================== PARÁMETROS DE COSTO ====================
        parametros = [
            ParametroCosto(
                id=uuid4(),
                clave="costo_kwh",
                valor="150",
                descripcion="Costo por kWh de energía eléctrica",
                categoria="energia",
            ),
            ParametroCosto(
                id=uuid4(),
                clave="costo_m3_agua",
                valor="85",
                descripcion="Costo por m³ de agua",
                categoria="servicios",
            ),
            ParametroCosto(
                id=uuid4(),
                clave="factor_mano_obra",
                valor="650",
                descripcion="Costo hora mano de obra promedio",
                categoria="mano_obra",
            ),
            ParametroCosto(
                id=uuid4(),
                clave="capacidad_kg_mes",
                valor="15000",
                descripcion="Capacidad de procesamiento mensual en kg",
                categoria="produccion",
            ),
        ]
        for param in parametros:
            db.add(param)

        db.commit()

        return MessageResponse(
            message=f"Datos de prueba cargados correctamente: {len(clientes)} clientes, {len(insumos)} insumos, {len(proveedores)} proveedores, {len(empleados)} empleados, {len(etapas)} etapas, {len(maquinas)} máquinas"
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al cargar datos de prueba: {str(e)}",
        )
