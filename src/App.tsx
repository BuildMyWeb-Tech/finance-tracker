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
  const { isSyncing } = useFinance();
  if (!isSyncing) return null;
  return (
    <div style={{
      position: 'fixed', top: '12px', right: '12px', zIndex: 9999,
      background: 'rgba(26,31,22,0.9)',
      border: '1px solid rgba(201,168,76,0.3)',
      borderRadius: '20px', padding: '4px 10px',
      display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '11px', color: '#C9A84C',
      fontFamily: '"DM Sans", sans-serif',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C9A84C', animation: 'pulse 1s infinite' }} />
      Saving…
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}

function AppContent() {
  const { isLoading } = useFinance();
  if (isLoading) return <LoadingScreen />;

  return (
    <BrowserRouter>
      <SyncIndicator />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/income" element={<IncomePage />} />
        <Route path="/budget" element={<BudgetPage />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/persons" element={<PersonWisePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/bulk-upload" element={<BulkUploadPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNav />
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