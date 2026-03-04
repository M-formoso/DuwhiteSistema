/**
 * Página de Etapas de Producción
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Loader2,
  Settings2,
  Clock,
  Scale,
  Cog,
  Play,
  Flag,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

import { produccionService } from '@/services/produccionService';
import type { EtapaProduccion } from '@/types/produccion';

interface FormData {
  codigo: string;
  nombre: string;
  descripcion: string;
  orden: string;
  color: string;
  es_inicial: boolean;
  es_final: boolean;
  requiere_peso: boolean;
  requiere_maquina: boolean;
  tiempo_estimado_minutos: string;
  activo: boolean;
}

const initialFormData: FormData = {
  codigo: '',
  nombre: '',
  descripcion: '',
  orden: '0',
  color: '#00BCD4',
  es_inicial: false,
  es_final: false,
  requiere_peso: false,
  requiere_maquina: false,
  tiempo_estimado_minutos: '',
  activo: true,
};

const COLORES_PREDEFINIDOS = [
  '#00BCD4', // Turquesa (primary)
  '#3B82F6', // Azul
  '#8B5CF6', // Violeta
  '#EC4899', // Rosa
  '#EF4444', // Rojo
  '#F59E0B', // Naranja
  '#22C55E', // Verde
  '#6B7280', // Gris
];

export default function EtapasProduccionPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEtapa, setEditingEtapa] = useState<EtapaProduccion | null>(null);
  const [deleteEtapa, setDeleteEtapa] = useState<EtapaProduccion | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  // Cargar etapas
  const { data: etapas, isLoading } = useQuery({
    queryKey: ['etapas-produccion'],
    queryFn: () => produccionService.getEtapas(false),
  });

  // Crear etapa
  const createMutation = useMutation({
    mutationFn: (data: Partial<EtapaProduccion>) => produccionService.createEtapa(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etapas-produccion'] });
      toast({ title: 'Etapa creada', description: 'La etapa se creó correctamente.' });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear la etapa.',
        variant: 'destructive',
      });
    },
  });

  // Actualizar etapa
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EtapaProduccion> }) =>
      produccionService.updateEtapa(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etapas-produccion'] });
      toast({ title: 'Etapa actualizada', description: 'La etapa se actualizó correctamente.' });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar la etapa.',
        variant: 'destructive',
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingEtapa(null);
    const maxOrden = etapas?.reduce((max, e) => Math.max(max, e.orden), -1) ?? -1;
    setFormData({ ...initialFormData, orden: String(maxOrden + 1) });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (etapa: EtapaProduccion) => {
    setEditingEtapa(etapa);
    setFormData({
      codigo: etapa.codigo,
      nombre: etapa.nombre,
      descripcion: etapa.descripcion || '',
      orden: String(etapa.orden),
      color: etapa.color,
      es_inicial: etapa.es_inicial,
      es_final: etapa.es_final,
      requiere_peso: etapa.requiere_peso,
      requiere_maquina: etapa.requiere_maquina,
      tiempo_estimado_minutos: etapa.tiempo_estimado_minutos?.toString() || '',
      activo: etapa.activo,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEtapa(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.codigo.trim()) {
      toast({ title: 'Error', description: 'El código es requerido.', variant: 'destructive' });
      return;
    }
    if (!formData.nombre.trim()) {
      toast({ title: 'Error', description: 'El nombre es requerido.', variant: 'destructive' });
      return;
    }

    const data: Partial<EtapaProduccion> = {
      codigo: formData.codigo.trim().toUpperCase(),
      nombre: formData.nombre.trim(),
      descripcion: formData.descripcion.trim() || null,
      orden: parseInt(formData.orden) || 0,
      color: formData.color,
      es_inicial: formData.es_inicial,
      es_final: formData.es_final,
      requiere_peso: formData.requiere_peso,
      requiere_maquina: formData.requiere_maquina,
      tiempo_estimado_minutos: formData.tiempo_estimado_minutos
        ? parseInt(formData.tiempo_estimado_minutos)
        : null,
      activo: formData.activo,
    };

    if (editingEtapa) {
      updateMutation.mutate({ id: editingEtapa.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (deleteEtapa) {
      updateMutation.mutate({ id: deleteEtapa.id, data: { activo: false } });
      setDeleteEtapa(null);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Ordenar etapas
  const etapasOrdenadas = [...(etapas || [])].sort((a, b) => a.orden - b.orden);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Etapas de Producción</h1>
          <p className="text-gray-500">Configura las etapas del proceso productivo</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Etapa
        </Button>
      </div>

      {/* Lista de Etapas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configuración de Etapas
          </CardTitle>
          <CardDescription>
            Define el flujo de trabajo de producción. Las etapas se muestran en el tablero Kanban.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : etapasOrdenadas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Settings2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay etapas configuradas</p>
              <Button variant="outline" className="mt-4" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Etapa
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Orden</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Configuración</TableHead>
                    <TableHead>Tiempo Est.</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {etapasOrdenadas.map((etapa) => (
                    <TableRow key={etapa.id} className={!etapa.activo ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                          {etapa.orden}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-medium">{etapa.codigo}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{etapa.nombre}</p>
                          {etapa.descripcion && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {etapa.descripcion}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-md border"
                            style={{ backgroundColor: etapa.color }}
                          />
                          <span className="text-xs font-mono text-muted-foreground">
                            {etapa.color}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {etapa.es_inicial && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Play className="h-3 w-3" />
                              Inicial
                            </Badge>
                          )}
                          {etapa.es_final && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Flag className="h-3 w-3" />
                              Final
                            </Badge>
                          )}
                          {etapa.requiere_peso && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Scale className="h-3 w-3" />
                              Peso
                            </Badge>
                          )}
                          {etapa.requiere_maquina && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Cog className="h-3 w-3" />
                              Máquina
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {etapa.tiempo_estimado_minutos ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {etapa.tiempo_estimado_minutos} min
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={etapa.activo ? 'success' : 'secondary'}>
                          {etapa.activo ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(etapa)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteEtapa(etapa)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visualización del flujo */}
      {etapasOrdenadas.filter((e) => e.activo).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Flujo de Producción</CardTitle>
            <CardDescription>Vista previa del flujo de trabajo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 overflow-x-auto pb-4">
              {etapasOrdenadas
                .filter((e) => e.activo)
                .map((etapa, index, arr) => (
                  <div key={etapa.id} className="flex items-center">
                    <div
                      className="flex flex-col items-center p-3 rounded-lg min-w-[120px]"
                      style={{ backgroundColor: `${etapa.color}20`, borderColor: etapa.color }}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold mb-1"
                        style={{ backgroundColor: etapa.color }}
                      >
                        {etapa.orden + 1}
                      </div>
                      <span className="text-xs font-medium text-center">{etapa.nombre}</span>
                      {etapa.es_inicial && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          Inicio
                        </Badge>
                      )}
                      {etapa.es_final && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          Fin
                        </Badge>
                      )}
                    </div>
                    {index < arr.length - 1 && (
                      <div className="w-8 h-0.5 bg-gray-300 mx-1" />
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog Crear/Editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEtapa ? 'Editar Etapa' : 'Nueva Etapa'}</DialogTitle>
            <DialogDescription>
              {editingEtapa
                ? 'Modifica la configuración de la etapa'
                : 'Crea una nueva etapa de producción'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">
                  Código <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
                  }
                  placeholder="LAV"
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orden">Orden</Label>
                <Input
                  id="orden"
                  type="number"
                  min="0"
                  value={formData.orden}
                  onChange={(e) => setFormData({ ...formData, orden: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Lavado"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción de la etapa..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLORES_PREDEFINIDOS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-md border-2 transition-all ${
                      formData.color === color ? 'border-gray-900 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-8 h-8 p-0 border-0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tiempo_estimado">Tiempo Estimado (minutos)</Label>
              <Input
                id="tiempo_estimado"
                type="number"
                min="0"
                value={formData.tiempo_estimado_minutos}
                onChange={(e) =>
                  setFormData({ ...formData, tiempo_estimado_minutos: e.target.value })
                }
                placeholder="60"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="es_inicial" className="cursor-pointer">
                    Etapa Inicial
                  </Label>
                </div>
                <Switch
                  id="es_inicial"
                  checked={formData.es_inicial}
                  onCheckedChange={(checked) => setFormData({ ...formData, es_inicial: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="es_final" className="cursor-pointer">
                    Etapa Final
                  </Label>
                </div>
                <Switch
                  id="es_final"
                  checked={formData.es_final}
                  onCheckedChange={(checked) => setFormData({ ...formData, es_final: checked })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="requiere_peso" className="cursor-pointer">
                    Requiere Peso
                  </Label>
                </div>
                <Switch
                  id="requiere_peso"
                  checked={formData.requiere_peso}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, requiere_peso: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Cog className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="requiere_maquina" className="cursor-pointer">
                    Requiere Máquina
                  </Label>
                </div>
                <Switch
                  id="requiere_maquina"
                  checked={formData.requiere_maquina}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, requiere_maquina: checked })
                  }
                />
              </div>
            </div>

            {editingEtapa && (
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <Label htmlFor="activo" className="cursor-pointer">
                  Etapa Activa
                </Label>
                <Switch
                  id="activo"
                  checked={formData.activo}
                  onCheckedChange={(checked) => setFormData({ ...formData, activo: checked })}
                />
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingEtapa ? 'Guardar Cambios' : 'Crear Etapa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog Eliminar */}
      <AlertDialog open={!!deleteEtapa} onOpenChange={() => setDeleteEtapa(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              La etapa "{deleteEtapa?.nombre}" será desactivada y no aparecerá en el Kanban.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
