/**
 * detectFinancialIssues.ts
 * Detects common financial data integrity issues.
 * Pure function — reads only, never mutates.
 */

import { Transaction, ACCOUNTS } from './types';
import { getAccountBalanceSimple, rc } from './financial-store';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface FinancialIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  description: string;
  suggestion: string;
  relatedIds?: string[]; // transaction ids involved
}

export function detectFinancialIssues(
  txns: Transaction[],
  accountBalances: Record<string, number>,
): FinancialIssue[] {
  const issues: FinancialIssue[] = [];

  // ── 1. Duplicate transactions ─────────────────────────────────────────────
  // Same amount + date + accountId (or person if no account)
  const dupMap = new Map<string, Transaction[]>();
  for (const t of txns) {
    const key = `${t.date}|${t.amount}|${t.accountId ?? t.person}|${t.type}`;
    const bucket = dupMap.get(key) ?? [];
    bucket.push(t);
    dupMap.set(key, bucket);
  }
  for (const [, group] of dupMap) {
    if (group.length > 1) {
      const t = group[0];
      issues.push({
        id: `dup-${t.date}-${t.amount}`,
        severity: 'error',
        title: 'Possible duplicate transaction',
        description: `${group.length}× ₹${t.amount} on ${t.date} (${t.accountId ?? t.person}, ${t.type})`,
        suggestion: 'Review and remove duplicate entries if they represent the same transaction.',
        relatedIds: group.map(g => g.id),
      });
    }
  }

  // ── 2. Income + Transfer duplication ─────────────────────────────────────
  // Same amount + date + person appearing as both income and transfer source
  const incomeMap = new Map<string, Transaction>();
  for (const t of txns) {
    if (t.type === 'income') {
      incomeMap.set(`${t.date}|${t.amount}|${t.person}`, t);
    }
  }
  for (const t of txns) {
    if (t.type === 'transfer') {
      const key = `${t.date}|${t.amount}|${t.person}`;
      const match = incomeMap.get(key);
      if (match) {
        issues.push({
          id: `inc-transfer-dup-${t.id}`,
          severity: 'warning',
          title: 'Income + Transfer duplication suspected',
          description: `₹${t.amount} on ${t.date} for ${t.person} recorded as both income and transfer source.`,
          suggestion: 'Convert the income entry to a transfer, or remove the duplicate income if this was a fund movement.',
          relatedIds: [t.id, match.id],
        });
      }
    }
  }

  // ── 3. Missing transfer destination ──────────────────────────────────────
  // Transfer exists but transferToAccountId and transferTo are both missing/unclear
  for (const t of txns) {
    if (t.type !== 'transfer') continue;
    const hasDestAccount = !!t.transferToAccountId;
    const hasDest = !!t.transferTo;
    if (!hasDestAccount && !hasDest) {
      issues.push({
        id: `missing-dest-${t.id}`,
        severity: 'error',
        title: 'Transfer missing destination',
        description: `Transfer of ₹${t.amount} on ${t.date} from ${t.accountId ?? t.person} has no destination.`,
        suggestion: 'Edit the transfer to add the destination account or person.',
        relatedIds: [t.id],
      });
    }
  }

  // ── 4. Suspicious large cash imbalance ───────────────────────────────────
  const cashAccounts = ACCOUNTS.filter(a => a.type === 'cash');
  for (const acc of cashAccounts) {
    const balance = getAccountBalanceSimple(txns, acc.id, accountBalances);
    if (balance < -1000) {
      issues.push({
        id: `neg-cash-${acc.id}`,
        severity: 'error',
        title: `Negative cash balance: ${acc.name}`,
        description: `${acc.name} has a balance of ₹${balance.toLocaleString('en-IN')} which is physically impossible for cash.`,
        suggestion: 'Check for missing income entries, incorrect expense amounts, or wrong account assignments.',
        relatedIds: [],
      });
    } else if (Math.abs(balance) > 50000) {
      issues.push({
        id: `large-cash-${acc.id}`,
        severity: 'warning',
        title: `Large cash balance: ${acc.name}`,
        description: `${acc.name} shows ₹${balance.toLocaleString('en-IN')} — unusually high for a cash account.`,
        suggestion: 'Verify if this is correct or if some transactions are tagged to the wrong account.',
        relatedIds: [],
      });
    }
  }

  // ── 5. Negative balance accounts (all) ───────────────────────────────────
  for (const acc of ACCOUNTS) {
    const balance = getAccountBalanceSimple(txns, acc.id, accountBalances);
    if (balance < 0 && acc.type === 'cash') continue; // already caught above
    if (balance < -500 && acc.type === 'bank') {
      issues.push({
        id: `neg-bank-${acc.id}`,
        severity: 'warning',
        title: `Negative bank balance: ${acc.name}`,
        description: `${acc.name} has a computed balance of ₹${balance.toLocaleString('en-IN')}.`,
        suggestion: 'Check for missing income, incorrect opening balance, or expenses assigned to wrong account.',
        relatedIds: [],
      });
    }
  }

  // ── 6. Type casing integrity ──────────────────────────────────────────────
  for (const t of txns) {
    const raw = (t.type as string);
    if (raw !== raw.toLowerCase().trim()) {
      issues.push({
        id: `type-casing-${t.id}`,
        severity: 'info',
        title: 'Transaction type has incorrect casing',
        description: `Transaction ${t.id} has type "${raw}" — should be lowercase.`,
        suggestion: 'This is auto-corrected at load time but consider re-saving this transaction.',
        relatedIds: [t.id],
      });
    }
    if (t.amount < 0) {
      issues.push({
        id: `neg-amount-${t.id}`,
        severity: 'info',
        title: 'Negative amount in transaction',
        description: `Transaction on ${t.date} has a negative amount (${t.amount}). Amounts should always be positive.`,
        suggestion: 'Re-save this transaction to normalize the amount.',
        relatedIds: [t.id],
      });
    }
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return issues.filter(i => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
}