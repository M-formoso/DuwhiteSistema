/**
 * Modal para emitir UNA factura consolidada de TODOS los pedidos
 * del mes de un cliente.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

import { facturaService } from '@/services/facturaService';
import { clienteService } from '@/services/clienteService';
import { getErrorMessage } from '@/services/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function FacturarMesClienteModal({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const ahora = new Date();
  const [clienteId, setClienteId] = useState('');
  const [mes, setMes] = useState<number>(ahora.getMonth() + 1);
  const [anio, setAnio] = useState<number>(ahora.getFullYear());
  const [fechaEmision, setFechaEmision] = useState(new Date().toLocaleDateString('en-CA'));

  const { data: clientes } = useQuery({
    queryKey: ['clientes-lista'],
    queryFn: () => clienteService.getClientesLista(),
    enabled: open,
  });

  const facturarMut = useMutation({
    mutationFn: () =>
      facturaService.facturarMesCliente(clienteId, mes, anio, fechaEmision || undefined),
    onSuccess: (r) => {
      toast({
        title: 'Factura BORRADOR creada',
        description: `${r.items} ítems consolidados · Total ${r.total}. Revisá y emití a AFIP.`,
      });
      onOpenChange(false);
      navigate(`/facturacion/${r.factura_id}`);
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'No se pudo crear la factura mensual',
        description: getErrorMessage(err),
      });
    },
  });

  const aniosDisponibles = (() => {
    const out: number[] = [];
    for (let y = ahora.getFullYear() + 1; y >= ahora.getFullYear() - 3; y--) out.push(y);
    return out;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Factura mensual por cliente</DialogTitle>
          <DialogDescription>
            Crea UNA factura BORRADOR consolidando todos los pedidos no facturados
            del cliente en el mes seleccionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí un cliente" />
              </SelectTrigger>
              <SelectContent>
                {(clientes || []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre} {c.cuit ? `· ${c.cuit}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Mes</Label>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Año</Label>
              <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aniosDisponibles.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fecha de emisión</Label>
            <Input
              type="date"
              value={fechaEmision}
              onChange={(e) => setFechaEmision(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => facturarMut.mutate()}
            disabled={!clienteId || facturarMut.isPending}
          >
            {facturarMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generar factura BORRADOR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
