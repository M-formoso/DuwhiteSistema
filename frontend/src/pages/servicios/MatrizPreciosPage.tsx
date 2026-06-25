/**
 * Gestor masivo de precios — matriz productos × listas de precios.
 *
 * Una sola vista para:
 * - Ver y editar todos los precios de todos los productos en todas las listas.
 * - Aplicar incremento porcentual a una/varias listas, productos o todo.
 * - Crear nuevas listas desde acá sin saltar de pantalla.
 */

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Search,
  Loader2,
  Plus,
  Percent,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { clienteService } from '@/services/clienteService';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

import { productoLavadoService } from '@/services/productoLavadoService';
import { listaPreciosService } from '@/services/servicioService';
import { getErrorMessage } from '@/services/api';

const CATEGORIAS = [
  { value: 'todas', label: 'Todas las categorías' },
  { value: 'toallas', label: 'Toallas' },
  { value: 'ropa_cama', label: 'Ropa de cama' },
  { value: 'manteleria', label: 'Mantelería' },
  { value: 'alfombras', label: 'Alfombras' },
  { value: 'cortinas', label: 'Cortinas' },
  { value: 'otros', label: 'Otros' },
];

const formatearCodigo = (codigo: string) => {
  const limpio = (codigo || '').trim();
  if (/^\d+$/.test(limpio)) return limpio.padStart(4, '0');
  return limpio;
};

const formatMoneda = (n: number | null | undefined) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(n);

