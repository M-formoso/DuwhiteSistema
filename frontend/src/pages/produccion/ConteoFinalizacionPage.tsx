/**
 * Página de Conteo y Finalización de Lotes
 * Búsqueda por código de producto → cantidad → lista de ítems
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Scale,
  Package,
  Calculator,
  FileText,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Loader2,
  User,
  Clock,
  X,
  Search,
  Keyboard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { produccionService } from '@/services/produccionService';
import { productoLavadoService } from '@/services/productoLavadoService';
import { remitoService } from '@/services/remitoService';
import { clienteService } from '@/services/clienteService';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { ProductoConPrecio } from '@/types/produccion-v2';
import ProductoLookupModal from '@/components/produccion/ProductoLookupModal';

const formatearCodigo = (codigo: string) => {
  const limpio = (codigo || '').trim();
  if (/^\d+$/.test(limpio)) return limpio.padStart(4, '0');
  return limpio;
};

const normalizarCodigo = (codigo: string) => {
  const limpio = (codigo || '').trim();
  if (/^\d+$/.test(limpio)) return String(parseInt(limpio, 10));
  return limpio;
};

interface ConteoItem {
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  precio_unitario: number;
  cantidad: number;
  cantidad_relevado: number;
}

export default function ConteoFinalizacionPage() {
  const { id: loteId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Estado principal
  const [conteoItems, setConteoItems] = useState<ConteoItem[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [tieneRelevado, setTieneRelevado] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  // Por defecto se imprime CON precios. El checkbox del dialog lo invierte:
  // marcar "Imprimir sin precios" → imprimirConPrecios = false.
  const [imprimirConPrecios, setImprimirConPrecios] = useState(true);
  const [showRelevadoInfo, setShowRelevadoInfo] = useState(false);

  // Estado del buscador por código
  const [codigoInput, setCodigoInput] = useState('');
  const [cantidadInput, setCantidadInput] = useState('1');
  const [productoEncontrado, setProductoEncontrado] = useState<ProductoConPrecio | null>(null);
  const [errorCodigo, setErrorCodigo] = useState('');
  const [showLookup, setShowLookup] = useState(false);
  const [showTeclado, setShowTeclado] = useState(false);
  const [campoActivo, setCampoActivo] = useState<'codigo' | 'cantidad'>('codigo');

  const codigoRef = useRef<HTMLInputElement>(null);
  const cantidadRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: lote, isLoading: loadingLote } = useQuery({
    queryKey: ['lote', loteId],
    queryFn: () => produccionService.getLote(loteId!),
    enabled: !!loteId,
  });

  const { data: cliente } = useQuery({
    queryKey: ['cliente', lote?.cliente_id],
    queryFn: () => clienteService.getCliente(lote!.cliente_id!),
    enabled: !!lote?.cliente_id,
  });

  const { data: productosConPrecios = [], isLoading: loadingProductos } = useQuery<ProductoConPrecio[]>({
    queryKey: ['productos-con-precios', cliente?.lista_precios_id],
    queryFn: async () => {
      if (!cliente?.lista_precios_id) return [];
      return productoLavadoService.getProductosConPrecios(cliente.lista_precios_id);
    },
    enabled: !!cliente?.lista_precios_id,
  });

  // Foco inicial en el campo de cantidad (orden: cantidad → código → agregar)
  useEffect(() => {
    if (!loadingProductos) {
      cantidadRef.current?.focus();
      cantidadRef.current?.select();
    }
  }, [loadingProductos]);

  // Resolver producto al escribir el código (acepta con o sin ceros a la izquierda)
  // Devuelve el producto encontrado para encadenar acciones.
  const resolverCodigo = (codigo: string): ProductoConPrecio | null => {
    setErrorCodigo('');
    setProductoEncontrado(null);
    if (!codigo.trim()) return null;

    const buscado = normalizarCodigo(codigo);
    const encontrado = productosConPrecios.find(
      (p) => normalizarCodigo(p.producto_codigo) === buscado
    );
    if (encontrado) {
      setProductoEncontrado(encontrado);
      setErrorCodigo('');
      return encontrado;
    }
    setErrorCodigo(`No se encontró producto con código "${codigo}"`);
    return null;
  };

  // F4 abre el modal de búsqueda (estilo POS viejo)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        setShowLookup(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const seleccionarDesdeLookup = (p: ProductoConPrecio) => {
    setProductoEncontrado(p);
    setCodigoInput(formatearCodigo(p.producto_codigo));
    setErrorCodigo('');
    // El usuario ya completó la cantidad antes de buscar; va directo a agregar.
    setCampoActivo('codigo');
    setTimeout(() => {
      codigoRef.current?.focus();
      codigoRef.current?.select();
    }, 50);
  };

  // Manejo del teclado numérico en pantalla
  const setValorCampoActivo = (updater: (prev: string) => string) => {
    if (campoActivo === 'codigo') {
      setCodigoInput((prev) => {
        const next = updater(prev);
        setProductoEncontrado(null);
        setErrorCodigo('');
        return next;
      });
    } else {
      setCantidadInput((prev) => updater(prev));
    }
  };

  const tecladoTeclear = (d: string) => {
    setValorCampoActivo((prev) => (prev === '0' ? d : prev + d));
  };

  const tecladoBorrar = () => {
    setValorCampoActivo((prev) => prev.slice(0, -1));
  };

  const tecladoLimpiar = () => {
    setValorCampoActivo(() => '');
  };

  const tecladoEnter = () => {
    // Cantidad → saltar a código. Código → resolver y agregar.
    if (campoActivo === 'cantidad') {
      setCampoActivo('codigo');
      codigoRef.current?.focus();
      codigoRef.current?.select();
    } else {
      agregarItem();
    }
  };

  const handleCantidadKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const cantidad = parseInt(cantidadInput) || 0;
      if (cantidad <= 0) {
        toast.error('La cantidad debe ser mayor a 0');
        return;
      }
      setCampoActivo('codigo');
      codigoRef.current?.focus();
      codigoRef.current?.select();
    }
  };

  const handleCodigoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      // Resolver el código y, si encuentra producto, agregar en el mismo Enter.
      const encontrado = resolverCodigo(codigoInput);
      if (encontrado) {
        agregarItemConProducto(encontrado);
      }
    }
  };

  const agregarItemConProducto = (producto: ProductoConPrecio) => {
    const cantidad = parseInt(cantidadInput) || 0;
    if (cantidad <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      setCampoActivo('cantidad');
      cantidadRef.current?.focus();
      cantidadRef.current?.select();
      return;
    }

    setConteoItems((prev) => {
      const existente = prev.find((i) => i.producto_id === producto.producto_id);
      if (existente) {
        return prev.map((i) =>
          i.producto_id === producto.producto_id
            ? { ...i, cantidad: i.cantidad + cantidad }
            : i
        );
      }
      return [
        ...prev,
        {
          producto_id: producto.producto_id,
          producto_codigo: producto.producto_codigo,
          producto_nombre: producto.producto_nombre,
          precio_unitario: producto.precio_unitario || 0,
          cantidad,
          cantidad_relevado: 0,
        },
      ];
    });

    // Reset para siguiente entrada — foco vuelve a Cantidad (orden actual)
    setCodigoInput('');
    setCantidadInput('1');
    setProductoEncontrado(null);
    setErrorCodigo('');
    setCampoActivo('cantidad');
    setTimeout(() => {
      cantidadRef.current?.focus();
      cantidadRef.current?.select();
    }, 0);
  };

  const agregarItem = () => {
    if (productoEncontrado) {
      agregarItemConProducto(productoEncontrado);
      return;
    }
    const encontrado = resolverCodigo(codigoInput);
    if (encontrado) {
      agregarItemConProducto(encontrado);
    }
  };

  const quitarItem = (productoId: string) => {
    setConteoItems((prev) => prev.filter((i) => i.producto_id !== productoId));
  };

  const actualizarCantidad = (productoId: string, cantidad: number) => {
    if (cantidad <= 0) {
      quitarItem(productoId);
      return;
    }
    setConteoItems((prev) =>
      prev.map((i) => (i.producto_id === productoId ? { ...i, cantidad } : i))
    );
  };

  const actualizarRelevado = (productoId: string, cantidad: number) => {
    setConteoItems((prev) =>
      prev.map((i) =>
        i.producto_id === productoId
          ? { ...i, cantidad_relevado: Math.max(0, Math.min(cantidad, i.cantidad)) }
          : i
      )
    );
  };

  // Totales
  const totales = useMemo(() => {
    const totalUnidades = conteoItems.reduce((s, i) => s + i.cantidad, 0);
    const totalRelevado = conteoItems.reduce((s, i) => s + i.cantidad_relevado, 0);
    const totalMonto = conteoItems.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
    return { totalUnidades, totalRelevado, totalMonto };
  }, [conteoItems]);

  // Mutation: Generar remito
  // Dispara la impresión del remito vía iframe oculto.
  // Si el navegador bloquea print() (algunos kioscos / tablets), se abre
  // el PDF en pestaña nueva y el operario presiona imprimir manualmente.
  const imprimirRemitoAuto = async (remitoId: string, conPrecios: boolean = false) => {
    try {
      const blob = await remitoService.getPdfBlob(remitoId, conPrecios);
      const blobUrl = URL.createObjectURL(blob);

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = blobUrl;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            window.open(blobUrl, '_blank');
          }
        }, 300);
        // Cleanup tras dar tiempo al diálogo de impresión
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(blobUrl);
          } catch {
            /* ignore */
          }
        }, 60_000);
      };
    } catch {
      toast.error('No se pudo cargar el PDF del remito para imprimir');
    }
  };

  const generarRemitoMutation = useMutation({
    mutationFn: async () => {
      if (!loteId) throw new Error('No hay lote');
      return remitoService.generarDesdeLote(loteId, {
        notas: observaciones || undefined,
        detalles: conteoItems.map((item) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
        })),
        items_relevado: tieneRelevado
          ? conteoItems
              .filter((item) => item.cantidad_relevado > 0)
              .map((item) => ({
                producto_id: item.producto_id,
                cantidad: item.cantidad_relevado,
              }))
          : undefined,
      });
    },
    onSuccess: (response) => {
      toast.success('Remito generado · imprimiendo...');
      queryClient.invalidateQueries({ queryKey: ['lote', loteId] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      if (response.lote_relevado_id) {
        toast.info(`Se creó lote de relevado: ${response.lote_relevado_numero}`);
      }
      // Dispara impresión y deja navegar; el iframe queda vivo en background.
      imprimirRemitoAuto(response.remito_id, imprimirConPrecios);
      setTimeout(() => navigate('/produccion'), 600);
    },
    onError: (error: unknown) => {
      const e = error as { response?: { data?: { detail?: string } } };
      toast.error(e.response?.data?.detail || 'Error al generar remito');
    },
  });

  // Loading / error states
  if (loadingLote || loadingProductos) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lote) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600">Lote no encontrado</p>
        <Button className="mt-4" onClick={() => navigate('/produccion')}>Volver al Kanban</Button>
      </div>
    );
  }

  if (cliente && !cliente.lista_precios_id) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Volver
          </Button>
          <h1 className="text-2xl font-bold">Conteo — Lote {lote.numero}</h1>
        </div>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6 text-center py-8">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Cliente sin Lista de Precios</h3>
            <p className="text-yellow-700 mb-4">
              "{lote.cliente_nombre}" no tiene lista de precios asignada.
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => navigate('/produccion')}>Volver al Kanban</Button>
              <Button onClick={() => navigate(`/clientes/${lote.cliente_id}/editar`)}>Editar Cliente</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Volver</span>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="h-5 w-5 flex-shrink-0" />
            Conteo y Finalización
          </h1>
          <p className="text-gray-500 text-sm">Lote {lote.numero} — {lote.cliente_nombre}</p>
        </div>
      </div>

      {/* Info del lote */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="font-medium text-sm">{lote.cliente_nombre}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Peso entrada</p>
                <p className="font-medium text-sm">{formatNumber(Number(lote.peso_entrada_kg), 2)} kg</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Ingreso</p>
                <p className="font-medium text-sm">{new Date(lote.fecha_ingreso).toLocaleDateString('es-AR')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Canastos</p>
                <p className="font-medium text-sm">{lote.canastos?.length || 0}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buscador por código — interfaz tipo POS */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Agregar ítem por código
            </span>
            <button
              type="button"
              onClick={() => setShowTeclado((v) => !v)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                showTeclado
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
              title="Mostrar / ocultar teclado en pantalla (tablets)"
            >
              <Keyboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Teclado</span>
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            {/* Cantidad — primero */}
            <div className="w-full sm:w-28">
              <Label className="text-xs text-gray-500 mb-1 block">Cantidad</Label>
              <Input
                ref={cantidadRef}
                type="number"
                min={1}
                value={cantidadInput}
                onChange={(e) => setCantidadInput(e.target.value)}
                onFocus={(e) => { setCampoActivo('cantidad'); e.currentTarget.select(); }}
                onKeyDown={handleCantidadKeyDown}
                className="text-lg text-center"
                inputMode={showTeclado ? 'none' : 'numeric'}
              />
            </div>

            {/* Código — a la derecha de cantidad */}
            <div className="w-full sm:w-32">
              <Label className="text-xs text-gray-500 mb-1 block">Código</Label>
              <Input
                ref={codigoRef}
                value={codigoInput}
                onChange={(e) => {
                  setCodigoInput(e.target.value);
                  setProductoEncontrado(null);
                  setErrorCodigo('');
                }}
                onFocus={() => setCampoActivo('codigo')}
                onKeyDown={handleCodigoKeyDown}
                onBlur={() => resolverCodigo(codigoInput)}
                placeholder="Ej: 1"
                className="text-lg font-mono text-center"
                autoComplete="off"
                inputMode={showTeclado ? 'none' : 'numeric'}
              />
            </div>

            {/* Botón abrir lookup (F4) */}
            <div className="w-full sm:w-auto">
              <Label className="text-xs text-gray-500 mb-1 block sm:invisible">F4</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowLookup(true)}
                className="w-full sm:w-auto h-10 gap-1"
                title="Buscar artículo (F4)"
              >
                <Search className="h-4 w-4" />
                <span className="sm:hidden">Buscar artículo</span>
                <kbd className="hidden sm:inline-block px-1 py-0.5 bg-gray-100 rounded text-[10px] ml-1">F4</kbd>
              </Button>
            </div>

            {/* Nombre del producto (resuelto) */}
            <div className="flex-1">
              <Label className="text-xs text-gray-500 mb-1 block">Producto</Label>
              <div
                className={`h-10 flex items-center px-3 rounded-md border text-sm font-medium
                  ${productoEncontrado
                    ? 'border-green-400 bg-green-50 text-green-800'
                    : errorCodigo
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-gray-50 text-gray-400'
                  }`}
              >
                {productoEncontrado
                  ? productoEncontrado.producto_nombre
                  : errorCodigo
                  ? errorCodigo
                  : 'Ingrese cantidad, después el código y presione Enter (o F4 para buscar)'}
              </div>
            </div>

            {/* Precio */}
            {productoEncontrado && (
              <div className="w-28 hidden sm:block">
                <Label className="text-xs text-gray-500 mb-1 block">Precio unit.</Label>
                <div className="h-10 flex items-center px-3 rounded-md border border-gray-200 bg-gray-50 text-sm">
                  {formatCurrency(productoEncontrado.precio_unitario)}
                </div>
              </div>
            )}

            {/* Botón agregar */}
            <Button
              onClick={agregarItem}
              disabled={!productoEncontrado && !codigoInput.trim()}
              className="w-full sm:w-auto h-10"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Agregar
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Tip: <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">Enter</kbd> en la cantidad pasa al código, <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">Enter</kbd> en el código agrega el ítem, <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">F4</kbd> abre la lista.
          </p>

          {/* Teclado numérico en pantalla (tablets) */}
          {showTeclado && (
            <div className="mt-4 max-w-xs mx-auto">
              <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
                <span>
                  Editando:{' '}
                  <span className="font-semibold text-gray-800">
                    {campoActivo === 'codigo' ? 'Código' : 'Cantidad'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={tecladoLimpiar}
                  className="px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                >
                  Limpiar
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 select-none">
                {(['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => tecladoTeclear(d)}
                    className="h-12 rounded-md border border-gray-300 bg-white text-xl font-bold text-gray-800 active:bg-gray-200 active:scale-95 transition"
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={tecladoBorrar}
                  className="h-12 rounded-md border border-gray-300 bg-white text-base font-semibold text-gray-700 active:bg-gray-200 active:scale-95 transition"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => tecladoTeclear('0')}
                  className="h-12 rounded-md border border-gray-300 bg-white text-xl font-bold text-gray-800 active:bg-gray-200 active:scale-95 transition"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={tecladoEnter}
                  className="h-12 rounded-md border border-primary bg-primary text-base font-semibold text-white active:scale-95 transition"
                >
                  ↵
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabla de ítems agregados */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Ítems del conteo</span>
            <Badge variant="secondary">{conteoItems.length} productos</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {conteoItems.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Todavía no se agregaron ítems</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">Cód.</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right w-24">Precio</TableHead>
                  <TableHead className="text-center w-28">Cantidad</TableHead>
                  {tieneRelevado && (
                    <TableHead className="text-center w-28">Relevado</TableHead>
                  )}
                  <TableHead className="text-right w-28">Subtotal</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conteoItems.map((item) => (
                  <TableRow key={item.producto_id}>
                    <TableCell className="text-center font-mono text-sm font-medium">
                      {formatearCodigo(item.producto_codigo)}
                    </TableCell>
                    <TableCell className="font-medium">{item.producto_nombre}</TableCell>
                    <TableCell className="text-right text-sm text-gray-600">
                      {formatCurrency(item.precio_unitario)}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={item.cantidad}
                        onChange={(e) =>
                          actualizarCantidad(item.producto_id, parseInt(e.target.value) || 0)
                        }
                        className="w-full text-center"
                      />
                    </TableCell>
                    {tieneRelevado && (
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={item.cantidad}
                          value={item.cantidad_relevado}
                          onChange={(e) =>
                            actualizarRelevado(item.producto_id, parseInt(e.target.value) || 0)
                          }
                          className="w-full text-center border-purple-300"
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.cantidad * item.precio_unitario)}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => quitarItem(item.producto_id)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resumen y acciones */}
      <Card className="border-2 border-primary">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-base">
            <span>Resumen del conteo</span>
            <div className="flex items-center gap-2">
              <Checkbox
                id="relevado"
                checked={tieneRelevado}
                onCheckedChange={(checked) => {
                  setTieneRelevado(!!checked);
                  if (!checked) {
                    setConteoItems((prev) =>
                      prev.map((item) => ({ ...item, cantidad_relevado: 0 }))
                    );
                  }
                }}
              />
              <Label htmlFor="relevado" className="text-sm font-normal flex items-center gap-1 cursor-pointer">
                <RotateCcw className="h-4 w-4 text-purple-600" />
                Hay prendas para relevado
              </Label>
              <button
                onClick={() => setShowRelevadoInfo(true)}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <AlertTriangle className="h-4 w-4" />
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-600">Total unidades</p>
              <p className="text-3xl font-bold text-blue-700">{totales.totalUnidades}</p>
            </div>
            {tieneRelevado && (
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-xs text-purple-600">Para relevado</p>
                <p className="text-3xl font-bold text-purple-700">{totales.totalRelevado}</p>
              </div>
            )}
            <div className="text-center p-4 bg-green-50 rounded-lg col-span-2 sm:col-span-1">
              <p className="text-xs text-green-600">Total a facturar</p>
              <p className="text-2xl font-bold text-green-700 break-all">
                {formatCurrency(totales.totalMonto)}
              </p>
            </div>
          </div>

          <div>
            <Label className="text-sm">Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas para el remito..."
              rows={2}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              className="flex-1"
              size="lg"
              onClick={() => {
                if (totales.totalUnidades === 0) {
                  toast.error('Debe contar al menos una prenda');
                  return;
                }
                setShowConfirmDialog(true);
              }}
              disabled={generarRemitoMutation.isPending || totales.totalUnidades === 0}
            >
              {generarRemitoMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Generar Remito y Finalizar
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmación */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar generación de remito</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                  <p><strong>Total unidades:</strong> {totales.totalUnidades}</p>
                  <p><strong>Total a facturar:</strong> {formatCurrency(totales.totalMonto)}</p>
                  {tieneRelevado && totales.totalRelevado > 0 && (
                    <p className="text-purple-600">
                      <strong>Para relevado:</strong> {totales.totalRelevado} unidades (se crea nuevo lote)
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-2 p-3 border border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                  <Checkbox
                    checked={!imprimirConPrecios}
                    onCheckedChange={(v) => setImprimirConPrecios(v !== true)}
                  />
                  <span>
                    <strong>Imprimir sin precios</strong>
                    <span className="block text-xs text-gray-500">
                      Por defecto el remito sale con precios (subtotal por ítem y TOTAL al pie). Marcá para imprimir sin precios.
                    </span>
                  </span>
                </label>
                <p className="text-gray-500">Esta acción generará un cargo en la cuenta corriente del cliente.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowConfirmDialog(false); generarRemitoMutation.mutate(); }}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal F4: lookup de productos */}
      <ProductoLookupModal
        open={showLookup}
        onClose={() => setShowLookup(false)}
        productos={productosConPrecios}
        onSelect={seleccionarDesdeLookup}
      />

      {/* Info relevado */}
      <Dialog open={showRelevadoInfo} onOpenChange={setShowRelevadoInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-purple-600" />
              ¿Qué es el Relevado?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-gray-600">
            <p>El <strong>relevado</strong> permite re-lavar prendas que no quedaron correctamente.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Se genera un remito parcial con las prendas OK</li>
              <li>Se crea automáticamente un nuevo lote con las prendas marcadas</li>
              <li>El nuevo lote vuelve a la etapa de Lavado</li>
            </ul>
            <p className="text-purple-600 font-medium">El cliente paga una sola vez.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowRelevadoInfo(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
