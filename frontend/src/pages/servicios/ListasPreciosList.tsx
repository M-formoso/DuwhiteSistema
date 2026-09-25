/**
 * Lista de Listas de Precios con CRUD
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  List,
  MoreHorizontal,
  Eye,
  Percent,
  RefreshCw,
  LayoutGrid,
  Loader2,
  FileDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { toast } from 'sonner';

import {
  listaPreciosService,
  ListaPrecios,
  ListaPreciosCreate,
  ListaPreciosUpdate,
} from '@/services/servicioService';
import { productoLavadoService } from '@/services/productoLavadoService';
import { Checkbox } from '@/components/ui/checkbox';
import { getErrorMessage } from '@/services/api';

export default function ListasPreciosList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [listaEditar, setListaEditar] = useState<ListaPrecios | null>(null);
  const [listaEliminar, setListaEliminar] = useState<ListaPrecios | null>(null);
  const [descargandoId, setDescargandoId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<ListaPreciosCreate>({
    codigo: '',
    nombre: '',
    descripcion: '',
    es_lista_base: false,
    lista_base_id: undefined,
    porcentaje_modificador: undefined,
    incluye_iva: false,
    notas: '',
    inicializar_items: 'todos',
    servicios_seleccionados: [],
  });
  // Filtro de búsqueda dentro del selector de productos (modo "seleccion")
  const [busquedaServicio, setBusquedaServicio] = useState('');

  // Queries
  const { data: listasData, isLoading } = useQuery({
    queryKey: ['listas-precios', search],
    queryFn: () =>
      listaPreciosService.listar({
        search: search || undefined,
        limit: 100,
      }),
  });

  const { data: listasBase = [] } = useQuery({
    queryKey: ['listas-precios-base'],
    queryFn: async () => {
      const response = await listaPreciosService.listar({ es_lista_base: true });
      return response.items;
    },
  });

  // Catálogo de productos_lavado activos, para el modo "Seleccionar productos"
  // del form de creación. Solo se carga cuando el modal está abierto y en modo alta.
  const { data: serviciosCatalogo = [] } = useQuery({
    queryKey: ['productos-lavado-para-lista-precios'],
    queryFn: () => productoLavadoService.getAll({ solo_activos: true }),
    enabled: modalOpen && !listaEditar,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: listaPreciosService.crear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listas-precios'] });
      toast.success('Lista de precios creada correctamente');
      handleCloseModal();
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Error al crear lista de precios');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ListaPreciosUpdate }) =>
      listaPreciosService.actualizar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listas-precios'] });
      toast.success('Lista de precios actualizada correctamente');
      handleCloseModal();
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Error al actualizar lista de precios');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: listaPreciosService.eliminar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listas-precios'] });
      toast.success('Lista de precios eliminada correctamente');
      setDeleteDialogOpen(false);
      setListaEliminar(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Error al eliminar lista de precios');
    },
  });

  const aplicarModificadorMutation = useMutation({
    mutationFn: listaPreciosService.aplicarModificador,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['listas-precios'] });
      toast.success(`Se actualizaron ${data.items_actualizados} items`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Error al aplicar modificador');
    },
  });

  const handleOpenModal = (lista?: ListaPrecios) => {
    setBusquedaServicio('');
    if (lista) {
      setListaEditar(lista);
      setFormData({
        codigo: lista.codigo,
        nombre: lista.nombre,
        descripcion: lista.descripcion || '',
        es_lista_base: lista.es_lista_base,
        lista_base_id: lista.lista_base_id || undefined,
        porcentaje_modificador: lista.porcentaje_modificador || undefined,
        incluye_iva: lista.incluye_iva ?? false,
        notas: lista.notas || '',
      });
    } else {
      setListaEditar(null);
      setFormData({
        codigo: '',
        nombre: '',
        descripcion: '',
        es_lista_base: false,
        lista_base_id: undefined,
        porcentaje_modificador: undefined,
        incluye_iva: false,
        notas: '',
        inicializar_items: 'todos',
        servicios_seleccionados: [],
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setListaEditar(null);
  };

  const handleSubmit = () => {
    if (!formData.codigo || !formData.codigo.trim()) {
      toast.error('El código es obligatorio');
      return;
    }
    if (!formData.nombre || !formData.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    // Limpia el payload: strings vacíos → undefined, valores undefined no se
    // serializan en JSON. Evita que el backend reciba "" donde espera null.
    const payload: ListaPreciosUpdate = {
      codigo: formData.codigo.trim(),
      nombre: formData.nombre.trim(),
      descripcion: formData.descripcion?.trim() || undefined,
      es_lista_base: formData.es_lista_base,
      lista_base_id: formData.es_lista_base ? undefined : (formData.lista_base_id || undefined),
      porcentaje_modificador: formData.es_lista_base
        ? undefined
        : (formData.porcentaje_modificador ?? undefined),
      incluye_iva: formData.incluye_iva ?? false,
      notas: formData.notas?.trim() || undefined,
    };

    if (listaEditar) {
      updateMutation.mutate({ id: listaEditar.id, data: payload });
    } else {
      const modo = formData.inicializar_items ?? 'todos';
      if (modo === 'seleccion' && (formData.servicios_seleccionados?.length ?? 0) === 0) {
        toast.error('Elegí al menos un producto para incluir en la lista');
        return;
      }
      const createPayload: ListaPreciosCreate = {
        ...(payload as ListaPreciosCreate),
        inicializar_items: modo,
        servicios_seleccionados:
          modo === 'seleccion' ? formData.servicios_seleccionados : undefined,
      };
      createMutation.mutate(createPayload);
    }
  };

  const handleDelete = (lista: ListaPrecios) => {
    setListaEliminar(lista);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (listaEliminar) {
      deleteMutation.mutate(listaEliminar.id);
    }
  };

  const handleAplicarModificador = (lista: ListaPrecios) => {
    aplicarModificadorMutation.mutate(lista.id);
  };

  const handleDescargarPdf = async (lista: ListaPrecios) => {
    try {
      setDescargandoId(lista.id);
      const slug = (lista.codigo || 'lista').trim().replace(/\s+/g, '_');
      await listaPreciosService.descargarPdf(lista.id, `lista_precios_${slug}.pdf`);
      toast.success('PDF descargado correctamente');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Error al descargar el PDF');
    } finally {
      setDescargandoId(null);
    }
  };

  const listas = listasData?.items || [];

  return (
    <div className="space-y-4">
      {/* Header con busqueda y acciones */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por codigo o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/servicios/matriz-precios')}>
            <LayoutGrid className="h-4 w-4 mr-2" />
            Gestor masivo
          </Button>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Lista
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : listas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <List className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay listas de precios registradas</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => handleOpenModal()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear primera lista
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Modificador</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listas.map((lista) => (
                  <TableRow key={lista.id}>
                    <TableCell className="font-medium">{lista.codigo}</TableCell>
                    <TableCell>{lista.nombre}</TableCell>
                    <TableCell>
                      <Badge variant={lista.es_lista_base ? 'default' : 'outline'}>
                        {lista.es_lista_base ? 'Base' : 'Derivada'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lista.porcentaje_modificador !== null &&
                      lista.porcentaje_modificador !== undefined ? (
                        <span
                          className={
                            lista.porcentaje_modificador >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {lista.porcentaje_modificador >= 0 ? '+' : ''}
                          {lista.porcentaje_modificador}%
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{lista.cantidad_items}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={lista.activa ? 'success' : 'secondary'}>
                        {lista.activa ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Descargar PDF"
                          onClick={() => handleDescargarPdf(lista)}
                          disabled={descargandoId === lista.id}
                        >
                          {descargandoId === lista.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileDown className="h-4 w-4 text-primary" />
                          )}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/servicios/listas/${lista.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenModal(lista)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDescargarPdf(lista)}
                              disabled={descargandoId === lista.id}
                            >
                              <FileDown className="h-4 w-4 mr-2" />
                              Descargar PDF
                            </DropdownMenuItem>
                            {!lista.es_lista_base && lista.lista_base_id && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleAplicarModificador(lista)}
                                >
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Aplicar Modificador
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(lista)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de creacion/edicion. Al crear es mas ancho para acomodar el
          selector de productos al lado del formulario; al editar queda
          angosto porque no hay selector de productos. Scroll interno para
          no cortarse en pantallas chicas. */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className={
            (listaEditar ? 'max-w-lg' : 'max-w-4xl') +
            ' max-h-[90vh] overflow-hidden flex flex-col'
          }
        >
          <DialogHeader>
            <DialogTitle>
              {listaEditar ? 'Editar Lista de Precios' : 'Nueva Lista de Precios'}
            </DialogTitle>
          </DialogHeader>

          {/* Body con scroll interno */}
          <div className="flex-1 overflow-y-auto -mx-1 px-1 py-4">
            <div className={listaEditar ? 'space-y-4' : 'grid gap-6 md:grid-cols-2'}>
              {/* Columna izquierda: datos básicos y comerciales */}
              <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Codigo *</Label>
                <Input
                  value={formData.codigo}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
                  }
                  placeholder="LP001"
                />
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label>Es Lista Base</Label>
                <Switch
                  checked={formData.es_lista_base}
                  onCheckedChange={(v) =>
                    setFormData({
                      ...formData,
                      es_lista_base: v,
                      lista_base_id: v ? undefined : formData.lista_base_id,
                      porcentaje_modificador: v
                        ? undefined
                        : formData.porcentaje_modificador,
                    })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Nombre *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Lista General"
              />
            </div>

            <div>
              <Label>Descripcion</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) =>
                  setFormData({ ...formData, descripcion: e.target.value })
                }
                placeholder="Descripcion de la lista..."
                rows={2}
              />
            </div>

            {!formData.es_lista_base && (
              <>
                <div>
                  <Label>Lista Base</Label>
                  <Select
                    value={formData.lista_base_id || 'none'}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        lista_base_id: v === 'none' ? undefined : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar lista base" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin lista base</SelectItem>
                      {listasBase.map((lb) => (
                        <SelectItem key={lb.id} value={lb.id}>
                          {lb.codigo} - {lb.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.lista_base_id && (
                  <div>
                    <Label>Porcentaje Modificador</Label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.porcentaje_modificador || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            porcentaje_modificador: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          })
                        }
                        className="pl-9"
                        placeholder="Ej: 10 para +10%, -5 para -5%"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Valores positivos aumentan el precio, negativos lo reducen
                    </p>
                  </div>
                )}
              </>
            )}

            {/* IVA y Notas: los ponemos en la columna izquierda para no dejar
                huecos en el modal (a la derecha, el selector de productos
                puede crecer mucho en alto). En edición hay una sola columna
                asi que quedan igual abajo. */}
            <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-background/50 p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Los precios incluyen IVA</Label>
                <p className="text-xs text-muted-foreground">
                  Si esta activado, el PDF muestra los precios con IVA (21%) aplicado.
                  En cualquier caso se indica en la lista si incluye o no IVA.
                </p>
              </div>
              <Switch
                checked={formData.incluye_iva ?? false}
                onCheckedChange={(v) =>
                  setFormData({ ...formData, incluye_iva: v })
                }
              />
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Notas internas..."
                rows={2}
              />
            </div>
              </div>

              {/* Columna derecha (solo al crear): contenido inicial */}
              <div className="space-y-4">
            {/* Sólo al crear: qué productos incluir de arranque */}
            {!listaEditar && (() => {
              const modo = formData.inicializar_items ?? 'todos';
              const seleccionados = new Set(formData.servicios_seleccionados ?? []);
              const busqueda = busquedaServicio.trim().toLowerCase();
              const catalogo = serviciosCatalogo.filter((s) => {
                if (!busqueda) return true;
                return (
                  s.codigo.toLowerCase().includes(busqueda) ||
                  s.nombre.toLowerCase().includes(busqueda)
                );
              });
              const opciones: { value: 'todos' | 'seleccion' | 'vacia'; titulo: string; sub: string }[] = [
                { value: 'todos', titulo: 'Todos los productos', sub: 'Precarga todos los productos activos con su precio base.' },
                { value: 'seleccion', titulo: 'Seleccionar productos', sub: 'Elegí a mano qué productos incluir.' },
                { value: 'vacia', titulo: 'Vacía', sub: 'La creo sin items y los cargo uno por uno después.' },
              ];
              const toggleServicio = (id: string, checked: boolean) => {
                const next = new Set(seleccionados);
                if (checked) next.add(id);
                else next.delete(id);
                setFormData({ ...formData, servicios_seleccionados: Array.from(next) });
              };
              return (
                <div className="rounded-md border border-border bg-background/50 p-3 space-y-3">
                  <div>
                    <Label className="text-sm">Contenido inicial de la lista</Label>
                    <p className="text-xs text-muted-foreground">
                      Definí qué productos precargar al crear. Después podés editar la lista igual.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {opciones.map((op) => (
                      <label
                        key={op.value}
                        className={
                          'flex items-start gap-3 cursor-pointer rounded-md border p-2.5 transition-colors ' +
                          (modo === op.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')
                        }
                      >
                        <input
                          type="radio"
                          name="inicializar_items"
                          value={op.value}
                          checked={modo === op.value}
                          onChange={() => setFormData({ ...formData, inicializar_items: op.value })}
                          className="mt-1"
                        />
                        <div>
                          <p className="text-sm font-medium">{op.titulo}</p>
                          <p className="text-xs text-muted-foreground">{op.sub}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  {modo === 'seleccion' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          value={busquedaServicio}
                          onChange={(e) => setBusquedaServicio(e.target.value)}
                          placeholder="Buscar producto por código o nombre..."
                          className="h-8"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {seleccionados.size} seleccionados
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              servicios_seleccionados: catalogo.map((s) => s.id),
                            })
                          }
                        >
                          Marcar todo lo visible
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() =>
                            setFormData({ ...formData, servicios_seleccionados: [] })
                          }
                        >
                          Limpiar
                        </Button>
                      </div>
                      <div className="max-h-56 overflow-y-auto rounded-md border">
                        {catalogo.length === 0 ? (
                          <p className="p-3 text-xs text-muted-foreground text-center">
                            No hay productos que coincidan con la búsqueda.
                          </p>
                        ) : (
                          catalogo.map((s) => (
                            <label
                              key={s.id}
                              className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-muted/50"
                            >
                              <Checkbox
                                checked={seleccionados.has(s.id)}
                                onCheckedChange={(v) => toggleServicio(s.id, v === true)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">
                                  <span className="font-mono text-xs text-muted-foreground mr-2">{s.codigo}</span>
                                  {s.nombre}
                                </p>
                              </div>
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                                {s.categoria?.replace('_', ' ')}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
              </div>{/* fin columna derecha */}
            </div>{/* fin grid 2 cols / stack */}
          </div>{/* fin body scroll */}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {listaEditar ? 'Guardar Cambios' : 'Crear Lista'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmacion de eliminacion */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Lista de Precios</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estas seguro de eliminar la lista "{listaEliminar?.nombre}"? Esta accion
              no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
