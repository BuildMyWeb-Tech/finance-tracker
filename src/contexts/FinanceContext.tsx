import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Transaction, Budget, RecurringEntry, FinancialState, Person, IncomeSource, ExpenseSource, Account } from '@/lib/types';
import { generateId, normalizeTransaction } from '@/lib/financial-store';
import { useAuth } from '@/contexts/AuthContext';
import {
  loadLocalState,
  saveLocalState,
  loadFromSupabase,
  saveTransaction,
  deleteTransactionFromDB,
  saveBudget,
  saveRecurring,
  deleteRecurringFromDB,
  saveConfig,
  migrateLocalToSupabase,
} from '@/lib/supabase-store';

export interface MissingMoneyEntry {
  date: string;
  amount: number;
}

interface FinanceContextType {
  state: FinancialState;
  isLoading: boolean;
  isSyncing: boolean;
  addTransaction: (txn: Omit<Transaction, 'id'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updateTransaction: (txn: Transaction) => Promise<void>;
  setBudget: (category: string, amount: number, year: number, month: number) => Promise<void>;
  addRecurring: (entry: Omit<RecurringEntry, 'id'>) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  setInitialBalance: (person: Person, amount: number) => Promise<void>;
  setAccountBalance: (accountId: string, amount: number) => Promise<void>;
  setRealBalance: (accountId: string, amount: number) => Promise<void>;
  setIncomeSources: (sources: IncomeSource[]) => Promise<void>;
  setExpenseSources: (sources: ExpenseSource[]) => Promise<void>;
  setAccountNames: (names: Record<string, string>) => Promise<void>;
  setCustomAccounts: (accounts: Account[]) => Promise<void>;
  missingMoneyLog: MissingMoneyEntry[];
  logMissingMoney: (date: string, amount: number) => void;
  migrateData: () => Promise<{ success: boolean; message: string }>;
  refreshFromCloud: () => Promise<void>;
  selectedYear: number;
  selectedMonth: number;
  setSelectedYear: (y: number) => void;
  setSelectedMonth: (m: number) => void;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

const MISSING_LOG_KEY = 'family-finance-missing-log';

function loadMissingLog(): MissingMoneyEntry[] {
  try {
    const raw = localStorage.getItem(MISSING_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMissingLog(log: MissingMoneyEntry[]) {
  localStorage.setItem(MISSING_LOG_KEY, JSON.stringify(log));
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const userId = currentUser || 'guest';

  const [state, setState] = useState<FinancialState>(() => loadLocalState(userId));
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [missingMoneyLog, setMissingMoneyLog] = useState<MissingMoneyEntry[]>(loadMissingLog);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  // Reload from Supabase whenever userId changes (login/logout/switch)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setState(loadLocalState(userId)); // show local immediately
      const cloudState = await loadFromSupabase(userId);
      if (!cancelled) { setState(cloudState); setIsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!isLoading) saveLocalState(state, userId);
  }, [state, isLoading, userId]);

  // ─── TRANSACTIONS ──────────────────────────────────────────────────────────

  const addTransaction = useCallback(async (txn: Omit<Transaction, 'id'>) => {
    const newTxn: Transaction = normalizeTransaction({ ...txn, id: generateId() });
    setState(s => ({ ...s, transactions: [...s.transactions, newTxn] }));
    setIsSyncing(true);
    await saveTransaction(newTxn, userId);
    setIsSyncing(false);
  }, [userId]);

  const deleteTransaction = useCallback(async (id: string) => {
    setState(s => ({ ...s, transactions: s.transactions.filter(t => t.id !== id) }));
    setIsSyncing(true);
    await deleteTransactionFromDB(id, userId);
    setIsSyncing(false);
  }, [userId]);

  const updateTransaction = useCallback(async (txn: Transaction) => {
    const normalized = normalizeTransaction(txn);
    setState(s => ({
      ...s,
      transactions: s.transactions.map(t => t.id === normalized.id ? normalized : t),
    }));
    setIsSyncing(true);
    await saveTransaction(normalized, userId);
    setIsSyncing(false);
  }, [userId]);

  // ─── BUDGETS ───────────────────────────────────────────────────────────────

  const setBudget = useCallback(async (category: string, amount: number, year: number, month: number) => {
    setState(s => {
      const existing = s.budgets.findIndex(
        b => b.category === category && b.year === year && b.month === month,
      );
      const budgets = [...s.budgets];
      if (existing >= 0) budgets[existing] = { category, amount, year, month };
      else budgets.push({ category, amount, year, month });
      return { ...s, budgets };
    });
    setIsSyncing(true);
    await saveBudget({ category, amount, year, month }, userId);
    setIsSyncing(false);
  }, [userId]);

  // ─── RECURRING ────────────────────────────────────────────────────────────

  const addRecurring = useCallback(async (entry: Omit<RecurringEntry, 'id'>) => {
    const newEntry: RecurringEntry = { ...entry, id: generateId() };
    setState(s => ({ ...s, recurringEntries: [...s.recurringEntries, newEntry] }));
    setIsSyncing(true);
    await saveRecurring(newEntry, userId);
    setIsSyncing(false);
  }, [userId]);

  const deleteRecurring = useCallback(async (id: string) => {
    setState(s => ({ ...s, recurringEntries: s.recurringEntries.filter(r => r.id !== id) }));
    setIsSyncing(true);
    await deleteRecurringFromDB(id, userId);
    setIsSyncing(false);
  }, []);

  // ─── BALANCES ─────────────────────────────────────────────────────────────

  const setInitialBalance = useCallback(async (person: Person, amount: number) => {
    setState(s => {
      const updated = { ...s, initialBalances: { ...s.initialBalances, [person]: amount } };
      saveConfig('initialBalances', updated.initialBalances, userId);
      return updated;
    });
  }, []);

  const setAccountBalance = useCallback(async (accountId: string, amount: number) => {
    setState(s => {
      const updated = { ...s, accountBalances: { ...s.accountBalances, [accountId]: amount } };
      saveConfig('accountBalances', updated.accountBalances, userId);
      return updated;
    });
  }, []);

  // ─── REAL BALANCE (physical cash/bank) ────────────────────────────────────
  // Persists the ENTIRE realBalances map to Supabase app_config as key='realBalances'.
  // Optimistic update → setState first, then async save.

  const setRealBalance = useCallback(async (accountId: string, amount: number) => {
    let updatedMap: Record<string, number> = {};

    setState(s => {
      updatedMap = { ...s.realBalances, [accountId]: Math.round(amount) };
      return { ...s, realBalances: updatedMap };
    });

    setIsSyncing(true);
    // Small delay to let setState flush so updatedMap is captured correctly
    await new Promise(r => setTimeout(r, 0));
    await saveConfig('realBalances', updatedMap, userId);
    setIsSyncing(false);
  }, []);

  // ─── SETTINGS CRUD ────────────────────────────────────────────────────────

  const setIncomeSources = useCallback(async (sources: IncomeSource[]) => {
    setState(s => {
      const updated = { ...s, incomeSources: sources };
      saveConfig('incomeSources', sources, userId);
      return updated;
    });
  }, []);

  const setExpenseSources = useCallback(async (sources: ExpenseSource[]) => {
    setState(s => {
      const updated = { ...s, expenseSources: sources };
      saveConfig('expenseSources', sources, userId);
      return updated;
    });
  }, []);

  const setAccountNames = useCallback(async (names: Record<string, string>) => {
    setState(s => {
      const updated = { ...s, accountNames: names };
      saveConfig('accountNames', names, userId);
      return updated;
    });
  }, []);

  const setCustomAccounts = useCallback(async (accounts: Account[]) => {
    setState(s => {
      const updated = { ...s, customAccounts: accounts };
      saveConfig('customAccounts', accounts, userId);
      return updated;
    });
  }, []);

  // ─── MISSING MONEY LOG ────────────────────────────────────────────────────

  const logMissingMoney = useCallback((date: string, amount: number) => {
    setMissingMoneyLog(prev => {
      const existing = prev.findIndex(e => e.date === date);
      let updated: MissingMoneyEntry[];
      if (amount === 0) {
        updated = prev.filter(e => e.date !== date);
      } else if (existing >= 0) {
        updated = prev.map(e => e.date === date ? { date, amount } : e);
      } else {
        updated = [...prev, { date, amount }].sort((a, b) => a.date.localeCompare(b.date));
      }
      saveMissingLog(updated);
      return updated;
    });
  }, []);

  // ─── MIGRATION & REFRESH ──────────────────────────────────────────────────

  const migrateData = useCallback(async () => {
    return await migrateLocalToSupabase(userId);
  }, []);

  const refreshFromCloud = useCallback(async () => {
    setIsLoading(true);
    const cloudState = await loadFromSupabase(userId);
    setState(cloudState);
    setIsLoading(false);
  }, []);

  return (
    <FinanceContext.Provider value={{
      state, isLoading, isSyncing,
      addTransaction, deleteTransaction, updateTransaction,
      setBudget, addRecurring, deleteRecurring,
      setInitialBalance, setAccountBalance,
      setRealBalance,
      setIncomeSources, setExpenseSources, setAccountNames, setCustomAccounts,
      missingMoneyLog, logMissingMoney,
      migrateData, refreshFromCloud,
      selectedYear, selectedMonth, setSelectedYear, setSelectedMonth,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}