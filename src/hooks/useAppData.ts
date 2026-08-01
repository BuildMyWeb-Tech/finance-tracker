/**
 * useAppData.ts
 * Single source of truth for dynamic persons, accounts, and categories.
 * ALL components should use this instead of hardcoded PERSONS / ACCOUNTS / *_CATEGORIES.
 */

import { useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import type { Account } from '@/lib/types';

export function useAppData() {
  const { state } = useFinance();

  // ── Persons (fully dynamic from Settings) ───────────────────────────────
  const persons: string[] = useMemo(
    () => state.customPersons && state.customPersons.length > 0
      ? state.customPersons
      : [],
    [state.customPersons],
  );

  // ── Accounts (fully dynamic from Settings) ──────────────────────────────
  const accounts: Account[] = useMemo(
    () => state.customAccounts ?? [],
    [state.customAccounts],
  );

  // ── Category lists (fully dynamic from Settings) ─────────────────────────
  const homeIncomeCategories = useMemo(
    () => (state.incomeSources ?? []).filter(s => s.group === 'home').map(s => s.name),
    [state.incomeSources],
  );
  const debtIncomeCategories = useMemo(
    () => (state.incomeSources ?? []).filter(s => s.group === 'debt').map(s => s.name),
    [state.incomeSources],
  );
  const homeExpenseCategories = useMemo(
    () => (state.expenseSources ?? []).filter(s => s.group === 'home').map(s => s.name),
    [state.expenseSources],
  );
  const debtExpenseCategories = useMemo(
    () => (state.expenseSources ?? []).filter(s => s.group === 'debt').map(s => s.name),
    [state.expenseSources],
  );

  // All categories combined (for search filters)
  const allCategories = useMemo(
    () => Array.from(new Set([
      ...homeIncomeCategories,
      ...debtIncomeCategories,
      ...homeExpenseCategories,
      ...debtExpenseCategories,
    ])).sort(),
    [homeIncomeCategories, debtIncomeCategories, homeExpenseCategories, debtExpenseCategories],
  );

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getAccountsForPerson = (person: string) =>
    accounts.filter(a => a.person === person);

  const getAccountName = (id: string) =>
    accounts.find(a => a.id === id)?.name ?? id;

  const getCategoriesFor = (
    type: 'income' | 'expense' | 'transfer',
    homeOrDebt: 'home' | 'debt',
  ): string[] => {
    if (type === 'transfer') return [];
    if (type === 'income')
      return homeOrDebt === 'home' ? homeIncomeCategories : debtIncomeCategories;
    return homeOrDebt === 'home' ? homeExpenseCategories : debtExpenseCategories;
  };

  return {
    persons,
    accounts,
    homeIncomeCategories,
    debtIncomeCategories,
    homeExpenseCategories,
    debtExpenseCategories,
    allCategories,
    getAccountsForPerson,
    getAccountName,
    getCategoriesFor,
  };
}