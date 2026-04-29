/**
 * Modal para dividir un lote en la etapa de Estirado (bifurcación)
 * Permite seleccionar qué productos van a Secado y cuáles a Planchado
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Split, ArrowRight, Loader2, Info, AlertTriangle, Package, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

import { produccionService } from '@/services/produccionService';
import api from '@/services/api';

interface EtapaBifurcacionInfo {
  permite_bifurcacion: boolean;
  etapa_destino_principal_id: string | null;
  etapa_destino_principal_nombre: string | null;
  etapa_destino_alternativa_id: string | null;
  etapa_destino_alternativa_nombre: string | null;
}

interface ProductoLavado {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  peso_promedio_kg: number | null;
}

interface DividirLoteModalProps {
  open: boolean;
  onClose: () => void;
  loteId: string;
  loteNumero: string;
  etapaId: string;
  etapaNombre: string;
  pesoTotalKg: number;
}

type DestinoProducto = 'principal' | 'alternativo';

export function DividirLoteModal({
  open,
  onClose,
  loteId,
  loteNumero,
  etapaId,
  etapaNombre,
  pesoTotalKg,
}: DividirLoteModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Estado: productos seleccionados para cada destino
  const [productosDestino, setProductosDestino] = useState<Record<string, DestinoProducto>>({});
  const [observacionesPrincipal, setObservacionesPrincipal] = useState('');
  const [observacionesAlternativo, setObservacionesAlternativo] = useState('');

  // Cargar info de bifurcación de la etapa
  const { data: bifurcacionInfo, isLoading: loadingInfo } = useQuery<EtapaBifurcacionInfo>({
    queryKey: ['bifurcacion-info', etapaId],
    queryFn: () => produccionService.getBifurcacionInfo(etapaId),
    enabled: open && !!etapaId,
  });

  // Cargar productos de lavado
  const { data: productos = [], isLoading: loadingProductos } = useQuery<ProductoLavado[]>({
    queryKey: ['productos-lavado'],
    queryFn: async () => {
      const response = await api.get('/produccion/productos-lavado', { params: { solo_activos: true } });
      return response.data || [];
    },
    enabled: open,
  });

  // Reset cuando se abre el modal
  useEffect(() => {
    if (open) {
      // Por defecto todos los productos van al destino principal (Secado)
      const defaultDestinos: Record<string, DestinoProducto> = {};
      productos.forEach(p => {
        defaultDestinos[p.id] = 'principal';
      });
      setProductosDestino(defaultDestinos);
      setObservacionesPrincipal('');
      setObservacionesAlternativo('');
    }
  }, [open, productos]);

  // Agrupar productos por categoría
  const productosPorCategoria = useMemo(() => {
    const grouped: Record<string, ProductoLavado[]> = {};
    productos.forEach(p => {
      const cat = p.categoria || 'otros';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    return grouped;
  }, [productos]);

  // Contar productos por destino
  const conteos = useMemo(() => {
    let principal = 0;
    let alternativo = 0;
    Object.values(productosDestino).forEach(destino => {
      if (destino === 'principal') principal++;
      else alternativo++;
    });
    return { principal, alternativo };
  }, [productosDestino]);

  // Obtener nombres de productos por destino para las observaciones
  const productosNombres = useMemo(() => {
    const principal: string[] = [];
    const alternativo: string[] = [];
    productos.forEach(p => {
      if (productosDestino[p.id] === 'principal') {
        principal.push(p.nombre);
      } else if (productosDestino[p.id] === 'alternativo') {
        alternativo.push(p.nombre);
      }
    });
    return { principal, alternativo };
  }, [productos, productosDestino]);

  // Cambiar destino de un producto
  const toggleProductoDestino = (productoId: string, destino: DestinoProducto) => {
    setProductosDestino(prev => ({
      ...prev,
      [productoId]: destino,
    }));
  };

  // Seleccionar todos de una categoría
  const seleccionarCategoria = (categoria: string, destino: DestinoProducto) => {
    const nuevosDestinos = { ...productosDestino };
    productosPorCategoria[categoria]?.forEach(p => {
      nuevosDestinos[p.id] = destino;
    });
    setProductosDestino(nuevosDestinos);
  };

  // Mutation para dividir el lote
  const dividirMutation = useMutation({
    mutationFn: () => {
      // Calcular peso aproximado basado en proporción de productos
      const totalProductos = conteos.principal + conteos.alternativo;
      const proporcionPrincipal = totalProductos > 0 ? conteos.principal / totalProductos : 1;
      const pesoPrincipal = Math.round(pesoTotalKg * proporcionPrincipal * 10) / 10;
      const pesoAlternativo = Math.round((pesoTotalKg - pesoPrincipal) * 10) / 10;

      // Agregar lista de productos a las observaciones
      const obsPrincipal = [
        observacionesPrincipal,
        `Productos: ${productosNombres.principal.join(', ') || 'Todos'}`,
      ].filter(Boolean).join('\n');

      const obsAlternativo = conteos.alternativo > 0 ? [
        observacionesAlternativo,
        `Productos: ${productosNombres.alternativo.join(', ')}`,
      ].filter(Boolean).join('\n') : undefined;

      return produccionService.dividirLote(loteId, etapaId, {
        peso_destino_principal_kg: pesoPrincipal,
        peso_destino_alternativo_kg: pesoAlternativo,
        observaciones_principal: obsPrincipal,
        observaciones_alternativo: obsAlternativo,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      toast({
        title: 'Lote dividido correctamente',
        description: data.mensaje,
      });
      onClose();
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const detail = error.response?.data?.detail || 'Error al dividir el lote';
      toast({
        title: 'Error',
        description: detail,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (conteos.principal === 0 && conteos.alternativo === 0) {
      toast({
        title: 'Error',
        description: 'Debes seleccionar al menos un producto',
        variant: 'destructive',
      });
      return;
    }
    dividirMutation.mutate();
  };

  const isLoading = loadingInfo || loadingProductos;

  if (!bifurcacionInfo?.permite_bifurcacion && !isLoading) {
    return (
      <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Etapa sin bifurcación</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              La etapa "{etapaNombre}" no permite bifurcación de lotes.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const destinoPrincipalNombre = bifurcacionInfo?.etapa_destino_principal_nombre || 'Secado';
  const destinoAlternativoNombre = bifurcacionInfo?.etapa_destino_alternativa_nombre || 'Planchado';

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] w-[95vw] max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5 text-primary" />
            Dividir Lote - {loteNumero}
          </DialogTitle>
          <DialogDescription>
            Selecciona qué productos van a {destinoPrincipalNombre} y cuáles a {destinoAlternativoNombre}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {/* Resumen de selección */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-600" />
                      <Badge className="bg-green-600">{destinoPrincipalNombre}</Badge>
                    </div>
                    <span className="text-2xl font-bold text-green-700">{conteos.principal}</span>
                  </div>
                  <p className="text-xs text-green-600 mt-1">productos seleccionados</p>
                </CardContent>
              </Card>

              <Card className={`border-orange-200 ${conteos.alternativo > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                <CardContent className="pt-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-orange-600" />
                      <Badge className="bg-orange-500">{destinoAlternativoNombre}</Badge>
                    </div>
                    <span className="text-2xl font-bold text-orange-700">{conteos.alternativo}</span>
                  </div>
                  <p className="text-xs text-orange-600 mt-1">productos seleccionados</p>
                </CardContent>
              </Card>
            </div>

            {/* Lista de productos por categoría */}
            <div className="border rounded-lg">
              <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                <Label className="font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Seleccionar productos por destino
                </Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-green-300 text-green-700 hover:bg-green-50"
                    onClick={() => {
                      const todos: Record<string, DestinoProducto> = {};
                      productos.forEach(p => { todos[p.id] = 'principal'; });
                      setProductosDestino(todos);
                    }}
                  >
                    Todos a {destinoPrincipalNombre}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                    onClick={() => {
                      const todos: Record<string, DestinoProducto> = {};
                      productos.forEach(p => { todos[p.id] = 'alternativo'; });
                      setProductosDestino(todos);
                    }}
                  >
                    Todos a {destinoAlternativoNombre}
                  </Button>
                </div>
              </div>

              <div className="h-[300px] overflow-y-auto">
                <div className="p-4 space-y-4">
                  {Object.entries(productosPorCategoria).map(([categoria, prods]) => (
                    <div key={categoria} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold capitalize text-gray-700">
                          {categoria.replace(/_/g, ' ')}
                        </Label>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-green-600 hover:bg-green-50"
                            onClick={() => seleccionarCategoria(categoria, 'principal')}
                          >
                            → {destinoPrincipalNombre}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-orange-600 hover:bg-orange-50"
                            onClick={() => seleccionarCategoria(categoria, 'alternativo')}
                          >
                            → {destinoAlternativoNombre}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {prods.map(producto => {
                          const destino = productosDestino[producto.id] || 'principal';
                          const esPrincipal = destino === 'principal';

                          return (
                            <div
                              key={producto.id}
                              className="flex items-center justify-between p-2 rounded border bg-white hover:bg-gray-50"
                            >
                              <span className="text-sm font-medium">{producto.nombre}</span>
                              <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
                                <button
                                  type="button"
                                  onClick={() => toggleProductoDestino(producto.id, 'principal')}
                                  className={`
                                    px-3 py-1 text-xs font-medium rounded-full transition-all
                                    ${esPrincipal
                                      ? 'bg-green-500 text-white shadow-sm'
                                      : 'text-gray-500 hover:text-green-600'
                                    }
                                  `}
                                >
                                  {destinoPrincipalNombre}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleProductoDestino(producto.id, 'alternativo')}
                                  className={`
                                    px-3 py-1 text-xs font-medium rounded-full transition-all
                                    ${!esPrincipal
                                      ? 'bg-orange-500 text-white shadow-sm'
                                      : 'text-gray-500 hover:text-orange-600'
                                    }
                                  `}
                                >
                                  {destinoAlternativoNombre}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Observaciones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-green-700">Observaciones {destinoPrincipalNombre}</Label>
                <Textarea
                  value={observacionesPrincipal}
                  onChange={(e) => setObservacionesPrincipal(e.target.value)}
                  placeholder="Opcional..."
                  rows={2}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-orange-700">Observaciones {destinoAlternativoNombre}</Label>
                <Textarea
                  value={observacionesAlternativo}
                  onChange={(e) => setObservacionesAlternativo(e.target.value)}
                  placeholder="Opcional..."
                  rows={2}
                  className="text-xs"
                  disabled={conteos.alternativo === 0}
                />
              </div>
            </div>

            {/* Mensaje informativo */}
            {conteos.alternativo > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Se creará un <strong>sub-lote ({loteNumero}-B)</strong> con los {conteos.alternativo} productos
                  seleccionados para <strong>{destinoAlternativoNombre}</strong>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="flex-shrink-0 pt-3 sm:pt-4 border-t flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={dividirMutation.isPending} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="w-full sm:w-auto"
            disabled={dividirMutation.isPending || isLoading}
          >
            {dividirMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Dividiendo...
              </>
            ) : (
              <>
                <Split className="h-4 w-4 mr-2" />
                Dividir Lote
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