export default function MatrizPreciosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string>('todas');
  const [editados, setEditados] = useState<Record<string, string>>({});
  // key: `${producto_id}|${lista_id}` → valor del input como string

  // Modal "Aplicar %"
  const [showIncModal, setShowIncModal] = useState(false);
  const [porcentaje, setPorcentaje] = useState<string>('');
  const [listasSeleccionadas, setListasSeleccionadas] = useState<string[]>([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState<string[]>([]);

  // Modal "Nueva lista"
  const [showNuevaLista, setShowNuevaLista] = useState(false);
  const [nuevaLista, setNuevaLista] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    es_lista_base: false,
  });

  // Modal "Asignar a clientes"
  const [asignarLista, setAsignarLista] = useState<{ id: string; codigo: string; nombre: string } | null>(null);
  const [clientesSeleccionados, setClientesSeleccionados] = useState<string[]>([]);
  const [busquedaClientes, setBusquedaClientes] = useState('');

  const { data: clientesLista = [] } = useQuery({
    queryKey: ['clientes-lista'],
    queryFn: clienteService.getClientesLista,
  });

  const { data: matriz, isLoading } = useQuery({
    queryKey: ['matriz-precios', { categoria, search: busqueda }],
    queryFn: () =>
      productoLavadoService.getMatrizPrecios({
        categoria: categoria === 'todas' ? undefined : (categoria as any),
        search: busqueda.trim() || undefined,
      }),
  });

  // Bulk mutation
  const bulkMutation = useMutation({
    mutationFn: (
      precios: Array<{ lista_precios_id: string; producto_id: string; precio_unitario: number }>,
    ) => productoLavadoService.bulkSetPrecios(precios),
    onSuccess: (res) => {
      toast.success(`${res.cambios} precios guardados`);
      setEditados({});
      queryClient.invalidateQueries({ queryKey: ['matriz-precios'] });
    },
    onError: (err) => toast.error(getErrorMessage(err) || 'Error al guardar precios'),
  });

  // Incremento mutation
  const incrementoMutation = useMutation({
    mutationFn: (payload: { porcentaje: number; lista_ids?: string[]; producto_ids?: string[] }) =>
      productoLavadoService.incrementarPrecios(payload),
    onSuccess: (res) => {
      toast.success(`${res.actualizados} precios actualizados (${res.porcentaje > 0 ? '+' : ''}${res.porcentaje}%)`);
      setShowIncModal(false);
      setPorcentaje('');
      setListasSeleccionadas([]);
      setProductosSeleccionados([]);
      queryClient.invalidateQueries({ queryKey: ['matriz-precios'] });
    },
    onError: (err) => toast.error(getErrorMessage(err) || 'Error al aplicar incremento'),
  });

  // Asignar lista a clientes
  const asignarMutation = useMutation({
    mutationFn: ({ listaId, clienteIds }: { listaId: string; clienteIds: string[] }) =>
      clienteService.asignarListaPreciosAClientes(listaId, clienteIds),
    onSuccess: (res) => {
      toast.success(`${res.actualizados} cliente(s) actualizado(s)`);
      setAsignarLista(null);
      setClientesSeleccionados([]);
      setBusquedaClientes('');
      queryClient.invalidateQueries({ queryKey: ['clientes-lista'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
    onError: (err) => toast.error(getErrorMessage(err) || 'Error al asignar lista'),
  });

  const desasignarMutation = useMutation({
    mutationFn: ({ clienteIds }: { clienteIds: string[] }) =>
      clienteService.asignarListaPreciosAClientes(null, clienteIds),
    onSuccess: (res) => {
      toast.success(`${res.actualizados} cliente(s) ya no tienen lista asignada`);
      queryClient.invalidateQueries({ queryKey: ['clientes-lista'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
    onError: (err) => toast.error(getErrorMessage(err) || 'Error al desasignar lista'),
  });

  const abrirAsignar = (lista: { id: string; codigo: string; nombre: string }) => {
    setAsignarLista(lista);
    // Pre-seleccionar los clientes que ya tienen esta lista
    const yaAsignados = clientesLista
      .filter((c: any) => c.lista_precios_id === lista.id)
      .map((c: any) => c.id);
    setClientesSeleccionados(yaAsignados);
    setBusquedaClientes('');
  };

  // Crear lista mutation
  const crearListaMutation = useMutation({
    mutationFn: () =>
      listaPreciosService.crear({
        codigo: nuevaLista.codigo.toUpperCase(),
        nombre: nuevaLista.nombre,
        descripcion: nuevaLista.descripcion || undefined,
        es_lista_base: nuevaLista.es_lista_base,
      } as any),
    onSuccess: () => {
      toast.success('Lista creada');
      setShowNuevaLista(false);
      setNuevaLista({ codigo: '', nombre: '', descripcion: '', es_lista_base: false });
      queryClient.invalidateQueries({ queryKey: ['matriz-precios'] });
      queryClient.invalidateQueries({ queryKey: ['listas-precios'] });
    },
    onError: (err) => toast.error(getErrorMessage(err) || 'Error al crear lista'),
  });

  const onChangePrecio = (productoId: string, listaId: string, value: string) => {
    // Permite vacío, dígitos y un solo separador (. o ,)
    let v = value.replace(/[^\d.,]/g, '').replace(/,/g, '.');
    const parts = v.split('.');
    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
    setEditados((prev) => ({ ...prev, [`${productoId}|${listaId}`]: v }));
  };

  const valorCelda = (productoId: string, listaId: string, precioOriginal: number | null) => {
    const key = `${productoId}|${listaId}`;
    if (key in editados) return editados[key];
    return precioOriginal != null ? String(precioOriginal) : '';
  };

  const tieneCambios = Object.keys(editados).length > 0;

  const guardarTodo = () => {
    const precios = Object.entries(editados)
      .map(([key, value]) => {
        const [productoId, listaId] = key.split('|');
        const num = parseFloat(value);
        if (!Number.isFinite(num) || num < 0) return null;
        return {
          producto_id: productoId,
          lista_precios_id: listaId,
          precio_unitario: num,
        };
      })
      .filter((x): x is { producto_id: string; lista_precios_id: string; precio_unitario: number } => x !== null);

    if (precios.length === 0) {
      toast.error('No hay cambios válidos para guardar');
      return;
    }
    bulkMutation.mutate(precios);
  };

  useEffect(() => {
    if (showIncModal) {
      // Por default, todas seleccionadas (= todas, sea cual fuere)
      setListasSeleccionadas([]);
      setProductosSeleccionados([]);
      setPorcentaje('');
    }
  }, [showIncModal]);

  const aplicarIncremento = () => {
    const p = parseFloat(porcentaje.replace(',', '.'));
    if (!Number.isFinite(p) || p === 0) {
      toast.error('Ingresá un porcentaje válido (ej: 10 o -5)');
      return;
    }
    incrementoMutation.mutate({
      porcentaje: p,
      lista_ids: listasSeleccionadas.length > 0 ? listasSeleccionadas : undefined,
      producto_ids: productosSeleccionados.length > 0 ? productosSeleccionados : undefined,
    });
  };

  const productos = matriz?.productos ?? [];
  const listas = matriz?.listas ?? [];

  const cantidadProductos = productos.length;

  // Promedios de la matriz (útil para feedback rápido)
  const stats = useMemo(() => {
    if (!matriz) return { totalPrecios: 0, productosSinPrecio: 0 };
    let totalPrecios = 0;
    let productosSinPrecio = 0;
    for (const p of matriz.productos) {
      const tiene = Object.values(p.precios).some((v) => v != null);
      if (!tiene) productosSinPrecio += 1;
      totalPrecios += Object.values(p.precios).filter((v) => v != null).length;
    }
    return { totalPrecios, productosSinPrecio };
  }, [matriz]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/servicios')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Gestor masivo de precios</h1>
            <p className="text-sm text-text-secondary">
              {cantidadProductos} productos · {listas.length} listas · {stats.totalPrecios} precios cargados
              {stats.productosSinPrecio > 0 && (
                <span className="ml-2 text-amber-600">· {stats.productosSinPrecio} sin precio en ninguna lista</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowIncModal(true)}>
            <Percent className="h-4 w-4 mr-2" />
            Aplicar incremento %
          </Button>
          <Button variant="outline" onClick={() => setShowNuevaLista(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva lista
          </Button>
          <Button
            onClick={guardarTodo}
            disabled={!tieneCambios || bulkMutation.isPending}
            className="bg-primary hover:bg-primary-hover"
          >
            {bulkMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar
            {tieneCambios && (
              <Badge variant="secondary" className="ml-2">
                {Object.keys(editados).length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="py-3 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código o nombre..."
              className="pl-9"
            />
          </div>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabla matriz */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : listas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No hay listas de precios creadas todavía.</p>
              <Button className="mt-3" size="sm" onClick={() => setShowNuevaLista(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Crear primera lista
              </Button>
            </div>
          ) : productos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron productos.
            </div>
          ) : (
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-muted/95">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold border-b border-r min-w-[80px]">Código</th>
                    <th className="px-3 py-3 text-left font-semibold border-b border-r min-w-[180px]">Producto</th>
                    {listas.map((l) => {
                      const clientesConEsta = clientesLista.filter(
                        (c: any) => c.lista_precios_id === l.id,
                      ).length;
                      return (
                        <th
                          key={l.id}
                          className="px-2 py-2 text-center font-semibold border-b border-r min-w-[120px]"
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs font-mono text-muted-foreground">{l.codigo}</span>
                            <span className="text-xs">{l.nombre}</span>
                            {l.es_lista_base && (
                              <Badge variant="outline" className="text-[9px] py-0 h-4">base</Badge>
                            )}
                            <button
                              type="button"
                              onClick={() => abrirAsignar(l)}
                              className="mt-0.5 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                              title="Asignar esta lista a clientes"
                            >
                              <Users className="h-3 w-3" />
                              {clientesConEsta > 0 ? `${clientesConEsta} cliente${clientesConEsta === 1 ? '' : 's'}` : 'Asignar'}
                            </button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => (
                    <tr key={p.producto_id} className="hover:bg-muted/30 border-b">
                      <td className="px-3 py-2 font-mono font-semibold border-r">
                        {formatearCodigo(p.producto_codigo)}
                      </td>
                      <td className="px-3 py-2 border-r">
                        <div className="font-medium">{p.producto_nombre}</div>
                        <div className="text-[10px] text-muted-foreground capitalize">
                          {p.categoria.replace('_', ' ')}
                        </div>
                      </td>
                      {listas.map((l) => {
                        const original = p.precios[l.id] ?? null;
                        const valor = valorCelda(p.producto_id, l.id, original);
                        const key = `${p.producto_id}|${l.id}`;
                        const editado = key in editados;
                        return (
                          <td
                            key={l.id}
                            className={`px-2 py-1 border-r ${editado ? 'bg-amber-50' : ''}`}
                          >
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={valor}
                              onChange={(e) => onChangePrecio(p.producto_id, l.id, e.target.value)}
                              placeholder={original == null ? '—' : ''}
                              className="h-8 text-right font-mono text-sm"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {tieneCambios && (
        <div className="text-xs text-amber-700 flex items-center gap-2">
          <AlertTriangle className="h-3 w-3" />
          Tenés {Object.keys(editados).length} cambios sin guardar. Apretá "Guardar" cuando termines.
        </div>
      )}

      {/* Modal: aplicar incremento % */}
      <Dialog open={showIncModal} onOpenChange={setShowIncModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aplicar incremento porcentual</DialogTitle>
            <DialogDescription>
              Aumenta o reduce el precio de los productos seleccionados según el porcentaje.
              Si no elegís listas o productos, se aplica a TODOS.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Porcentaje (%) *</Label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  inputMode="decimal"
                  value={porcentaje}
                  onChange={(e) => setPorcentaje(e.target.value)}
                  placeholder="Ej: 10 para +10%, -5 para -5%"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Positivos suman, negativos restan. Acepta decimales.
              </p>
            </div>

            <div>
              <Label className="mb-2 flex items-center justify-between">
                <span>Listas afectadas <span className="text-muted-foreground text-xs">(vacío = todas)</span></span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => setListasSeleccionadas(listas.map((l) => l.id))}
                  >
                    todas
                  </button>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => setListasSeleccionadas([])}
                  >
                    ninguna
                  </button>
                </div>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                {listas.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={listasSeleccionadas.includes(l.id)}
                      onCheckedChange={(c) => {
                        if (c) setListasSeleccionadas((prev) => [...prev, l.id]);
                        else setListasSeleccionadas((prev) => prev.filter((x) => x !== l.id));
                      }}
                    />
                    <span className="truncate">{l.codigo} · {l.nombre}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 flex items-center justify-between">
                <span>Productos afectados <span className="text-muted-foreground text-xs">(vacío = todos)</span></span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => setProductosSeleccionados(productos.map((p) => p.producto_id))}
                  >
                    todos
                  </button>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => setProductosSeleccionados([])}
                  >
                    ninguno
                  </button>
                </div>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded p-2">
                {productos.map((p) => (
                  <label key={p.producto_id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={productosSeleccionados.includes(p.producto_id)}
                      onCheckedChange={(c) => {
                        if (c) setProductosSeleccionados((prev) => [...prev, p.producto_id]);
                        else setProductosSeleccionados((prev) => prev.filter((x) => x !== p.producto_id));
                      }}
                    />
                    <span className="font-mono mr-1">{formatearCodigo(p.producto_codigo)}</span>
                    <span className="truncate">{p.producto_nombre}</span>
                  </label>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground border-l-4 border-blue-300 bg-blue-50 px-3 py-2 rounded">
              Solo se modifican precios EXISTENTES (no se crean nuevos). Para crear precios donde no hay,
              editá las celdas directamente en la matriz.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowIncModal(false)}>Cancelar</Button>
            <Button
              onClick={aplicarIncremento}
              disabled={incrementoMutation.isPending || !porcentaje}
            >
              {incrementoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: nueva lista */}
      <Dialog open={showNuevaLista} onOpenChange={setShowNuevaLista}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Lista de Precios</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Código *</Label>
                <Input
                  value={nuevaLista.codigo}
                  onChange={(e) => setNuevaLista({ ...nuevaLista, codigo: e.target.value.toUpperCase() })}
                  placeholder="LP001"
                />
              </div>
              <div className="flex items-end gap-2">
                <Checkbox
                  id="es-base"
                  checked={nuevaLista.es_lista_base}
                  onCheckedChange={(v) => setNuevaLista({ ...nuevaLista, es_lista_base: !!v })}
                />
                <Label htmlFor="es-base" className="cursor-pointer">Es lista base</Label>
              </div>
            </div>
            <div>
              <Label>Nombre *</Label>
              <Input
                value={nuevaLista.nombre}
                onChange={(e) => setNuevaLista({ ...nuevaLista, nombre: e.target.value })}
                placeholder="Lista General"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input
                value={nuevaLista.descripcion}
                onChange={(e) => setNuevaLista({ ...nuevaLista, descripcion: e.target.value })}
                placeholder="(opcional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNuevaLista(false)}>Cancelar</Button>
            <Button
              onClick={() => crearListaMutation.mutate()}
              disabled={!nuevaLista.codigo || !nuevaLista.nombre || crearListaMutation.isPending}
            >
              {crearListaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: asignar lista a clientes */}
      <Dialog open={!!asignarLista} onOpenChange={(v) => !v && setAsignarLista(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asignar lista a clientes</DialogTitle>
            <DialogDescription>
              {asignarLista && (
                <>
                  Lista <span className="font-mono">{asignarLista.codigo}</span> · {asignarLista.nombre}
                  <br />
                  Marcá los clientes a los que querés asignarles esta lista.
                  Los que destildés pero ya la tenían quedarán con otra lista
                  asignada (la borrás solo si las dejás todas vacías).
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Input
              placeholder="Buscar cliente..."
              value={busquedaClientes}
              onChange={(e) => setBusquedaClientes(e.target.value)}
            />

            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {clientesSeleccionados.length} de {clientesLista.length} seleccionado(s)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="underline"
                  onClick={() => setClientesSeleccionados(clientesLista.map((c: any) => c.id))}
                >
                  todos
                </button>
                <button
                  type="button"
                  className="underline"
                  onClick={() => setClientesSeleccionados([])}
                >
                  ninguno
                </button>
              </div>
            </div>

            <div className="border rounded divide-y max-h-72 overflow-y-auto">
              {clientesLista
                .filter((c: any) => {
                  const q = busquedaClientes.toLowerCase();
                  if (!q) return true;
                  return (
                    (c.nombre || '').toLowerCase().includes(q) ||
                    (c.codigo || '').toLowerCase().includes(q)
                  );
                })
                .map((c: any) => {
                  const seleccionado = clientesSeleccionados.includes(c.id);
                  const tieneOtra = c.lista_precios_id && c.lista_precios_id !== asignarLista?.id;
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={seleccionado}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setClientesSeleccionados((prev) => [...prev, c.id]);
                          } else {
                            setClientesSeleccionados((prev) => prev.filter((x) => x !== c.id));
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.nombre}</div>
                        {c.cuit && (
                          <div className="text-xs text-muted-foreground font-mono">{c.cuit}</div>
                        )}
                      </div>
                      {c.lista_precios_id === asignarLista?.id && (
                        <Badge variant="outline" className="text-[10px]">tiene esta</Badge>
                      )}
                      {tieneOtra && (
                        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                          tiene otra
                        </Badge>
                      )}
                    </label>
                  );
                })}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              onClick={() => setAsignarLista(null)}
              className="sm:mr-auto"
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (clientesSeleccionados.length === 0) {
                  toast.error('Seleccioná clientes para quitarles esta lista');
                  return;
                }
                desasignarMutation.mutate({ clienteIds: clientesSeleccionados });
              }}
              disabled={desasignarMutation.isPending || asignarMutation.isPending}
              title="Quita esta lista de los clientes seleccionados"
            >
              Quitar lista
            </Button>
            <Button
              onClick={() => {
                if (!asignarLista) return;
                if (clientesSeleccionados.length === 0) {
                  toast.error('Seleccioná al menos un cliente');
                  return;
                }
                asignarMutation.mutate({
                  listaId: asignarLista.id,
                  clienteIds: clientesSeleccionados,
                });
              }}
              disabled={asignarMutation.isPending || desasignarMutation.isPending}
            >
              {asignarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Asignar a {clientesSeleccionados.length} cliente(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
