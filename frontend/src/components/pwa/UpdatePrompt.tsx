import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { Button } from '@/components/ui/button';

/**
 * Detecta cuando hay una nueva versión del SW disponible y muestra un toast
 * pidiendo al usuario que recargue. Solo aparece si hay conexión.
 */
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [actualizar, setActualizar] = useState<(() => Promise<void>) | null>(null);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const update = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onRegistered(reg: ServiceWorkerRegistration | undefined) {
        if (reg) {
          setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
        }
      },
    });
    setActualizar(() => () => update(true));
  }, []);

  const puedeActualizar = needRefresh && online;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md
        transition-all duration-300 ease-out
        ${puedeActualizar ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
    >
      <div className="bg-white border border-border rounded-2xl shadow-lg p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <RefreshCw className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">Hay una versión nueva</p>
          <p className="text-xs text-muted-foreground">Recargá para actualizar DUWHITE.</p>
        </div>
        <Button size="sm" onClick={() => actualizar?.()} className="shrink-0">
          Recargar
        </Button>
      </div>
    </div>
  );
}
