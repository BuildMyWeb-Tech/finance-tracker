/**
 * supabase-store.ts
 * All reads/writes are scoped by userId — each user has isolated data.
 * Pass userId to every function that touches the DB.
 */

import { supabase } from './supabase';
import {
  Transaction, Budget, RecurringEntry, FinancialState, Person,
} from './types';

const LOCAL_KEY = 'family-finance-data';

// ─── Local fallback ───────────────────────────────────────────────────────────

const defaultState: FinancialState = {
  transactions: [],
  budgets: [],
  recurringEntries: [],
  monthData: [],
  initialBalances: { Appa: 0, Amma: 0, Ajai: 0, Mauli: 0 },
  accountBalances: {},
  realBalances: {},
};

export function loadLocalState(userId?: string): FinancialState {
  try {
    const key = userId ? `${LOCAL_KEY}-${userId}` : LOCAL_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw) as FinancialState;
    if (!parsed.accountBalances) parsed.accountBalances = {};
    if (!parsed.realBalances) parsed.realBalances = {};
    return parsed;
  } catch {
    return { ...defaultState };
  }
}

export function saveLocalState(state: FinancialState, userId?: string): void {
  const key = userId ? `${LOCAL_KEY}-${userId}` : LOCAL_KEY;
  localStorage.setItem(key, JSON.stringify(state));
}

// ─── SUPABASE READS (user-scoped) ─────────────────────────────────────────────

export async function loadFromSupabase(userId: string): Promise<FinancialState> {
  try {
    const [txnRes, budgetRes, recurringRes, configRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('budgets').select('*').eq('user_id', userId),
      supabase.from('recurring_entries').select('*').eq('user_id', userId),
      supabase.from('app_config').select('*').eq('user_id', userId),
    ]);

    if (txnRes.error || budgetRes.error) {
      // If user_id column missing (old schema), fall back gracefully
      console.warn('Supabase load error, falling back to local:', txnRes.error || budgetRes.error);
      return loadLocalState(userId);
    }

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
      realBalances: configMap['realBalances'] || {},
      incomeSources: configMap['incomeSources'],
      expenseSources: configMap['expenseSources'],
      accountNames: configMap['accountNames'],
      customAccounts: configMap['customAccounts'],
      customPersons: configMap['customPersons'],
      transactionGroups: configMap['transactionGroups'],
      ledgerConfig: configMap['ledgerConfig'],
    };

    saveLocalState(state, userId);
    return state;
  } catch (err) {
    console.warn('Supabase unreachable, using local data:', err);
    return loadLocalState(userId);
  }
}

// ─── SUPABASE WRITES (user-scoped) ────────────────────────────────────────────

export async function saveTransaction(txn: Transaction, userId: string): Promise<void> {
  const { error } = await supabase.from('transactions').upsert({
    id: txn.id,
    user_id: userId,
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

export async function deleteTransactionFromDB(id: string, userId: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', userId);
  if (error) console.error('Error deleting transaction:', error);
}

export async function saveBudget(budget: Budget, userId: string): Promise<void> {
  const { error } = await supabase.from('budgets').upsert({
    user_id: userId,
    category: budget.category,
    amount: budget.amount,
    month: budget.month,
    year: budget.year,
  }, { onConflict: 'user_id,category,month,year' });
  if (error) console.error('Error saving budget:', error);
}

export async function saveRecurring(entry: RecurringEntry, userId: string): Promise<void> {
  const { error } = await supabase.from('recurring_entries').upsert({
    id: entry.id,
    user_id: userId,
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

export async function deleteRecurringFromDB(id: string, userId: string): Promise<void> {
  const { error } = await supabase.from('recurring_entries').delete().eq('id', id).eq('user_id', userId);
  if (error) console.error('Error deleting recurring:', error);
}

export async function saveConfig(key: string, value: any, userId: string): Promise<void> {
  const { error } = await supabase.from('app_config').upsert(
    { key, value, user_id: userId, updated_at: new Date().toISOString() },
    { onConflict: 'key,user_id' }
  );
  if (error) console.error(`Error saving config [${key}]:`, error);
}

// ─── User registration ────────────────────────────────────────────────────────
// Stored in app_config with key='registered_users', user_id='__global__'
// Using '__global__' (not NULL) because NULL breaks upsert conflict resolution.

const GLOBAL_USER_ID = '__global__';

export async function registerUser(
  userId: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Load existing users
    const { data: existing } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'registered_users')
      .eq('user_id', GLOBAL_USER_ID)
      .maybeSingle();

    const users: Record<string, string> = (existing?.value as Record<string, string>) || {};

    if (users[userId.toLowerCase()]) {
      return { success: false, error: 'User ID already taken' };
    }

    users[userId.toLowerCase()] = password;

    const { error } = await supabase.from('app_config').upsert(
      { key: 'registered_users', value: users, user_id: GLOBAL_USER_ID, updated_at: new Date().toISOString() },
      { onConflict: 'key,user_id' },
    );

    if (error) {
      console.error('registerUser DB error:', error);
      return { success: false, error: 'Registration failed — DB error: ' + error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Registration failed' };
  }
}

export async function loadRegisteredUsers(): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'registered_users')
      .eq('user_id', GLOBAL_USER_ID)
      .maybeSingle();
    if (error) {
      console.warn('loadRegisteredUsers error:', error.message);
      return {};
    }
    return (data?.value as Record<string, string>) || {};
  } catch {
    return {};
  }
}

// ─── Migration helper ─────────────────────────────────────────────────────────

export async function migrateLocalToSupabase(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    const local = loadLocalState(userId);
    for (const txn of local.transactions) await saveTransaction(txn, userId);
    for (const b of local.budgets) await saveBudget(b, userId);
    for (const r of local.recurringEntries) await saveRecurring(r, userId);
    await saveConfig('accountBalances', local.accountBalances, userId);
    await saveConfig('initialBalances', local.initialBalances, userId);
    if (local.incomeSources) await saveConfig('incomeSources', local.incomeSources, userId);
    if (local.expenseSources) await saveConfig('expenseSources', local.expenseSources, userId);
    if (local.customAccounts) await saveConfig('customAccounts', local.customAccounts, userId);
    return { success: true, message: `Migrated ${local.transactions.length} transactions for ${userId}` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Migration failed' };
  }
}