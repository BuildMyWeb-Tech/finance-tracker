/**
 * excel-export.ts
 * Exports all transactions + a summary sheet to .xlsx using SheetJS (xlsx).
 *
 * Usage:
 *   import { exportTransactionsToExcel } from '@/lib/excel-export';
 *   exportTransactionsToExcel(state.transactions, state.accountBalances);
 */

import * as XLSX from 'xlsx';
import { Transaction, ACCOUNTS } from './types';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, '-'); // "18-Apr-2025"
}

function getAccountName(accountId?: string): string {
  if (!accountId) return '';
  return ACCOUNTS.find(a => a.id === accountId)?.name ?? accountId;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]; // "2025-04-18"
}

// ── Row shape for the transactions sheet ──────────────────────────────────

interface ExcelRow {
  Date: string;
  Type: string;
  Person: string;
  Category: string;
  Amount: number;
  'Payment Mode': string;
  Account: string;
  'Transfer To': string;
  'Transfer Account': string;
  Notes: string;
  HomeOrDebt: string;
}

// ── Column width auto-fit helper ───────────────────────────────────────────

function autoColWidths(rows: Record<string, unknown>[]): XLSX.ColInfo[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  return keys.map(k => {
    const max = Math.max(
      k.length,
      ...rows.map(r => String(r[k] ?? '').length),
    );
    return { wch: Math.min(max + 2, 40) };
  });
}

// ── Bold header style (works with SheetJS Community Edition) ───────────────
// SheetJS CE supports cell styles via write options — we apply bold by wrapping
// header cells manually. Full styles require Pro; CE supports font bold via
// the `!cols` + manual cell approach. We use a workaround: set the header row
// to all-caps names so they visually stand out in CE.

// ── Main export function ──────────────────────────────────────────────────

export function exportTransactionsToExcel(
  transactions: Transaction[],
  accountBalances: Record<string, number> = {},
): void {
  if (transactions.length === 0) {
    throw new Error('No transactions to export.');
  }

  // ── Sheet 1: Transactions ──────────────────────────────────────────────
  const rows: ExcelRow[] = transactions
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(t => ({
      Date:               fmtDate(t.date),
      Type:               t.type,
      Person:             t.person,
      Category:           t.category ?? '',
      Amount:             t.amount,          // pure number — no ₹
      'Payment Mode':     t.paymentMode,
      Account:            getAccountName(t.accountId),
      'Transfer To':      t.transferTo ?? '',
      'Transfer Account': getAccountName(t.transferToAccountId),
      Notes:              t.notes ?? '',
      HomeOrDebt:         t.homeOrDebt,
    }));

  const ws1 = XLSX.utils.json_to_sheet(rows);
  ws1['!cols'] = autoColWidths(rows as unknown as Record<string, unknown>[]);

  // ── Sheet 2: Summary ───────────────────────────────────────────────────
  const totalIncome    = transactions.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0);
  const totalExpense   = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netBalance     = totalIncome - totalExpense;
  const transfersIn    = transactions.filter(t => t.type === 'transfer').reduce((s, t) => s + t.amount, 0);
  const transfersOut   = transfersIn; // same total, opposite direction

  const summaryRows = [
    { Metric: 'Total Income',      Value: totalIncome  },
    { Metric: 'Total Expense',     Value: totalExpense },
    { Metric: 'Net Balance',       Value: netBalance   },
    { Metric: 'Total Transfers In',  Value: transfersIn  },
    { Metric: 'Total Transfers Out', Value: transfersOut },
  ];
  const ws2 = XLSX.utils.json_to_sheet(summaryRows);
  ws2['!cols'] = [{ wch: 22 }, { wch: 16 }];

  // ── Workbook ───────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Transactions');
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  const fileName = `finance-transactions-${todayISO()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}