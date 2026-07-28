/**
 * financial-store.ts — Single source of truth for all balance calculations.
 *
 * FIXES APPLIED:
 * ✅ normalizeTransaction: amount always positive (Math.abs), type always lowercase+trimmed
 * ✅ getTotalBalance: initialBalances only added for persons WITHOUT accounts (no double count)
 * ✅ All arithmetic: rc() on every step (float safety)
 * ✅ Transfer isolation: never touches income/expense totals
 * ✅ resolveTransferDestAccount: fallback for missing transferToAccountId
 * ✅ sortByDateDesc: stable date+id tiebreaker
 */

import {
  Transaction, Budget, FinancialState, Person, PERSONS,
  DEFAULT_BUDGETS, EXPENSE_CATEGORIES, ACCOUNTS,
} from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'family-finance-data';

const defaultState: FinancialState = {
  transactions: [],
  budgets: [],
  recurringEntries: [],
  monthData: [],
  initialBalances: { Appa: 0, Amma: 0, Ajai: 0, Mauli: 0 },
  accountBalances: {},
  realBalances: {},   // ← add this line
};

// ─── Float safety ─────────────────────────────────────────────────────────────

/** rc = roundCents. Wrap every monetary arithmetic result to kill float drift. */
export function rc(value: number): number {
  return Math.round(value);
}

// ─── Stable sort ──────────────────────────────────────────────────────────────

export function sortByDateDesc(txns: Transaction[]): Transaction[] {
  return [...txns].sort((a, b) => {
    const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
    return diff !== 0 ? diff : b.id.localeCompare(a.id);
  });
}

// ─── Transaction normalizer ───────────────────────────────────────────────────
/**
 * KEY FIX: amount is ALWAYS coerced to a positive number via Math.abs().
 * If old data stored expenses as negative (-100), Math.abs() corrects it.
 * type is always lowercased+trimmed so 'Income', 'EXPENSE', 'income ' all work.
 */
export function normalizeTransaction(t: any): Transaction {
  // FIX 1: amount always positive — sign is ONLY applied in calculation logic
  const amount = rc(Math.abs(Number(t.amount) || 0));

  // FIX 2: type always lowercase+trimmed — fixes 'Income'/'EXPENSE' casing bugs
  const type = (typeof t.type === 'string'
    ? t.type.toLowerCase().trim()
    : 'expense') as Transaction['type'];

  // Derive paymentMode from account type
  let paymentMode = t.paymentMode ?? 'cash';
  if (t.accountId) {
    const acc = ACCOUNTS.find(a => a.id === t.accountId);
    if (acc) paymentMode = acc.type === 'cash' ? 'cash' : 'bank';
  }

  return {
    ...t,
    amount,
    type,
    paymentMode,
    homeOrDebt: t.homeOrDebt || 'home',
  } as Transaction;
}

// ─── Transfer validation ──────────────────────────────────────────────────────

export function validateTransfer(
  accountId?: string,
  transferToAccountId?: string,
): { ok: boolean; error?: string } {
  if (!accountId || !transferToAccountId) return { ok: true };
  if (accountId === transferToAccountId) {
    return { ok: false, error: 'Cannot transfer to the same account' };
  }
  return { ok: true };
}

// ─── Resolve destination account ─────────────────────────────────────────────

export function resolveTransferDestAccount(t: Transaction): string | undefined {
  if (t.transferToAccountId) return t.transferToAccountId;
  if (!t.transferTo) return undefined;
  const destAccounts = ACCOUNTS.filter(a => a.person === t.transferTo);
  if (destAccounts.length === 0) return undefined;
  const cashAcc = destAccounts.find(a => a.type === 'cash');
  return cashAcc ? cashAcc.id : destAccounts[0].id;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

export function loadState(): FinancialState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    if (!parsed.accountBalances) parsed.accountBalances = {};
    // Normalize every transaction at load time — fixes casing + negative amounts
    if (parsed.transactions) {
      parsed.transactions = parsed.transactions.map(normalizeTransaction);
    }
    return parsed;
  } catch {
    return defaultState;
  }
}

