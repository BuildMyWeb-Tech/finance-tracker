/**
 * PWAInstallPrompt.tsx
 * Shows a native-style install banner when the browser fires
 * the `beforeinstallprompt` event (Android Chrome / Edge / Desktop Chrome).
 * Also shows an iOS manual-install tip on Safari.
 */

import { useEffect, useState } from 'react';
import { X, Download, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Extend Window to include the non-standard beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as any).standalone === true)
  );
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIOS, setShowIOS]         = useState(false);
  const [dismissed, setDismissed]     = useState(false);

  useEffect(() => {
    // Already installed — don't show
    if (isInStandaloneMode()) return;
    // Already dismissed this session
    if (sessionStorage.getItem('pwa-prompt-dismissed')) return;

    // iOS Safari — show manual tip
    if (isIOS()) {
      setShowIOS(true);
      return;
    }

    // Android / Desktop Chrome/Edge
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowAndroid(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    setShowAndroid(false);
    setShowIOS(false);
    setDismissed(true);
    sessionStorage.setItem('pwa-prompt-dismissed', '1');
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowAndroid(false);
      setDeferredPrompt(null);
    }
  };

  if (dismissed || (!showAndroid && !showIOS)) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/20 overflow-hidden">
        {/* Green accent bar */}
        <div className="h-1 bg-gradient-to-r from-primary via-green-400 to-primary" />

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* App icon */}
            <img
              src="/icons/icon-96x96.png"
              alt="App icon"
              className="h-12 w-12 rounded-xl shrink-0 border border-border/40"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    Install Realm Rich Reporter
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {showIOS
                      ? 'Add to Home Screen for the full app experience'
                      : 'Install as app — works offline, no browser bar'}
                  </p>
                </div>
                <button
                  onClick={dismiss}
                  className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0 mt-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Android / Desktop */}
              {showAndroid && (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5 font-semibold"
                    onClick={handleInstall}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Install App
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs px-3"
                    onClick={dismiss}
                  >
                    Not now
                  </Button>
                </div>
              )}

              {/* iOS Safari instructions */}
              {showIOS && (
                <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 mb-1 text-foreground font-medium">
                    <Share className="h-3.5 w-3.5 text-primary" />
                    How to install on iPhone / iPad
                  </div>
                  <ol className="space-y-0.5 list-decimal list-inside">
                    <li>Tap the <strong>Share</strong> button in Safari toolbar</li>
                    <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                    <li>Tap <strong>Add</strong> — done!</li>
                  </ol>
                  <button
                    onClick={dismiss}
                    className="mt-2 text-primary text-xs underline underline-offset-2"
                  >
                    Got it, dismiss
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}