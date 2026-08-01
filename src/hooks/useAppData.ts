/**
 * useAppData.ts
 * Single source of truth for all dynamic app data from Settings.
 * persons, accounts, transactionGroups, income/expense categories — all from DB.
 */

import { useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import type { Account, TransactionGroup } from '@/lib/types';
import { DEFAULT_TRANSACTION_GROUPS } from '@/lib/types';

export function useAppData() {
  const { state } = useFinance();

  // ── Persons ──────────────────────────────────────────────────────────────
  const persons: string[] = useMemo(
    () => state.customPersons ?? [],
    [state.customPersons],
  );

  // ── Accounts ─────────────────────────────────────────────────────────────
  const accounts: Account[] = useMemo(
    () => state.customAccounts ?? [],
    [state.customAccounts],
  );

  // ── Transaction Groups ────────────────────────────────────────────────────
  // Falls back to home+debt defaults if none configured
  const transactionGroups: TransactionGroup[] = useMemo(
    () => state.transactionGroups && state.transactionGroups.length > 0
      ? state.transactionGroups
      : DEFAULT_TRANSACTION_GROUPS,
    [state.transactionGroups],
  );

  const groupIds = useMemo(() => transactionGroups.map(g => g.id), [transactionGroups]);

  const getGroup = (id: string): TransactionGroup =>
    transactionGroups.find(g => g.id === id) ?? { id, label: id, emoji: '📁', color: 'text-muted-foreground' };

  // ── Category lists — one per group per type ───────────────────────────────
  // Returns { [groupId]: string[] } for income
  const incomeCategoriesByGroup = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const g of transactionGroups) {
      map[g.id] = (state.incomeSources ?? [])
        .filter(s => s.group === g.id)
        .map(s => s.name);
    }
    return map;
  }, [state.incomeSources, transactionGroups]);

  // Returns { [groupId]: string[] } for expenses
  const expenseCategoriesByGroup = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const g of transactionGroups) {
      map[g.id] = (state.expenseSources ?? [])
        .filter(s => s.group === g.id)
        .map(s => s.name);
    }
    return map;
  }, [state.expenseSources, transactionGroups]);

  // Flat all-categories list for search/filter
  const allCategories = useMemo(() => {
    const income = Object.values(incomeCategoriesByGroup).flat();
    const expense = Object.values(expenseCategoriesByGroup).flat();
    return Array.from(new Set([...income, ...expense])).sort();
  }, [incomeCategoriesByGroup, expenseCategoriesByGroup]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getAccountsForPerson = (person: string) =>
    accounts.filter(a => a.person === person);

  const getAccountName = (id: string) =>
    accounts.find(a => a.id === id)?.name ?? id;

  const getCategoriesFor = (
    type: 'income' | 'expense' | 'transfer',
    groupId: string,
  ): string[] => {
    if (type === 'transfer') return [];
    const map = type === 'income' ? incomeCategoriesByGroup : expenseCategoriesByGroup;
    return map[groupId] ?? [];
  };

  return {
    persons,
    accounts,
    transactionGroups,
    groupIds,
    getGroup,
    incomeCategoriesByGroup,
    expenseCategoriesByGroup,
    allCategories,
    getAccountsForPerson,
    getAccountName,
    getCategoriesFor,
  };
}