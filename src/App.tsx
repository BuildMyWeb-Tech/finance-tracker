/**
 * App.tsx — Updated with PersonWisePage route
 * Replace existing src/App.tsx with this file.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FinanceProvider, useFinance } from "@/contexts/FinanceContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef, useState } from "react";
import BottomNav from "@/components/BottomNav";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import PWAUpdateToast from "@/components/PWAUpdateToast";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import BudgetPage from "./pages/BudgetPage";
import Reports from "./pages/Reports";
import IncomePage from "./pages/IncomePage";
import SettingsPage from "./pages/SettingsPage";
import PersonWisePage from "./pages/PersonWisePage";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import BulkUploadPage from "./pages/BulkUploadPage";
import LedgerPage from "./pages/LedgerPage";
import AnalysisPage from "./pages/AnalysisPage";
import GlobalSearch from "./components/GlobalSearch";

const queryClient = new QueryClient();

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#1A1F16',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      fontFamily: '"DM Sans", sans-serif',
    }}>
      <div style={{
        width: '52px', height: '52px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #C9A84C, #A07830)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '26px', color: '#1A1F16', fontWeight: '700',
      }}>₹</div>
      <p style={{ color: '#A89F8C', fontSize: '14px', margin: 0 }}>Loading your data…</p>
      <div style={{ width: '120px', height: '3px', background: 'rgba(201,168,76,0.15)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, #C9A84C, #4CAF73)',
          borderRadius: '99px',
          animation: 'loadBar 1.5s ease-in-out infinite',
          width: '40%',
        }} />
      </div>
      <style>{`@keyframes loadBar { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
    </div>
  );
}

function SyncIndicator() {
  const { isSyncing, syncTarget } = useFinance();
  const visible = isSyncing || syncTarget !== null;
  if (!visible) return null;

  const isLocal = syncTarget === 'local';
  const isDone  = !isSyncing && syncTarget !== null;
  const color   = isLocal ? '#f59e0b' : '#4CAF73';
  const label   = isSyncing
    ? 'Saving…'
    : isLocal
      ? '⚠ Saved locally (offline)'
      : '✓ Saved to cloud';

  return (
    <div style={{
      position: 'fixed', top: '12px', right: '12px', zIndex: 9999,
      background: 'rgba(26,31,22,0.92)',
      border: `1px solid ${color}55`,
      borderRadius: '20px', padding: '4px 10px',
      display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '11px', color,
      fontFamily: '"DM Sans", sans-serif',
      backdropFilter: 'blur(8px)',
      transition: 'opacity 0.3s',
    }}>
      {isSyncing
        ? <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, animation: 'pulse 1s infinite' }} />
        : null}
      {label}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}

function PullToRefresh() {
  const { refreshFromCloud } = useFinance();
  const startY = useRef(0);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const THRESHOLD = 80;

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) startY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!startY.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 20 && window.scrollY === 0) setPulling(true);
      else setPulling(false);
    };
    const onTouchEnd = async (e: TouchEvent) => {
      const delta = e.changedTouches[0].clientY - startY.current;
      startY.current = 0;
      setPulling(false);
      if (delta >= THRESHOLD && window.scrollY === 0) {
        setRefreshing(true);
        await refreshFromCloud();
        setRefreshing(false);
      }
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [refreshFromCloud]);

  if (!pulling && !refreshing) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9998,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '10px', background: 'rgba(26,31,22,0.9)',
      fontSize: '12px', color: '#C9A84C', gap: '8px',
      fontFamily: '"DM Sans", sans-serif',
    }}>
      {refreshing
        ? <><div style={{ width: '14px', height: '14px', border: '2px solid #C9A84C44', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Loading from cloud…</>
        : '↓ Release to refresh'}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AppContent() {
  const { isLoading } = useFinance();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(s => !s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (isLoading) return <LoadingScreen />;

  return (
    <BrowserRouter>
      <SyncIndicator />
      <PullToRefresh />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/income" element={<IncomePage />} />
        <Route path="/budget" element={<BudgetPage />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/persons" element={<PersonWisePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/bulk-upload" element={<BulkUploadPage />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNav onSearchOpen={() => setSearchOpen(true)} />
    </BrowserRouter>
  );
}

function AuthGate() {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <LoginPage />;
  return (
    <FinanceProvider>
      <AppContent />
    </FinanceProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
      <PWAInstallPrompt />
      <PWAUpdateToast />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;