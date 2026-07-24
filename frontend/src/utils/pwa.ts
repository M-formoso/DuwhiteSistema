/** Helpers para detectar contexto PWA */

export const STORAGE_KEY_DISMISSED = 'duwhite:install-dismissed-at';

export function esIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const isIphoneOrIpad = /iphone|ipad|ipod/.test(ua);
  const isIpadOnDesktop =
    /macintosh/.test(ua) && 'ontouchend' in document && navigator.maxTouchPoints > 1;
  return isIphoneOrIpad || isIpadOnDesktop;
}

export function esSafariIos(): boolean {
  if (!esIos()) return false;
  const ua = navigator.userAgent.toLowerCase();
  return !/crios|fxios|edgios/.test(ua);
}

export function esStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function fueDismissedRecientemente(diasUmbral = 7): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISMISSED);
    if (!raw) return false;
    const cuando = Number(raw);
    const dias = (Date.now() - cuando) / (1000 * 60 * 60 * 24);
    return dias < diasUmbral;
  } catch {
    return false;
  }
}

export function marcarDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY_DISMISSED, String(Date.now()));
  } catch {
    // localStorage puede estar bloqueado (Safari incógnito)
  }
}
