/**
 * Generar remito manual — sin flujo de producción.
 *
 * El operador elige un cliente, agrega los ítems con cantidad y precio
 * (mismo mecanismo que la pantalla de Conteo) y confirma. El backend crea
 * un lote sombra + el remito + el cargo en cuenta corriente.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calculator,
  CheckCircle,
  FileText,
  Loader2,
  Search,
  User,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { toast } from 'sonner';
import { clienteService } from '@/services/clienteService';
import { productoLavadoService } from '@/services/productoLavadoService';
import { remitoService } from '@/services/remitoService';
import { formatCurrency } from '@/utils/formatters';
import { ProductoConPrecio } from '@/types/produccion-v2';
import ProductoLookupModal from '@/components/produccion/ProductoLookupModal';

const normalizarCodigo = (codigo: string) => {
  const limpio = (codigo || '').trim();
  if (/^\d+$/.test(limpio)) return String(parseInt(limpio, 10));
  return limpio;
};

interface Item {
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  precio_unitario: number;
  cantidad: number;
}

export default function RemitoManualPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [clienteId, setClienteId] = useState<string>('');
  const [items, setItems] = useState<Item[]>([]);
  const [cantidadInput, setCantidadInput] = useState('1');
  const [codigoInput, setCodigoInput] = useState('');
  const [productoEncontrado, setProductoEncontrado] = useState<ProductoConPrecio | null>(null);
  const [errorCodigo, setErrorCodigo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [imprimirConPrecios, setImprimirConPrecios] = useState(true);
  const [showLookup, setShowLookup] = useState(false);

  const cantidadRef = useRef<HTMLInputElement>(null);
  const codigoRef = useRef<HTMLInputElement>(null);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-lista'],
    queryFn: () => clienteService.getClientesLista(),
  });

  const cliente = useMemo(
    () => clientes.find((c) => c.id === clienteId) || null,
    [clientes, clienteId]
  );

  const listaPreciosId = cliente?.lista_precios_id || null;

  const { data: productos = [], isLoading: loadingProductos } = useQuery<ProductoConPrecio[]>({
    queryKey: ['productos-precios', listaPreciosId],
    queryFn: () => {
      if (!listaPreciosId) return Promise.resolve([]);
      return productoLavadoService.getProductosConPrecios(listaPreciosId);
    },
    enabled: !!listaPreciosId,
  });

  const resolverCodigo = (codigo: string): ProductoConPrecio | null => {
    setErrorCodigo('');
    setProductoEncontrado(null);
    if (!codigo.trim()) return null;
    const buscado = normalizarCodigo(codigo);
    const encontrado = productos.find(
      (p) => normalizarCodigo(p.producto_codigo) === buscado
    );
    if (encontrado) {
      setProductoEncontrado(encontrado);
      return encontrado;
    }
    setErrorCodigo(`No se encontró producto con código "${codigo}"`);
    return null;
  };

  const agregarItemConProducto = (producto: ProductoConPrecio) => {
    const cantidad = parseInt(cantidadInput) || 0;
    if (cantidad <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      cantidadRef.current?.focus();
      cantidadRef.current?.select();
      return;
    }
    setItems((prev) => {
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
        },
      ];
    });
    setCantidadInput('1');
    setCodigoInput('');
    setProductoEncontrado(null);
    setErrorCodigo('');
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
    const found = resolverCodigo(codigoInput);
    if (found) agregarItemConProducto(found);
  };

  const seleccionarDesdeLookup = (p: ProductoConPrecio) => {
    setProductoEncontrado(p);
    setCodigoInput(String(parseInt(p.producto_codigo, 10) || p.producto_codigo));
    setShowLookup(false);
    setTimeout(() => codigoRef.current?.focus(), 50);
  };

  const handleCantidadKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const cantidad = parseInt(cantidadInput) || 0;
      if (cantidad <= 0) {
        toast.error('La cantidad debe ser mayor a 0');
        return;
      }
      codigoRef.current?.focus();
      codigoRef.current?.select();
    }
  };

  const handleCodigoKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const found = resolverCodigo(codigoInput);
      if (found) agregarItemConProducto(found);
    }
  };

  // F4 abre el lookup
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        setShowLookup(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const totales = useMemo(() => {
    const totalUnidades = items.reduce((s, i) => s + i.cantidad, 0);
    const totalMonto = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
    return { totalUnidades, totalMonto };
  }, [items]);

  const imprimirRemitoAuto = async (remitoId: string, conPrecios: boolean) => {
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

  const generarMutation = useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error('Falta cliente');
      return remitoService.generarManual({
        cliente_id: clienteId,
        detalles: items.map((i) => ({
          producto_id: i.producto_id,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
        })),
        notas: observaciones || undefined,
      });
    },
    onSuccess: (response) => {
      toast.success('Remito generado · imprimiendo...');
      queryClient.invalidateQueries({ queryKey: ['remitos'] });
      imprimirRemitoAuto(response.remito_id, imprimirConPrecios);
      setTimeout(() => navigate('/facturacion'), 800);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string } } };
      toast.error(e.response?.data?.detail || 'Error al generar el remito');
    },
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Volver</span>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5 flex-shrink-0" />
            Remito Manual
          </h1>
          <p className="text-gray-500 text-sm">
            Generar remito sin pasar por producción
          </p>
        </div>
      </div>

      {/* Selección de cliente */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Elegí un cliente..." />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                  {c.codigo ? ` — ${c.codigo}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {cliente && !cliente.lista_precios_id && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
              Este cliente no tiene lista de precios asignada. Asignale una desde el módulo
              de Clientes antes de generar el remito.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Agregar ítem por código — sólo si hay cliente con lista */}
      {clienteId && cliente?.lista_precios_id && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />
              Agregar ítem por código
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProductos ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                  <div className="w-full sm:w-28">
                    <Label className="text-xs text-gray-500 mb-1 block">Cantidad</Label>
                    <Input
                      ref={cantidadRef}
                      type="number"
                      min={1}
                      value={cantidadInput}
                      onChange={(e) => setCantidadInput(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      onKeyDown={handleCantidadKey}
                      className="text-lg text-center"
                      autoFocus
                    />
                  </div>
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
                      onKeyDown={handleCodigoKey}
                      onBlur={() => resolverCodigo(codigoInput)}
                      placeholder="Ej: 1"
                      className="text-lg font-mono text-center"
                    />
                  </div>
                  <div className="w-full sm:w-auto">
                    <Label className="text-xs text-gray-500 mb-1 block sm:invisible">F4</Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowLookup(true)}
                      className="w-full sm:w-auto h-10 gap-1"
                    >
                      <Search className="h-4 w-4" />
                      <kbd className="hidden sm:inline-block px-1 py-0.5 bg-gray-100 rounded text-[10px] ml-1">F4</kbd>
                    </Button>
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-gray-500 mb-1 block">Producto</Label>
                    <div
                      className={`h-10 flex items-center px-3 rounded-md border text-sm font-medium ${
                        productoEncontrado
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
                        : 'Ingresá cantidad, luego código y presioná Enter'}
                    </div>
                  </div>
                  {productoEncontrado && (
                    <div className="w-28 hidden sm:block">
                      <Label className="text-xs text-gray-500 mb-1 block">Precio</Label>
                      <div className="h-10 flex items-center px-3 rounded-md border border-gray-200 bg-gray-50 text-sm">
                        {formatCurrency(productoEncontrado.precio_unitario)}
                      </div>
                    </div>
                  )}
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
                  Tip: <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">Enter</kbd> en cantidad pasa al código,
                  <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[11px] mx-1">Enter</kbd> en código agrega,
                  <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">F4</kbd> abre la lista.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ítems del remito */}
      {items.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ítems del remito</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Cód.</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="w-24 text-right">Precio</TableHead>
                  <TableHead className="w-24 text-center">Cant.</TableHead>
                  <TableHead className="w-28 text-right">Subtotal</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.producto_id}>
                    <TableCell className="font-mono">{i.producto_codigo}</TableCell>
                    <TableCell>{i.producto_nombre}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.precio_unitario)}</TableCell>
                    <TableCell className="text-center">{i.cantidad}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(i.precio_unitario * i.cantidad)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setItems((prev) => prev.filter((x) => x.producto_id !== i.producto_id))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Resumen + generar */}
      {items.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs text-blue-700 uppercase">Total unidades</p>
                <p className="text-2xl font-bold text-blue-700">{totales.totalUnidades}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3">
                <p className="text-xs text-green-700 uppercase">Total a facturar</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(totales.totalMonto)}</p>
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Observaciones</Label>
              <Textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas para el remito..."
                rows={2}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                size="lg"
                className="flex-1"
                disabled={generarMutation.isPending || items.length === 0}
                onClick={() => setShowConfirm(true)}
              >
                {generarMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generar Remito
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmación */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar remito manual</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                  <p><strong>Cliente:</strong> {cliente?.nombre || '—'}</p>
                  <p><strong>Total unidades:</strong> {totales.totalUnidades}</p>
                  <p><strong>Total a facturar:</strong> {formatCurrency(totales.totalMonto)}</p>
                </div>
                <label className="flex items-center gap-2 p-3 border border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                  <Checkbox
                    checked={!imprimirConPrecios}
                    onCheckedChange={(v) => setImprimirConPrecios(v !== true)}
                  />
                  <span>
                    <strong>Imprimir sin precios</strong>
                    <span className="block text-xs text-gray-500">
                      Por defecto el remito sale con precios. Marcá para imprimir sin.
                    </span>
                  </span>
                </label>
                <p className="text-gray-500">
                  Esta acción crea un remito y un cargo en la cuenta corriente del cliente,
                  sin generar un lote real de producción.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirm(false);
                generarMutation.mutate();
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lookup */}
      <ProductoLookupModal
        open={showLookup}
        onClose={() => setShowLookup(false)}
        productos={productos}
        onSelect={seleccionarDesdeLookup}
      />

      {/* Empty state */}
      {clienteId && cliente?.lista_precios_id && items.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-8 text-gray-500">
            <Calculator className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            Aún no agregaste ítems al remito.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
