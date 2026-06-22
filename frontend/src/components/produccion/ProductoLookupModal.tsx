import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/formatters';
import { ProductoConPrecio } from '@/types/produccion-v2';

interface ProductoLookupModalProps {
  open: boolean;
  onClose: () => void;
  productos: ProductoConPrecio[];
  onSelect: (producto: ProductoConPrecio) => void;
}

const formatearCodigo = (codigo: string) => {
  const limpio = (codigo || '').trim();
  if (/^\d+$/.test(limpio)) return limpio.padStart(4, '0');
  return limpio;
};

export function ProductoLookupModal({
  open,
  onClose,
  productos,
  onSelect,
}: ProductoLookupModalProps) {
  const [busqueda, setBusqueda] = useState('');
  const [indiceSeleccion, setIndiceSeleccion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setBusqueda('');
      setIndiceSeleccion(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = [...productos].sort((a, b) =>
      a.producto_nombre.localeCompare(b.producto_nombre, 'es')
    );
    if (!q) return base;
    return base.filter(
      (p) =>
        p.producto_nombre.toLowerCase().includes(q) ||
        p.producto_codigo.toLowerCase().includes(q)
    );
  }, [productos, busqueda]);

  useEffect(() => {
    setIndiceSeleccion(0);
  }, [busqueda]);

  const seleccionar = (p: ProductoConPrecio) => {
    onSelect(p);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceSeleccion((i) => Math.min(i + 1, filtrados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceSeleccion((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const p = filtrados[indiceSeleccion];
      if (p) seleccionar(p);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  useEffect(() => {
    if (!listaRef.current) return;
    const row = listaRef.current.querySelector<HTMLDivElement>(
      `[data-idx="${indiceSeleccion}"]`
    );
    row?.scrollIntoView({ block: 'nearest' });
  }, [indiceSeleccion]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Seleccione el Artículo
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={inputRef}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar por nombre o código..."
              className="pl-9"
              autoComplete="off"
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">↑</kbd>{' '}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">↓</kbd>{' '}
            para moverte ·{' '}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">Enter</kbd>{' '}
            para seleccionar ·{' '}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">Esc</kbd>{' '}
            para cerrar
          </p>
        </div>

        <div
          ref={listaRef}
          className="max-h-[60vh] overflow-y-auto"
        >
          <div className="sticky top-0 grid grid-cols-12 gap-2 px-5 py-2 text-xs font-semibold text-gray-500 border-b bg-gray-50">
            <div className="col-span-7">Descripción</div>
            <div className="col-span-3 text-right">Precio</div>
            <div className="col-span-2 text-right">Código</div>
          </div>

          {filtrados.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No se encontraron productos</p>
            </div>
          ) : (
            filtrados.map((p, idx) => (
              <div
                key={p.producto_id}
                data-idx={idx}
                onClick={() => seleccionar(p)}
                onMouseEnter={() => setIndiceSeleccion(idx)}
                className={`grid grid-cols-12 gap-2 px-5 py-2 text-sm border-b cursor-pointer transition-colors ${
                  idx === indiceSeleccion
                    ? 'bg-primary/10 text-primary-foreground'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="col-span-7 font-medium text-gray-800 uppercase truncate">
                  {p.producto_nombre}
                </div>
                <div className="col-span-3 text-right text-gray-600">
                  {p.tiene_precio
                    ? formatCurrency(p.precio_unitario)
                    : <span className="text-gray-400">—</span>}
                </div>
                <div className="col-span-2 text-right font-mono text-gray-700">
                  {formatearCodigo(p.producto_codigo)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50 text-xs text-gray-500">
          <span>{filtrados.length} producto{filtrados.length === 1 ? '' : 's'}</span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProductoLookupModal;
