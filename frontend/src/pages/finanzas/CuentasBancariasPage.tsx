/**
 * Página de Cuentas Bancarias
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Loader2,
  Building2,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Eye,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

import { finanzasService } from '@/services/finanzasService';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { CuentaBancaria, MovimientoBancario } from '@/types/finanzas';

interface CuentaFormData {
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  cbu: string;
  alias: string;
  titular: string;
  moneda: string;
  saldo_inicial: string;
}

const initialCuentaForm: CuentaFormData = {
  banco: '',
  tipo_cuenta: 'cuenta_corriente',
  numero_cuenta: '',
  cbu: '',
  alias: '',
  titular: 'DUWHITE SRL',
  moneda: 'ARS',
  saldo_inicial: '0',
};

interface MovimientoFormData {
  cuenta_id: string;
  tipo: string;
  monto: string;
  fecha: string;
  descripcion: string;
  numero_comprobante: string;
  categoria: string;
}

const TIPOS_CUENTA = [
  { value: 'cuenta_corriente', label: 'Cuenta Corriente' },
  { value: 'caja_ahorro', label: 'Caja de Ahorro' },
  { value: 'cuenta_sueldo', label: 'Cuenta Sueldo' },
];

const BANCOS_ARGENTINA = [
  'Banco Nación',
  'Banco Provincia',
  'Banco Galicia',
  'Banco Santander',
  'BBVA',
  'Banco Macro',
  'Banco ICBC',
  'Banco Credicoop',
  'Banco Patagonia',
  'Brubank',
  'Mercado Pago',
  'Ualá',
  'Otro',
];

const CATEGORIAS_MOVIMIENTO = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'deposito', label: 'Depósito' },
  { value: 'extraccion', label: 'Extracción' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'debito_automatico', label: 'Débito Automático' },
  { value: 'comision', label: 'Comisión Bancaria' },
  { value: 'interes', label: 'Interés' },
  { value: 'otro', label: 'Otro' },
];

export default function CuentasBancariasPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCuentaDialogOpen, setIsCuentaDialogOpen] = useState(false);
  const [isMovimientoDialogOpen, setIsMovimientoDialogOpen] = useState(false);
  const [isMovimientosDialogOpen, setIsMovimientosDialogOpen] = useState(false);
  const [cuentaForm, setCuentaForm] = useState<CuentaFormData>(initialCuentaForm);
  const [movimientoForm, setMovimientoForm] = useState<MovimientoFormData>({
    cuenta_id: '',
    tipo: 'ingreso',
    monto: '',
    fecha: new Date().toISOString().split('T')[0],
    descripcion: '',
    numero_comprobante: '',
    categoria: 'transferencia',
  });
  const [selectedCuenta, setSelectedCuenta] = useState<CuentaBancaria | null>(null);

  // Cargar cuentas
  const { data: cuentas, isLoading } = useQuery({
    queryKey: ['cuentas-bancarias'],
    queryFn: () => finanzasService.getCuentasBancarias(false),
  });

  // Cargar movimientos de cuenta seleccionada
  const { data: movimientosData, isLoading: isLoadingMovimientos } = useQuery({
    queryKey: ['movimientos-bancarios', selectedCuenta?.id],
    queryFn: () => finanzasService.getMovimientosBancarios(selectedCuenta!.id, { limit: 50 }),
    enabled: Boolean(selectedCuenta),
  });

  // Crear cuenta
  const createCuentaMutation = useMutation({
    mutationFn: (data: Partial<CuentaBancaria>) => finanzasService.createCuentaBancaria(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cuentas-bancarias'] });
      toast({ title: 'Cuenta creada', description: 'La cuenta bancaria se creó correctamente.' });
      setIsCuentaDialogOpen(false);
      setCuentaForm(initialCuentaForm);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear la cuenta.',
        variant: 'destructive',
      });
    },
  });

  // Crear movimiento
  const createMovimientoMutation = useMutation({
    mutationFn: (data: any) => finanzasService.createMovimientoBancario(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cuentas-bancarias'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos-bancarios'] });
      toast({ title: 'Movimiento registrado', description: 'El movimiento se registró correctamente.' });
      setIsMovimientoDialogOpen(false);
      setMovimientoForm({
        cuenta_id: '',
        tipo: 'ingreso',
        monto: '',
        fecha: new Date().toISOString().split('T')[0],
        descripcion: '',
        numero_comprobante: '',
        categoria: 'transferencia',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo registrar el movimiento.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmitCuenta = (e: React.FormEvent) => {
    e.preventDefault();

    if (!cuentaForm.banco.trim()) {
      toast({ title: 'Error', description: 'El banco es requerido.', variant: 'destructive' });
      return;
    }
    if (!cuentaForm.numero_cuenta.trim()) {
      toast({ title: 'Error', description: 'El número de cuenta es requerido.', variant: 'destructive' });
      return;
    }

    createCuentaMutation.mutate({
      banco: cuentaForm.banco,
      tipo_cuenta: cuentaForm.tipo_cuenta,
      numero_cuenta: cuentaForm.numero_cuenta,
      cbu: cuentaForm.cbu || null,
      alias: cuentaForm.alias || null,
      titular: cuentaForm.titular,
      moneda: cuentaForm.moneda,
      saldo_inicial: parseFloat(cuentaForm.saldo_inicial) || 0,
      activo: true,
    } as any);
  };

  const handleSubmitMovimiento = (e: React.FormEvent) => {
    e.preventDefault();

    if (!movimientoForm.cuenta_id) {
      toast({ title: 'Error', description: 'Selecciona una cuenta.', variant: 'destructive' });
      return;
    }
    if (!movimientoForm.monto || parseFloat(movimientoForm.monto) <= 0) {
      toast({ title: 'Error', description: 'Ingresa un monto válido.', variant: 'destructive' });
      return;
    }

    createMovimientoMutation.mutate({
      cuenta_id: movimientoForm.cuenta_id,
      tipo: movimientoForm.tipo,
      monto: parseFloat(movimientoForm.monto),
      fecha: movimientoForm.fecha,
      descripcion: movimientoForm.descripcion || null,
      numero_comprobante: movimientoForm.numero_comprobante || null,
      categoria: movimientoForm.categoria,
    });
  };

  const handleVerMovimientos = (cuenta: CuentaBancaria) => {
    setSelectedCuenta(cuenta);
    setIsMovimientosDialogOpen(true);
  };

  // Calcular totales
  const saldoTotal = cuentas?.reduce((sum, c) => sum + (c.saldo_actual || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cuentas Bancarias</h1>
          <p className="text-gray-500">Gestiona las cuentas y movimientos bancarios</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsMovimientoDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Movimiento
          </Button>
          <Button onClick={() => setIsCuentaDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Cuenta
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo Total</p>
                <p className="text-2xl font-bold">{formatCurrency(saldoTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cuentas Activas</p>
                <p className="text-2xl font-bold">{cuentas?.filter((c) => c.activo ?? c.activa).length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <RefreshCw className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cuentas</p>
                <p className="text-2xl font-bold">{cuentas?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Cuentas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Cuentas Registradas
          </CardTitle>
          <CardDescription>Administra tus cuentas bancarias</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !cuentas || cuentas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay cuentas bancarias registradas</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsCuentaDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Primera Cuenta
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Banco</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>CBU / Alias</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cuentas.map((cuenta) => (
                    <TableRow key={cuenta.id} className={!(cuenta.activo ?? cuenta.activa) ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{cuenta.banco}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {TIPOS_CUENTA.find((t) => t.value === cuenta.tipo_cuenta)?.label ||
                          cuenta.tipo_cuenta}
                      </TableCell>
                      <TableCell className="font-mono">{cuenta.numero_cuenta}</TableCell>
                      <TableCell>
                        {cuenta.alias ? (
                          <span className="text-primary">{cuenta.alias}</span>
                        ) : cuenta.cbu ? (
                          <span className="font-mono text-xs">{cuenta.cbu}</span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-medium ${
                            (cuenta.saldo_actual || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(cuenta.saldo_actual || 0)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={(cuenta.activo ?? cuenta.activa) ? 'success' : 'secondary'}>
                          {(cuenta.activo ?? cuenta.activa) ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleVerMovimientos(cuenta)}
                          title="Ver movimientos"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Nueva Cuenta */}
      <Dialog open={isCuentaDialogOpen} onOpenChange={setIsCuentaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Cuenta Bancaria</DialogTitle>
            <DialogDescription>Registra una nueva cuenta bancaria</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitCuenta} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="banco">
                  Banco <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={cuentaForm.banco}
                  onValueChange={(value) => setCuentaForm({ ...cuentaForm, banco: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANCOS_ARGENTINA.map((banco) => (
                      <SelectItem key={banco} value={banco}>
                        {banco}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo_cuenta">Tipo de Cuenta</Label>
                <Select
                  value={cuentaForm.tipo_cuenta}
                  onValueChange={(value) => setCuentaForm({ ...cuentaForm, tipo_cuenta: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CUENTA.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero_cuenta">
                Número de Cuenta <span className="text-destructive">*</span>
              </Label>
              <Input
                id="numero_cuenta"
                value={cuentaForm.numero_cuenta}
                onChange={(e) => setCuentaForm({ ...cuentaForm, numero_cuenta: e.target.value })}
                placeholder="0000-0000-0000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cbu">CBU</Label>
                <Input
                  id="cbu"
                  value={cuentaForm.cbu}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, cbu: e.target.value })}
                  placeholder="22 dígitos"
                  maxLength={22}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alias">Alias</Label>
                <Input
                  id="alias"
                  value={cuentaForm.alias}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, alias: e.target.value })}
                  placeholder="MI.ALIAS.CBU"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="titular">Titular</Label>
                <Input
                  id="titular"
                  value={cuentaForm.titular}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, titular: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saldo_inicial">Saldo Inicial</Label>
                <Input
                  id="saldo_inicial"
                  type="number"
                  step="0.01"
                  value={cuentaForm.saldo_inicial}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, saldo_inicial: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCuentaDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createCuentaMutation.isPending}>
                {createCuentaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Cuenta
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Nuevo Movimiento */}
      <Dialog open={isMovimientoDialogOpen} onOpenChange={setIsMovimientoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Movimiento Bancario</DialogTitle>
            <DialogDescription>Registra un ingreso o egreso bancario</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitMovimiento} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cuenta_id">
                Cuenta <span className="text-destructive">*</span>
              </Label>
              <Select
                value={movimientoForm.cuenta_id}
                onValueChange={(value) => setMovimientoForm({ ...movimientoForm, cuenta_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {cuentas
                    ?.filter((c) => c.activo ?? c.activa)
                    .map((cuenta) => (
                      <SelectItem key={cuenta.id} value={cuenta.id}>
                        {cuenta.banco} - {cuenta.numero_cuenta}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select
                  value={movimientoForm.tipo}
                  onValueChange={(value) => setMovimientoForm({ ...movimientoForm, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                    <SelectItem value="egreso">Egreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoría</Label>
                <Select
                  value={movimientoForm.categoria}
                  onValueChange={(value) => setMovimientoForm({ ...movimientoForm, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_MOVIMIENTO.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monto">
                  Monto <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="monto"
                  type="number"
                  step="0.01"
                  min="0"
                  value={movimientoForm.monto}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, monto: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={movimientoForm.fecha}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, fecha: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Input
                id="descripcion"
                value={movimientoForm.descripcion}
                onChange={(e) => setMovimientoForm({ ...movimientoForm, descripcion: e.target.value })}
                placeholder="Descripción del movimiento"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero_comprobante">N° Comprobante</Label>
              <Input
                id="numero_comprobante"
                value={movimientoForm.numero_comprobante}
                onChange={(e) =>
                  setMovimientoForm({ ...movimientoForm, numero_comprobante: e.target.value })
                }
                placeholder="N° transferencia, cheque, etc."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsMovimientoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMovimientoMutation.isPending}>
                {createMovimientoMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Ver Movimientos */}
      <Dialog open={isMovimientosDialogOpen} onOpenChange={setIsMovimientosDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Movimientos - {selectedCuenta?.banco} ({selectedCuenta?.numero_cuenta})
            </DialogTitle>
            <DialogDescription>
              Saldo actual: {formatCurrency(selectedCuenta?.saldo_actual || 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[50vh]">
            {isLoadingMovimientos ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !movimientosData?.items || movimientosData.items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay movimientos registrados</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientosData.items.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell>{formatDate(mov.fecha)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {mov.tipo === 'ingreso' ? (
                            <ArrowDownRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-red-600" />
                          )}
                          <span>{mov.descripcion || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {CATEGORIAS_MOVIMIENTO.find((c) => c.value === mov.categoria)?.label ||
                          mov.categoria}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-medium ${
                            mov.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {mov.tipo === 'ingreso' ? '+' : '-'}
                          {formatCurrency(mov.monto)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMovimientosDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