export function saveState(state: FinancialState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function getMonthTransactions(
  txns: Transaction[],
  year: number,
  month: number,
): Transaction[] {
  return txns.filter(t => t.year === year && t.month === month);
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT-LEVEL BALANCE
//
// Sign rules (amounts are ALWAYS positive in DB):
//   income  → +amount  (money arrives)
//   expense → -amount  (money leaves)
//   transfer source → -amount  (money leaves source account)
//   transfer dest   → +amount  (money arrives at dest account)
//
// Transfers NEVER touch income or expense totals.
// closing = opening + income - expense + transferNet
// ─────────────────────────────────────────────────────────────────────────────

export interface AccountBalanceResult {
  opening: number;
  income: number;
  expense: number;
  transferNet: number;
  closing: number;
}

export function getAccountBalance(
  txns: Transaction[],
  accountId: string,
  year: number,
  month: number,
  accountBalances: Record<string, number>,
): AccountBalanceResult {
  const initial  = accountBalances[accountId] || 0;
  const targetYM = year * 12 + month;

  // ── Opening: all transactions BEFORE the target month ──────────────────────
  let opening = initial;
  for (const t of txns) {
    if (t.year * 12 + t.month >= targetYM) continue;

    if (t.type === 'income' && t.accountId === accountId) {
      opening = rc(opening + t.amount);                    // income → add
    } else if (t.type === 'expense' && t.accountId === accountId) {
      opening = rc(opening - t.amount);                    // expense → subtract
    } else if (t.type === 'transfer') {
      const destId = resolveTransferDestAccount(t);
      if (t.accountId === accountId) opening = rc(opening - t.amount); // source → subtract
      if (destId      === accountId) opening = rc(opening + t.amount); // dest → add
    }
  }

  // ── Current month breakdown ─────────────────────────────────────────────────
  let income = 0;
  let expense = 0;
  let transferNet = 0;

  for (const t of getMonthTransactions(txns, year, month)) {
    if (t.type === 'income' && t.accountId === accountId) {
      income = rc(income + t.amount);
    } else if (t.type === 'expense' && t.accountId === accountId) {
      expense = rc(expense + t.amount);
    } else if (t.type === 'transfer') {
      const destId = resolveTransferDestAccount(t);
      if (t.accountId === accountId) transferNet = rc(transferNet - t.amount); // source → negative
      if (destId      === accountId) transferNet = rc(transferNet + t.amount); // dest → positive
    }
  }

  // closing = opening + income - expense + transferNet
  const closing = rc(opening + income - expense + transferNet);
  return { opening, income, expense, transferNet, closing };
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSON-LEVEL BALANCE
// ─────────────────────────────────────────────────────────────────────────────

export function getPersonBalance(
  txns: Transaction[],
  person: Person,
  year: number,
  month: number,
  initialBalances: Record<Person, number>,
  accountBalances?: Record<string, number>,
): { opening: number; income: number; expense: number; transferNet: number; closing: number } {

  if (accountBalances) {
    const personAccounts = ACCOUNTS.filter(a => a.person === person);

    // ── Account layer ─────────────────────────────────────────────────────────
    let accOpening     = 0;
    let accIncome      = 0;
    let accExpense     = 0;
    let accTransferNet = 0;

    for (const acc of personAccounts) {
      const bal = getAccountBalance(txns, acc.id, year, month, accountBalances);
      accOpening     = rc(accOpening     + bal.opening);
      accIncome      = rc(accIncome      + bal.income);
      accExpense     = rc(accExpense     + bal.expense);
      accTransferNet = rc(accTransferNet + bal.transferNet);
    }

    // ── Legacy layer: transactions with no accountId ──────────────────────────
    const initial  = personAccounts.length === 0 ? (initialBalances[person] || 0) : 0;
    const targetYM = year * 12 + month;
    let legacyOpening = initial;

    for (const t of txns) {
      if (t.accountId) continue;                          // strict guard — no double count
      if (t.year * 12 + t.month >= targetYM) continue;

      if (t.type === 'income'  && t.person === person) legacyOpening = rc(legacyOpening + t.amount);
      if (t.type === 'expense' && t.person === person) legacyOpening = rc(legacyOpening - t.amount);
      if (t.type === 'transfer') {
        if (t.person    === person) legacyOpening = rc(legacyOpening - t.amount);
        if (t.transferTo === person) legacyOpening = rc(legacyOpening + t.amount);
      }
    }

    let legacyIncome      = 0;
    let legacyExpense     = 0;
    let legacyTransferNet = 0;

    for (const t of getMonthTransactions(txns, year, month)) {
      if (t.accountId) continue;                          // strict guard

      if (t.type === 'income'  && t.person === person) legacyIncome  = rc(legacyIncome  + t.amount);
      if (t.type === 'expense' && t.person === person) legacyExpense = rc(legacyExpense + t.amount);
      if (t.type === 'transfer') {
        if (t.person    === person) legacyTransferNet = rc(legacyTransferNet - t.amount);
        if (t.transferTo === person) legacyTransferNet = rc(legacyTransferNet + t.amount);
      }
    }

    const opening     = rc(accOpening + legacyOpening);
    const income      = rc(accIncome  + legacyIncome);
    const expense     = rc(accExpense + legacyExpense);
    const transferNet = rc(accTransferNet + legacyTransferNet);

    return { opening, income, expense, transferNet, closing: rc(opening + income - expense + transferNet) };
  }

  // ── Full legacy fallback (accountBalances system not in use) ──────────────
  const initial  = initialBalances[person] || 0;
  const targetYM = year * 12 + month;
  let opening = initial;

  for (const t of txns) {
    if (t.year * 12 + t.month >= targetYM) continue;
    if (t.type === 'income'  && t.person === person) opening = rc(opening + t.amount);
    if (t.type === 'expense' && t.person === person) opening = rc(opening - t.amount);
    if (t.type === 'transfer') {
      if (t.person    === person) opening = rc(opening - t.amount);
      if (t.transferTo === person) opening = rc(opening + t.amount);
    }
  }

  let income = 0;
  let expense = 0;
  let transferNet = 0;

  for (const t of getMonthTransactions(txns, year, month)) {
    if (t.type === 'income'  && t.person === person) income  = rc(income  + t.amount);
    if (t.type === 'expense' && t.person === person) expense = rc(expense + t.amount);
    if (t.type === 'transfer') {
      if (t.person    === person) transferNet = rc(transferNet - t.amount);
      if (t.transferTo === person) transferNet = rc(transferNet + t.amount);
    }
  }

  return { opening, income, expense, transferNet, closing: rc(opening + income - expense + transferNet) };
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSON SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

export function getPersonSummary(
  txns: Transaction[],
  year: number,
  month: number,
): Record<Person, { income: number; expense: number; transferOut: number; transferIn: number }> {
  const monthTxns = getMonthTransactions(txns, year, month);
  const result = {} as Record<Person, { income: number; expense: number; transferOut: number; transferIn: number }>;
  for (const person of PERSONS) result[person] = { income: 0, expense: 0, transferOut: 0, transferIn: 0 };

  for (const t of monthTxns) {
    if (t.type === 'income') {
      result[t.person].income = rc(result[t.person].income + t.amount);
    } else if (t.type === 'expense') {
      result[t.person].expense = rc(result[t.person].expense + t.amount);
    } else if (t.type === 'transfer') {
      result[t.person].transferOut = rc(result[t.person].transferOut + t.amount);
      if (t.transferTo) result[t.transferTo].transferIn = rc(result[t.transferTo].transferIn + t.amount);
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNNING ACCOUNT BALANCE (no date scope)
// ─────────────────────────────────────────────────────────────────────────────

export function getAccountBalanceSimple(
  txns: Transaction[],
  accountId: string,
  accountBalances: Record<string, number>,
): number {
  let balance = accountBalances[accountId] || 0;
  for (const t of txns) {
    if (t.type === 'income' && t.accountId === accountId) {
      balance = rc(balance + t.amount);
    } else if (t.type === 'expense' && t.accountId === accountId) {
      balance = rc(balance - t.amount);
    } else if (t.type === 'transfer') {
      const destId = resolveTransferDestAccount(t);
      if (t.accountId === accountId) balance = rc(balance - t.amount);
      if (destId      === accountId) balance = rc(balance + t.amount);
    }
  }
  return balance;
}

// ─────────────────────────────────────────────────────────────────────────────
// FAMILY-LEVEL TOTALS
//
// FIX: initialBalances only added for persons who have NO accounts.
// Previously both accountBalances and initialBalances were summed,
// double-counting persons who have both set.
// ─────────────────────────────────────────────────────────────────────────────

export function getTotalBalance(
  txns: Transaction[],
  year: number,
  month: number,
  initialBalances: Record<Person, number>,
  accountBalances?: Record<string, number>,
) {
  const monthTxns = getMonthTransactions(txns, year, month);

  // Transfers never affect family income/expense totals — they cancel out
  const realIncome  = rc(monthTxns.filter(t => t.type === 'income' ).reduce((s, t) => rc(s + t.amount), 0));
  const realExpense = rc(monthTxns.filter(t => t.type === 'expense').reduce((s, t) => rc(s + t.amount), 0));

  // ── Opening balance ────────────────────────────────────────────────────────
  let opening = 0;

  if (accountBalances) {
    // Sum all account opening balances
    for (const acc of ACCOUNTS) {
      opening = rc(opening + (accountBalances[acc.id] || 0));
    }
    // FIX: Only add initialBalances for persons who have NO accounts configured.
    // Persons with accounts should NOT also add their initialBalance
    // (that would double-count their starting money).
    for (const person of PERSONS) {
      const hasAccounts = ACCOUNTS.some(a => a.person === person);
      if (!hasAccounts) {
        opening = rc(opening + (initialBalances[person] || 0));
      }
    }
  } else {
    // No account system — use legacy person balances only
    opening = rc(Object.values(initialBalances).reduce((s, v) => rc(s + v), 0));
  }

  // Add all historical income/expense (before target month) to opening
  const targetYM = year * 12 + month;
  for (const t of txns) {
    if (t.year * 12 + t.month >= targetYM) continue;
    if (t.type === 'income')  opening = rc(opening + t.amount);
    if (t.type === 'expense') opening = rc(opening - t.amount);
    // transfers cancel at family level — no net effect
  }

  return {
    opening,
    income:  realIncome,
    expense: realExpense,
    closing: rc(opening + realIncome - realExpense),
    savings: rc(realIncome - realExpense),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME / DEBT SPLIT
// ─────────────────────────────────────────────────────────────────────────────

export function getHomeDebtSummary(txns: Transaction[], year: number, month: number) {
  const m = getMonthTransactions(txns, year, month);
  const homeIncome  = rc(m.filter(t => t.type === 'income'  && t.homeOrDebt === 'home').reduce((s, t) => rc(s + t.amount), 0));
  const debtIncome  = rc(m.filter(t => t.type === 'income'  && t.homeOrDebt === 'debt').reduce((s, t) => rc(s + t.amount), 0));
  const homeExpense = rc(m.filter(t => t.type === 'expense' && t.homeOrDebt === 'home').reduce((s, t) => rc(s + t.amount), 0));
  const debtExpense = rc(m.filter(t => t.type === 'expense' && t.homeOrDebt === 'debt').reduce((s, t) => rc(s + t.amount), 0));
  return {
    homeIncome, debtIncome, homeExpense, debtExpense,
    homeBalance:  rc(homeIncome  - homeExpense),
    debtBalance:  rc(debtIncome  - debtExpense),
    totalIncome:  rc(homeIncome  + debtIncome),
    totalExpense: rc(homeExpense + debtExpense),
    totalBalance: rc((homeIncome + debtIncome) - (homeExpense + debtExpense)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPECTED VS ACTUAL
// ─────────────────────────────────────────────────────────────────────────────

export function getExpectedVsActualIncome(txns: Transaction[], year: number, month: number) {
  const monthTxns = getMonthTransactions(txns, year, month).filter(t => t.type === 'income');
  const result: Record<string, { expected: number; actual: number }> = {};
  for (const t of monthTxns) {
    if (!result[t.category]) result[t.category] = { expected: 0, actual: 0 };
    result[t.category].actual = rc(result[t.category].actual + t.amount);
    if (t.expectedAmount) result[t.category].expected = rc(t.expectedAmount);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// MISSING MONEY
// ─────────────────────────────────────────────────────────────────────────────

export function getMissingMoney(
  txns: Transaction[],
  year: number,
  month: number,
  initialBalances: Record<Person, number>,
  accountBalances: Record<string, number>,
) {
  const totals = getTotalBalance(txns, year, month, initialBalances, accountBalances);
  let accountTotal = 0;
  for (const acc of ACCOUNTS) {
    accountTotal = rc(accountTotal + getAccountBalance(txns, acc.id, year, month, accountBalances).closing);
  }
  for (const p of PERSONS) {
    const legacyBal = getPersonBalance(txns.filter(t => !t.accountId), p, year, month, initialBalances);
    accountTotal = rc(accountTotal + legacyBal.closing);
  }
  return {
    expectedClosing: totals.closing,
    actualClosing:   accountTotal,
    missingMoney:    rc(totals.closing - accountTotal),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET / SPENDING
// ─────────────────────────────────────────────────────────────────────────────

export function getBudgetForCategory(budgets: Budget[], category: string, year: number, month: number): number {
  const found = budgets.find(b => b.category === category && b.year === year && b.month === month);
  return found ? found.amount : (DEFAULT_BUDGETS[category] || 0);
}

export function getCategorySpending(txns: Transaction[], year: number, month: number) {
  const result: Record<string, number> = {};
  for (const t of getMonthTransactions(txns, year, month)) {
    if (t.type !== 'expense') continue;
    result[t.category] = rc((result[t.category] || 0) + t.amount);
  }
  return result;
}

export function getOverspendCategories(txns: Transaction[], budgets: Budget[], year: number, month: number) {
  const spending = getCategorySpending(txns, year, month);
  return EXPENSE_CATEGORIES.map(cat => {
    const budget    = getBudgetForCategory(budgets, cat, year, month);
    const actual    = spending[cat] || 0;
    const remaining = rc(budget - actual);
    const percent   = budget > 0 ? Math.round((actual / budget) * 100) : 0;
    return { category: cat, budget, actual, remaining, percent, overspent: actual > budget };
  });
}

export { getCashAccounts, getBankAccounts } from './types';
