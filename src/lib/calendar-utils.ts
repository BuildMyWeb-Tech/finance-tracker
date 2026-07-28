/**
 * calendar-utils.ts — Memoization-friendly helpers for calendar views.
 * All calcs delegate to financial-store.ts — no manual re-computation.
 */

import { Transaction } from './types';
import { rc } from './financial-store';

export interface DaySummary {
  date: string; // YYYY-MM-DD
  income: number;
  expense: number;
  transfer: number;
  balance: number; // income - expense
  txnCount: number;
  transactions: Transaction[];
}

export interface MonthSummary {
  year: number;
  month: number;
  income: number;
  expense: number;
  balance: number;
  txnCount: number;
}

/** Group transactions by date string YYYY-MM-DD */
export function groupByDate(txns: Transaction[]): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();
  for (const t of txns) {
    const list = map.get(t.date) || [];
    list.push(t);
    map.set(t.date, list);
  }
  return map;
}

/** Build DaySummary for a given date string from pre-grouped map */
export function buildDaySummary(date: string, txns: Transaction[]): DaySummary {
  let income = 0, expense = 0, transfer = 0;
  for (const t of txns) {
    if (t.type === 'income')   income   = rc(income   + t.amount);
    if (t.type === 'expense')  expense  = rc(expense  + t.amount);
    if (t.type === 'transfer') transfer = rc(transfer + t.amount);
  }
  return { date, income, expense, transfer, balance: rc(income - expense), txnCount: txns.length, transactions: txns };
}

/** Get all DaySummaries for a month */
export function getMonthDaySummaries(txns: Transaction[], year: number, month: number): Map<string, DaySummary> {
  const monthTxns = txns.filter(t => t.year === year && t.month === month);
  const grouped = groupByDate(monthTxns);
  const result = new Map<string, DaySummary>();
  for (const [date, dayTxns] of grouped) {
    result.set(date, buildDaySummary(date, dayTxns));
  }
  return result;
}

/** Highest expense day in a month — for red border highlight */
export function getHighlightDays(summaries: Map<string, DaySummary>): {
  maxExpenseDate: string | null;
  maxIncomeDate: string | null;
} {
  let maxExpense = 0, maxIncome = 0;
  let maxExpenseDate: string | null = null, maxIncomeDate: string | null = null;
  for (const [date, s] of summaries) {
    if (s.expense > maxExpense) { maxExpense = s.expense; maxExpenseDate = date; }
    if (s.income  > maxIncome)  { maxIncome  = s.income;  maxIncomeDate  = date; }
  }
  return { maxExpenseDate, maxIncomeDate };
}

/** Build a calendar grid (6 rows × 7 cols) for a given year/month */
export function buildCalendarGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[][] = [];
  let day = 1 - firstDay;
  for (let row = 0; row < 6; row++) {
    const week: (number | null)[] = [];
    for (let col = 0; col < 7; col++) {
      week.push(day >= 1 && day <= daysInMonth ? day : null);
      day++;
    }
    grid.push(week);
    if (day > daysInMonth) break;
  }
  return grid;
}

/** YYYY-MM-DD from parts */
export function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Navigate day: returns { year, month, day } for prev/next */
export function navigateDay(year: number, month: number, day: number, dir: 1 | -1): { year: number; month: number; day: number } {
  const d = new Date(year, month, day + dir);
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

/** Format amount — full value, no k/L abbreviation */
export function fmtFull(n: number): string {
  return `₹${Math.abs(n).toLocaleString('en-IN')}`;
}

/** Compact format for calendar cells */
export function fmtCompact(n: number): string {
  if (n === 0) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n}`;
}