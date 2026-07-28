/**
 * supabase-store.ts
 * Handles all Supabase read/write for the family finance app.
 * localStorage is kept as offline fallback.
 */

import { supabase } from './supabase';
import { Transaction, Budget, RecurringEntry, FinancialState, Person } from './types';

const LOCAL_KEY = 'family-finance-data';

// ─── LOCAL STORAGE (fallback) ────────────────────────────────────────────────

const defaultState: FinancialState = {
  transactions: [],
  budgets: [],
  recurringEntries: [],
  monthData: [],
  initialBalances: { Appa: 0, Amma: 0, Ajai: 0, Mauli: 0 },
  accountBalances: {},
  realBalances: {},
};

export function loadLocalState(): FinancialState {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    if (!parsed.accountBalances) parsed.accountBalances = {};
    if (!parsed.realBalances) parsed.realBalances = {};
    if (parsed.transactions) {
      parsed.transactions = parsed.transactions.map((t: any) => ({
        ...t,
        homeOrDebt: t.homeOrDebt || 'home',
      }));
    }
    return parsed;
  } catch {
    return defaultState;
  }
}

export function saveLocalState(state: FinancialState): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
}

// ─── SUPABASE READS ──────────────────────────────────────────────────────────

export async function loadFromSupabase(): Promise<FinancialState> {
  try {
    const [txnRes, budgetRes, recurringRes, configRes] = await Promise.all([
      supabase.from('transactions').select('*').order('date', { ascending: false }),
      supabase.from('budgets').select('*'),
      supabase.from('recurring_entries').select('*'),
      supabase.from('app_config').select('*'),
    ]);

    if (txnRes.error || budgetRes.error || recurringRes.error || configRes.error) {
      console.warn('Supabase load error, falling back to local:', txnRes.error || budgetRes.error);
      return loadLocalState();
    }

    // Map snake_case DB columns → camelCase app fields
    const transactions: Transaction[] = (txnRes.data || []).map(row => ({
      id: row.id,
      date: row.date,
      year: row.year,
      month: row.month,
      person: row.person as Person,
      type: row.type,
      category: row.category,
      amount: Number(row.amount),
      paymentMode: row.payment_mode,
      notes: row.notes || '',
      transferTo: row.transfer_to,
      accountId: row.account_id,
      transferToAccountId: row.transfer_to_account_id,
      homeOrDebt: row.home_or_debt || 'home',
      expectedAmount: row.expected_amount ? Number(row.expected_amount) : undefined,
    }));

    const budgets: Budget[] = (budgetRes.data || []).map(row => ({
      category: row.category,
      amount: Number(row.amount),
      month: row.month,
      year: row.year,
    }));

    const recurringEntries: RecurringEntry[] = (recurringRes.data || []).map(row => ({
      id: row.id,
      person: row.person as Person,
      type: row.type,
      category: row.category,
      amount: Number(row.amount),
      paymentMode: row.payment_mode,
      notes: row.notes || '',
      dayOfMonth: row.day_of_month,
      transferTo: row.transfer_to,
      homeOrDebt: row.home_or_debt || 'home',
      accountId: row.account_id,
    }));

    // Parse config — now includes realBalances
    const configMap: Record<string, any> = {};
    for (const row of configRes.data || []) {
      configMap[row.key] = row.value;
    }

    const state: FinancialState = {
      transactions,
      budgets,
      recurringEntries,
      monthData: [],
      initialBalances: configMap['initialBalances'] || defaultState.initialBalances,
      accountBalances: configMap['accountBalances'] || {},
      // ✅ NEW: real balances loaded from DB
      realBalances: configMap['realBalances'] || {},
      // Custom sources
      incomeSources: configMap['incomeSources'],
      expenseSources: configMap['expenseSources'],
      accountNames: configMap['accountNames'],
    };

    // Save to local as cache
    saveLocalState(state);
    return state;
  } catch (err) {
    console.warn('Supabase unreachable, using local data:', err);
    return loadLocalState();
  }
}

// ─── SUPABASE WRITES ─────────────────────────────────────────────────────────

