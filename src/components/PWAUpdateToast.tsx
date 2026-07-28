/**
 * PWAUpdateToast.tsx
 * Detects when a new service worker is available and prompts the
 * user to refresh to get the latest version.
 */

import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PWAUpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every 60 minutes
      if (r) setInterval(() => r.update(), 60 * 60 * 1000);
    },
    onRegisterError(error) {
      console.warn('SW registration error:', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed top-4 left-3 right-3 z-50 animate-in slide-in-from-top-4 duration-300">
      <div className="rounded-2xl border border-primary/30 bg-card shadow-xl shadow-black/20 overflow-hidden">
        <div className="h-0.5 bg-primary" />
        <div className="p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <RefreshCw className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">Update available</p>
            <p className="text-[11px] text-muted-foreground">Tap Reload to get the latest version</p>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-7 text-xs px-3 font-semibold"
              onClick={() => updateServiceWorker(true)}
            >
              Reload
            </Button>
            <button
              onClick={() => setNeedRefresh(false)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}