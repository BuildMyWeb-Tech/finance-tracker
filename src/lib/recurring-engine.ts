/**
 * RecurringEngine.ts
 * Handles auto-application of recurring transactions:
 * - Daily recurring (Mon–Sat)
 * - Every Saturday recurring
 * - Rent auto-add (1st of month)
 * - Salary auto-add (configurable day)
 * - EMI reminders
 */

import { Transaction, RecurringEntry, Person } from './types';
import { generateId } from './financial-store';

export type RecurringFrequency =
  | 'daily-mon-sat'   // Mon–Sat every day
  | 'weekly-sat'      // Every Saturday
  | 'monthly'         // Fixed day of month (rent, salary, EMI)
  | 'custom';

export interface SmartRecurringEntry extends RecurringEntry {
  frequency?: RecurringFrequency;
  isAutoApply?: boolean;   // if true, auto-create transaction when due
  lastApplied?: string;    // YYYY-MM-DD of last auto-apply
  isEMI?: boolean;         // show as EMI reminder
  emiMonthsLeft?: number;  // for EMI countdown
}

/**
 * Get all dates in a month that match a Mon–Sat daily pattern.
 */
export function getMonSatDates(year: number, month: number): string[] {
  const dates: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    if (dow >= 1 && dow <= 6) { // Mon–Sat
      dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }
  return dates;
}

/**
 * Get all Saturday dates in a month.
 */
export function getSaturdayDates(year: number, month: number): string[] {
  const dates: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === 6) { // Saturday
      dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }
  return dates;
}

/**
 * Check if a recurring entry should generate transactions for a given month.
 * Returns the dates on which transactions should be created.
 */
export function getRecurringDatesForMonth(
  entry: SmartRecurringEntry,
  year: number,
  month: number
): string[] {
  const freq = entry.frequency || 'monthly';

  if (freq === 'daily-mon-sat') {
    return getMonSatDates(year, month);
  }

  if (freq === 'weekly-sat') {
    return getSaturdayDates(year, month);
  }

  if (freq === 'monthly') {
    const day = entry.dayOfMonth || 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const actualDay = Math.min(day, daysInMonth);
    return [`${year}-${String(month + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`];
  }

  return [];
}

/**
 * Given a list of smart recurring entries and existing transactions,
 * returns any transactions that are missing for the given month
 * (i.e., should have been auto-applied but aren't in the DB yet).
 */
export function getMissingRecurringTransactions(
  entries: SmartRecurringEntry[],
  existingTxns: Transaction[],
  year: number,
  month: number
): Omit<Transaction, 'id'>[] {
  const missing: Omit<Transaction, 'id'>[] = [];

  for (const entry of entries) {
    if (!entry.isAutoApply) continue;

    const dueDates = getRecurringDatesForMonth(entry, year, month);

    for (const date of dueDates) {
      // Check if a matching transaction already exists for this date
      const exists = existingTxns.some(t =>
        t.date === date &&
        t.category === entry.category &&
        t.person === entry.person &&
        t.amount === entry.amount &&
        t.type === entry.type
      );

      if (!exists) {
        missing.push({
          date,
          year,
          month,
          person: entry.person,
          type: entry.type,
          category: entry.category,
          amount: entry.amount,
          paymentMode: entry.paymentMode,
          notes: entry.notes || `Auto: ${entry.category}`,
          transferTo: entry.transferTo,
          accountId: entry.accountId,
          homeOrDebt: entry.homeOrDebt || 'home',
        });
      }
    }
  }

  return missing;
}

/**
 * Build EMI reminder objects from recurring entries marked as EMI.
 */
export interface EMIReminder {
  id: string;
  category: string;
  person: Person;
  amount: number;
  dueDay: number;
  monthsLeft?: number;
  isPastDue: boolean;
  dueDate: string;
}

export function getEMIReminders(
  entries: SmartRecurringEntry[],
  year: number,
  month: number
): EMIReminder[] {
  const today = new Date();
  return entries
    .filter(e => e.isEMI)
    .map(e => {
      const day = e.dayOfMonth || 1;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const actualDay = Math.min(day, daysInMonth);
      const dueDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
      const isPastDue = new Date(dueDate) < today;
      return {
        id: e.id,
        category: e.category,
        person: e.person,
        amount: e.amount,
        dueDay: actualDay,
        monthsLeft: e.emiMonthsLeft,
        isPastDue,
        dueDate,
      };
    });
}

/**
 * Smart presets for common recurring patterns.
 * Used in the RecurringManager UI.
 */
export const RECURRING_PRESETS = [
  {
    id: 'rent',
    label: '🏠 Rent',
    category: 'Rent',
    type: 'expense' as const,
    homeOrDebt: 'home' as const,
    frequency: 'monthly' as RecurringFrequency,
    dayOfMonth: 1,
    isAutoApply: true,
  },
  {
    id: 'salary',
    label: '💰 Salary',
    category: 'Appa Salary',
    type: 'income' as const,
    homeOrDebt: 'home' as const,
    frequency: 'monthly' as RecurringFrequency,
    dayOfMonth: 1,
    isAutoApply: true,
  },
  {
    id: 'ajai-salary',
    label: '💰 Ajai Salary',
    category: 'Ajai Salary',
    type: 'income' as const,
    homeOrDebt: 'home' as const,
    frequency: 'monthly' as RecurringFrequency,
    dayOfMonth: 1,
    isAutoApply: true,
  },
  {
    id: 'milk-daily',
    label: '🥛 Milk (Daily Mon–Sat)',
    category: 'Milk',
    type: 'expense' as const,
    homeOrDebt: 'home' as const,
    frequency: 'daily-mon-sat' as RecurringFrequency,
    isAutoApply: false, // set to true if user wants auto-apply
  },
  {
    id: 'loan-emi',
    label: '🏦 Loan EMI',
    category: 'Loan Repaid',
    type: 'expense' as const,
    homeOrDebt: 'debt' as const,
    frequency: 'monthly' as RecurringFrequency,
    dayOfMonth: 5,
    isAutoApply: false,
    isEMI: true,
  },
] as const;