export async function saveTransaction(txn: Transaction): Promise<void> {
  const { error } = await supabase.from('transactions').upsert({
    id: txn.id,
    date: txn.date,
    year: txn.year,
    month: txn.month,
    person: txn.person,
    type: txn.type,
    category: txn.category,
    amount: txn.amount,
    payment_mode: txn.paymentMode,
    notes: txn.notes || '',
    transfer_to: txn.transferTo || null,
    account_id: txn.accountId || null,
    transfer_to_account_id: txn.transferToAccountId || null,
    home_or_debt: txn.homeOrDebt || 'home',
    expected_amount: txn.expectedAmount ?? null,
  });
  if (error) console.error('Error saving transaction:', error);
}

export async function deleteTransactionFromDB(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) console.error('Error deleting transaction:', error);
}

export async function saveBudget(budget: Budget): Promise<void> {
  const { error } = await supabase.from('budgets').upsert({
    category: budget.category,
    amount: budget.amount,
    month: budget.month,
    year: budget.year,
  }, { onConflict: 'category,month,year' });
  if (error) console.error('Error saving budget:', error);
}

export async function saveRecurring(entry: RecurringEntry): Promise<void> {
  const { error } = await supabase.from('recurring_entries').upsert({
    id: entry.id,
    person: entry.person,
    type: entry.type,
    category: entry.category,
    amount: entry.amount,
    payment_mode: entry.paymentMode,
    notes: entry.notes || '',
    day_of_month: entry.dayOfMonth,
    transfer_to: entry.transferTo || null,
    home_or_debt: entry.homeOrDebt || 'home',
    account_id: entry.accountId || null,
  });
  if (error) console.error('Error saving recurring entry:', error);
}

export async function deleteRecurringFromDB(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_entries').delete().eq('id', id);
  if (error) console.error('Error deleting recurring:', error);
}

export async function saveConfig(key: string, value: any): Promise<void> {
  const { error } = await supabase.from('app_config').upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) console.error(`Error saving config [${key}]:`, error);
}

// ─── MIGRATION ───────────────────────────────────────────────────────────────

export async function migrateLocalToSupabase(): Promise<{ success: boolean; message: string }> {
  const local = loadLocalState();

  if (local.transactions.length === 0 && local.budgets.length === 0) {
    return { success: false, message: 'No local data found to migrate.' };
  }

  try {
    const txnBatches = chunkArray(local.transactions, 100);
    for (const batch of txnBatches) {
      const rows = batch.map(txn => ({
        id: txn.id,
        date: txn.date,
        year: txn.year,
        month: txn.month,
        person: txn.person,
        type: txn.type,
        category: txn.category,
        amount: txn.amount,
        payment_mode: txn.paymentMode,
        notes: txn.notes || '',
        transfer_to: txn.transferTo || null,
        account_id: txn.accountId || null,
        transfer_to_account_id: txn.transferToAccountId || null,
        home_or_debt: txn.homeOrDebt || 'home',
        expected_amount: txn.expectedAmount ?? null,
      }));
      const { error } = await supabase.from('transactions').upsert(rows);
      if (error) throw error;
    }

    if (local.budgets.length > 0) {
      const { error } = await supabase.from('budgets').upsert(
        local.budgets.map(b => ({ ...b })),
        { onConflict: 'category,month,year' }
      );
      if (error) throw error;
    }

    if (local.recurringEntries.length > 0) {
      const rows = local.recurringEntries.map(e => ({
        id: e.id,
        person: e.person,
        type: e.type,
        category: e.category,
        amount: e.amount,
        payment_mode: e.paymentMode,
        notes: e.notes || '',
        day_of_month: e.dayOfMonth,
        transfer_to: e.transferTo || null,
        home_or_debt: e.homeOrDebt || 'home',
        account_id: e.accountId || null,
      }));
      const { error } = await supabase.from('recurring_entries').upsert(rows);
      if (error) throw error;
    }

    await saveConfig('initialBalances', local.initialBalances);
    await saveConfig('accountBalances', local.accountBalances);
    // ✅ Also migrate real balances if present
    if (local.realBalances && Object.keys(local.realBalances).length > 0) {
      await saveConfig('realBalances', local.realBalances);
    }

    return {
      success: true,
      message: `Migrated ${local.transactions.length} transactions, ${local.budgets.length} budgets, ${local.recurringEntries.length} recurring entries.`,
    };
  } catch (err: any) {
    console.error('Migration error:', err);
    return { success: false, message: err.message || 'Migration failed.' };
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}