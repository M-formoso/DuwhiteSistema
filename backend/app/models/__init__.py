# Models module
# Importar todos los modelos aquí para que Alembic los detecte

# Auth
from app.models.usuario import Usuario
from app.models.log_actividad import LogActividad

# Stock
from app.models.categoria_insumo import CategoriaInsumo
from app.models.insumo import Insumo
from app.models.movimiento_stock import MovimientoStock, TipoMovimiento, OrigenMovimiento

# Proveedores
from app.models.proveedor import Proveedor
from app.models.producto_proveedor import ProductoProveedor
from app.models.historial_precios_proveedor import HistorialPreciosProveedor
from app.models.orden_compra import (
    OrdenCompra,
    OrdenCompraDetalle,
    RecepcionCompra,
    RecepcionCompraDetalle,
    EstadoOrdenCompra,
)

# Producción
from app.models.etapa_produccion import EtapaProduccion
from app.models.maquina import Maquina
from app.models.lote_produccion import (
    LoteProduccion,
    LoteEtapa,
    ConsumoInsumoLote,
    EstadoLote,
    PrioridadLote,
    TipoServicio as TipoServicioLote,
)

# Clientes
from app.models.cliente import Cliente, TipoCliente, CondicionIVA
from app.models.pedido import Pedido, DetallePedido, EstadoPedido, TipoEntrega
from app.models.cuenta_corriente import (
    MovimientoCuentaCorriente,
    Recibo,
    DetalleRecibo,
    TipoMovimientoCC,
    MedioPago,
)
from app.models.lista_precios import (
    ListaPrecios,
    Servicio,
    ItemListaPrecios,
    TipoServicio,
    UnidadCobro,
)

# Finanzas
from app.models.caja import (
    Caja,
    MovimientoCaja,
    GastoRecurrente,
    EstadoCaja,
    TipoMovimientoCaja,
    CategoriaMovimiento,
)
from app.models.cuenta_bancaria import (
    CuentaBancaria,
    MovimientoBancario,
    TipoCuenta,
    TipoMovimientoBanco,
)

# Empleados
from app.models.empleado import (
    Empleado,
    Asistencia,
    JornadaLaboral,
    MovimientoNomina,
    Liquidacion,
    TipoEmpleado,
    TipoContrato,
    EstadoEmpleado,
    TipoAsistencia,
    TipoMovimientoNomina,
)

# Costos
from app.models.costo import (
    CostoFijo,
    CostoVariable,
    TarifaServicio,
    AnalisisCostoLote,
    ParametroCosto,
    TipoCosto,
    CategoriaCosto,
)
