import { useEffect, useRef, useState } from 'react';
import { Download, Share, Plus, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  esSafariIos,
  esStandalone,
  fueDismissedRecientemente,
  marcarDismissed,
} from '@/utils/pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function useSlideBanner() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    setMounted(true);
    timerRef.current = setTimeout(() => setVisible(true), 30);
  };

  const hide = (onDone?: () => void) => {
    setVisible(false);
    timerRef.current = setTimeout(() => {
      setMounted(false);
      onDone?.();
    }, 320);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { mounted, visible, show, hide };
}

/**
 * Invita al usuario a instalar DUWHITE como PWA.
 * - Android / Chrome desktop: banner inferior con botón "Instalar" nativo.
 * - iOS Safari: banner que abre tutorial paso a paso.
 * - Si ya está instalada (standalone) o el usuario la cerró (7 días), no aparece.
 */
export function InstallPrompt() {
  const [androidEvent, setAndroidEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosTutorial, setIosTutorial] = useState(false);
  const android = useSlideBanner();
  const ios = useSlideBanner();

  useEffect(() => {
    if (esStandalone() || fueDismissedRecientemente()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setAndroidEvent(e as BeforeInstallPromptEvent);
      setTimeout(() => android.show(), 5000);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    if (esSafariIos()) {
      setTimeout(() => ios.show(), 8000);
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cerrarAndroid = () => {
    marcarDismissed();
    android.hide(() => setAndroidEvent(null));
  };

  const instalarAndroid = async () => {
    if (!androidEvent) return;
    await androidEvent.prompt();
    const choice = await androidEvent.userChoice;
    android.hide(() => setAndroidEvent(null));
    if (choice.outcome === 'dismissed') marcarDismissed();
  };

  const cerrarIos = () => {
    marcarDismissed();
    setIosTutorial(false);
    ios.hide();
  };

  const bannerBase =
    'fixed bottom-4 left-4 right-4 z-40 lg:left-auto lg:right-4 lg:max-w-sm transition-all duration-300 ease-out';
  const visibleCls = 'translate-y-0 opacity-100';
  const hiddenCls = 'translate-y-full opacity-0';

  return (
    <>
      {/* Android — banner inferior */}
      {android.mounted && androidEvent && (
        <div className={`${bannerBase} ${android.visible ? visibleCls : hiddenCls}`}>
          <div className="bg-white border border-border rounded-2xl shadow-lg p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <img src="/favicon.svg" alt="DUWHITE" className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">Instalá DUWHITE</p>
              <p className="text-xs text-muted-foreground">Acceso rápido desde tu inicio.</p>
            </div>
            <Button size="sm" onClick={instalarAndroid} className="shrink-0">
              <Download className="h-3.5 w-3.5 mr-1" />
              Instalar
            </Button>
            <button
              onClick={cerrarAndroid}
              aria-label="Cerrar"
              className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center shrink-0"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* iOS — banner */}
      {ios.mounted && !iosTutorial && (
        <div className={`${bannerBase} ${ios.visible ? visibleCls : hiddenCls}`}>
          <div className="bg-white border border-border rounded-2xl shadow-lg p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <img src="/favicon.svg" alt="DUWHITE" className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">Instalá DUWHITE</p>
              <p className="text-xs text-muted-foreground">Como app en tu iPhone — 2 toques.</p>
            </div>
            <Button size="sm" onClick={() => setIosTutorial(true)} className="shrink-0">
              Cómo
            </Button>
            <button
              onClick={cerrarIos}
              aria-label="Cerrar"
              className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center shrink-0"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* iOS — overlay con instrucciones */}
      {iosTutorial && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={cerrarIos}
          />
          <div className="relative bg-white w-full rounded-t-2xl shadow-xl max-w-md p-6 z-10">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <Smartphone className="h-6 w-6 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Instalá DUWHITE</h2>
              </div>
              <button
                onClick={cerrarIos}
                aria-label="Cerrar"
                className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Asegurate de estar en Safari (no funciona en Chrome para iOS).
            </p>
            <ol className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="h-7 w-7 shrink-0 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center">1</span>
                <p className="text-sm text-foreground">
                  Tocá el botón{' '}
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-muted mx-1">
                    <Share className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <strong>Compartir</strong> en la barra inferior de Safari.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-7 w-7 shrink-0 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center">2</span>
                <p className="text-sm text-foreground">
                  Bajá y elegí{' '}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted mx-0.5 text-xs font-medium">
                    <Plus className="h-3 w-3" />Agregar a inicio
                  </span>.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-7 w-7 shrink-0 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center">3</span>
                <p className="text-sm text-foreground">
                  Confirmá <strong>Agregar</strong>. El ícono de DUWHITE aparece en tu home.
                </p>
              </li>
            </ol>
            <Button onClick={cerrarIos} variant="outline" className="w-full mt-6">
              Entendido
            </Button>
            <div className="pb-[env(safe-area-inset-bottom)]" />
          </div>
        </div>
      )}
    </>
  );
}
