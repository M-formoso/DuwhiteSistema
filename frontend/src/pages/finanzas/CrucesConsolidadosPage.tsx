/**
 * Página de Cruces Consolidados Cliente-Proveedor
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Users,
  Building2,
  ArrowRightLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Eye,
  Filter,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

import { crucesConsolidadosService } from '@/services/finanzasAvanzadasService';
import { formatNumber } from '@/utils/formatters';
import type { EntidadConsolidadaList } from '@/types/finanzas-avanzadas';

export default function CrucesConsolidadosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [soloCruzadas, setSoloCruzadas] = useState(false);
  const [conSaldo, setConSaldo] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(0);
  const limite = 20;

  // Query entidades
  const { data: entidadesData, isLoading } = useQuery({
    queryKey: ['cruces-consolidados', soloCruzadas, conSaldo, pagina],
    queryFn: () =>
      crucesConsolidadosService.getEntidades({
        skip: pagina * limite,
        limit: limite,
        solo_cruzadas: soloCruzadas,
        con_saldo: conSaldo,
      }),
  });

  // Query resumen
  const { data: resumen } = useQuery({
    queryKey: ['cruces-resumen'],
    queryFn: () => crucesConsolidadosService.getResumen(),
  });

  // Mutation sincronizar
  const sincronizarMutation = useMutation({
    mutationFn: () => crucesConsolidadosService.sincronizar(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cruces-consolidados'] });
      queryClient.invalidateQueries({ queryKey: ['cruces-resumen'] });
      toast({
        title: 'Sincronización completada',
        description: `${data.entidades_creadas} nuevas, ${data.entidades_actualizadas} actualizadas.`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo sincronizar las entidades.',
        variant: 'destructive',
      });
    },
  });

  const entidades = entidadesData?.items || [];
  const total = entidadesData?.total || 0;

  // Filtrar por búsqueda
  const entidadesFiltradas = busqueda
    ? entidades.filter(
        (e) =>
          e.razon_social.toLowerCase().includes(busqueda.toLowerCase()) ||
          e.cuit.includes(busqueda)
      )
    : entidades;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cruces Consolidados</h1>
          <p className="text-muted-foreground">
            Entidades que son cliente y proveedor simultáneamente
          </p>
        </div>
        <Button
          onClick={() => sincronizarMutation.mutate()}
          disabled={sincronizarMutation.isPending}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${sincronizarMutation.isPending ? 'animate-spin' : ''}`}
          />
          Sincronizar Entidades
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entidades</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumen?.total_entidades || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Cruce</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {resumen?.total_cruzadas || 0}
            </div>
            <p className="text-xs text-muted-foreground">Cliente + Proveedor</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nos Deben</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatNumber(resumen?.saldo_total_a_favor || 0, 'currency')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Debemos</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatNumber(resumen?.saldo_total_en_contra || 0, 'currency')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Neto</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                (resumen?.saldo_neto_global || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatNumber(resumen?.saldo_neto_global || 0, 'currency')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por razón social o CUIT..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="solo-cruzadas"
                  checked={soloCruzadas}
                  onCheckedChange={setSoloCruzadas}
                />
                <Label htmlFor="solo-cruzadas" className="text-sm">
                  Solo con cruce
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="con-saldo" checked={conSaldo} onCheckedChange={setConSaldo} />
                <Label htmlFor="con-saldo" className="text-sm">
                  Con saldo
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : entidadesFiltradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay entidades que mostrar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razón Social</TableHead>
                  <TableHead>CUIT</TableHead>
                  <TableHead className="text-center">Roles</TableHead>
                  <TableHead className="text-right">Saldo Cliente</TableHead>
                  <TableHead className="text-right">Saldo Proveedor</TableHead>
                  <TableHead className="text-right">Saldo Neto</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entidadesFiltradas.map((entidad: EntidadConsolidadaList) => (
                  <TableRow key={entidad.id}>
                    <TableCell className="font-medium">{entidad.razon_social}</TableCell>
                    <TableCell>{entidad.cuit}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        {entidad.es_cliente && (
                          <Badge variant="outline" className="text-blue-600 border-blue-200">
                            <Users className="h-3 w-3 mr-1" />
                            Cliente
                          </Badge>
                        )}
                        {entidad.es_proveedor && (
                          <Badge variant="outline" className="text-purple-600 border-purple-200">
                            <Building2 className="h-3 w-3 mr-1" />
                            Proveedor
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-right ${
                        entidad.saldo_como_cliente > 0 ? 'text-green-600' : ''
                      }`}
                    >
                      {entidad.es_cliente
                        ? formatNumber(entidad.saldo_como_cliente, 'currency')
                        : '-'}
                    </TableCell>
                    <TableCell
                      className={`text-right ${
                        entidad.saldo_como_proveedor > 0 ? 'text-red-600' : ''
                      }`}
                    >
                      {entidad.es_proveedor
                        ? formatNumber(entidad.saldo_como_proveedor, 'currency')
                        : '-'}
                    </TableCell>
                    <TableCell
                      className={`text-right font-bold ${
                        entidad.saldo_neto > 0
                          ? 'text-green-600'
                          : entidad.saldo_neto < 0
                          ? 'text-red-600'
                          : ''
                      }`}
                    >
                      {formatNumber(entidad.saldo_neto, 'currency')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/finanzas/cruces/${entidad.cuit}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Paginación */}
          {total > limite && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {pagina * limite + 1} - {Math.min((pagina + 1) * limite, total)} de{' '}
                {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                  disabled={pagina === 0}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina((p) => p + 1)}
                  disabled={(pagina + 1) * limite >= total}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
